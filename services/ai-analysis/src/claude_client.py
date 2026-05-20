"""
Claude Sonnet API 클라이언트

@file Claude API 호출 + Circuit Breaker + 구조화된 응답 파싱
@domain ai
@layer service
@related prompt, circuit_breaker, metrics
"""

import json
import logging
import re

import anthropic

from .circuit_breaker import circuit_breaker
from .config import settings
from .metrics import claude_requests_total
from .prompt import (
    build_group_user_prompt,
    build_user_prompt,
    compute_total_score,
    get_group_system_prompt,
    get_system_prompt,
)

logger = logging.getLogger(__name__)

# ─── CONSTANTS ────────────────────────────────

MODEL_ID = "claude-haiku-4-5-20251001"
MAX_TOKENS = 8192
CODE_LENGTH_THRESHOLD = 50000


def _is_explicit_false(value: object) -> bool:
    """엄격 boolean 검증 — bool False 또는 'false' 문자열만 True 반환

    optimizedCodeMeta 자가 검증에서 LLM이 string boolean을 반환해도 우회되지 않도록
    명시적 false 케이스만 식별한다. 누락/None/타입 불일치는 False(폴백 안 함)로 취급.

    @domain ai
    @param value: 검사 대상 값
    @returns: 명시적 false면 True, 그 외(True/누락/None/타입 불일치)면 False
    """
    if value is False:
        return True
    if isinstance(value, str) and value.strip().lower() == "false":
        return True
    return False


def _validate_categories(categories: object) -> list[dict]:
    """categories 필드 스키마 검증 — list[dict]가 아니면 안전한 기본값으로 보정

    Claude 응답에서 categories가 리스트가 아니거나 원소가 dict가 아닌 경우
    AttributeError 런타임 예외가 발생하므로, 파싱 즉시 검증하여 안전 처리한다.

    @domain ai
    @param categories: parsed JSON에서 추출한 categories 원시 값
    @returns: 원소가 모두 dict인 리스트
    """
    if not isinstance(categories, list):
        logger.warning(
            "categories 필드가 list가 아님 — 빈 리스트로 대체",
            extra={"categoriesType": type(categories).__name__},
        )
        return []

    valid = [cat for cat in categories if isinstance(cat, dict)]
    if len(valid) != len(categories):
        logger.warning(
            "categories에 dict가 아닌 원소 포함 — 필터링",
            extra={"total": len(categories), "valid": len(valid)},
        )
    return valid


class CircuitBreakerOpenError(Exception):
    """Circuit Breaker OPEN 상태 전용 예외

    Worker에서 catch하여 NACK+requeue 처리에 사용.

    @domain ai
    """

    pass


class RateLimitRetryableError(Exception):
    """Claude API Rate Limit 전용 예외 — 재시도 가능

    Worker에서 catch하여 NACK+requeue 처리에 사용.
    delayed 결과로 반환하여 ACK하면 메시지가 유실되므로,
    반드시 예외로 전파하여 재큐잉·보상 처리를 위임해야 한다.

    @domain ai
    """

    pass


class ClaudeClient:
    """Claude Sonnet API 클라이언트 -- Circuit Breaker 적용

    보안:
    - API Key 로그 노출 금지
    - 사용자 코드는 로그에 일부만 기록 (최대 50자)

    @domain ai
    """

    def __init__(self):
        self.client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    def analyze_code(
        self,
        code: str,
        language: str,
        problem_title: str = "",
        problem_description: str = "",
        source_platform: str | None = None,
    ) -> dict:
        """
        코드 분석 요청 -- 5개 카테고리 구조화 결과 반환

        @domain ai
        @param code: 분석 대상 코드
        @param language: 프로그래밍 언어
        @param problem_title: 문제 제목
        @param problem_description: 문제 설명
        @param source_platform: 문제 플랫폼 (예: 'BOJ', 'PROGRAMMERS') — 프롬프트 맥락 주입
        @returns: 구조화된 분석 결과 dict
        """
        if not circuit_breaker.can_execute():
            logger.warning("Circuit Breaker OPEN -- NACK+requeue 위임")
            raise CircuitBreakerOpenError("Circuit Breaker OPEN")

        try:
            user_prompt = build_user_prompt(
                code=code,
                language=language,
                problem_title=problem_title,
                problem_description=problem_description,
                source_platform=source_platform,
            )

            # 동기 호출 (worker 스레드에서 실행되므로 sync 사용)
            message = self.client.messages.create(
                model=MODEL_ID,
                max_tokens=MAX_TOKENS,
                system=get_system_prompt(language),
                messages=[{"role": "user", "content": user_prompt}],
            )

            circuit_breaker.record_success()
            claude_requests_total.labels(status="success").inc()

            # 토큰 사용량 로깅
            input_tokens = message.usage.input_tokens
            output_tokens = message.usage.output_tokens
            logger.info(
                "Claude 토큰 사용량",
                extra={
                    "inputTokens": input_tokens,
                    "outputTokens": output_tokens,
                    "totalTokens": input_tokens + output_tokens,
                },
            )

            raw_text = message.content[0].text if message.content else ""
            result = self._parse_response(raw_text, language=language)

            if len(code) > CODE_LENGTH_THRESHOLD:
                logger.warning(
                    "코드 길이 초과 — optimizedCode 생성 보류",
                    extra={
                        "codeLength": len(code),
                        "threshold": CODE_LENGTH_THRESHOLD,
                    },
                )
                result["optimized_code"] = None

            code_preview = code[:50] + "..." if len(code) > 50 else code
            logger.info(
                "Claude 분석 완료",
                extra={
                    "language": language,
                    "score": result.get("score", 0),
                    "codePreview": code_preview,
                },
            )

            return result

        except anthropic.RateLimitError:
            circuit_breaker.record_failure()
            claude_requests_total.labels(status="rate_limit").inc()
            logger.warning("Claude API Rate Limit 초과 -- NACK+requeue 위임")
            # ACK 후 메시지 유실 방지: 재시도 가능 예외로 전파하여 워커에 재큐잉 위임
            raise RateLimitRetryableError("Claude API Rate Limit 초과")

        except Exception as e:
            circuit_breaker.record_failure()
            claude_requests_total.labels(status="error").inc()
            safe_error = str(e)[:100]
            logger.error("Claude API 오류", extra={"error": safe_error})
            return {
                "feedback": "AI 분석 중 오류가 발생했습니다.",
                "optimized_code": None,
                "score": 0,
                "status": "failed",
                "categories": [],
            }

    def _parse_response(self, raw_text: str, language: str = "python") -> dict:
        """
        Claude 응답 JSON 파싱 -- 구조화된 결과 추출

        @domain ai
        @param raw_text: Claude 원본 응답 텍스트
        @param language: 프로그래밍 언어 (fallback 가중치 분기용)
        @returns: 파싱된 분석 결과 dict
        """
        try:
            # 마크다운 코드 블록 제거
            cleaned = self._strip_markdown_block(raw_text)

            try:
                parsed = json.loads(cleaned)
            except json.JSONDecodeError:
                # Fallback 1: 숫자 뒤 불필요한 따옴표 제거
                # Claude hallucination 대응 — 예: "endLine": 70" → "endLine": 70
                sanitized = re.sub(r":\s*(\d+)\"(\s*[,}\]])", r": \1\2", cleaned)
                try:
                    parsed = json.loads(sanitized)
                    logger.info("숫자 뒤 불필요한 따옴표 제거 후 JSON 파싱 성공")
                except json.JSONDecodeError:
                    # Fallback 2: optimizedCode 내 이스케이프 깨짐 대응
                    stripped = re.sub(
                        r'"optimizedCode"\s*:\s*"(?:[^"\\]|\\.)*"',
                        '"optimizedCode": null',
                        sanitized,
                        flags=re.DOTALL,
                    )
                    try:
                        parsed = json.loads(stripped)
                        logger.info("optimizedCode 필드 제거 후 JSON 재파싱 성공")
                    except json.JSONDecodeError:
                        # Fallback 3: 첫 번째 유효 JSON 객체 추출
                        parsed = self._extract_first_json_object(sanitized)

            # 필수 필드 검증
            total_score = parsed.get("totalScore", 0)
            summary = parsed.get("summary", "")
            categories = parsed.get("categories", [])
            optimized_code = parsed.get("optimizedCode")

            # optimizedCodeMeta 자가 검증 — 명시적 false 발견 시 안전 폴백
            # bool False 또는 "false" 문자열만 폴백 트리거 (LLM 응답이 string boolean으로
            # 직렬화되어도 우회되지 않도록 엄격 검증). 누락/None/타입 불일치는 폴백 안 함.
            meta = parsed.get("optimizedCodeMeta")
            if isinstance(meta, dict) and optimized_code:
                sig = meta.get("signaturePreserved")
                behav = meta.get("behaviorEquivalent")
                if _is_explicit_false(sig) or _is_explicit_false(behav):
                    logger.warning(
                        "optimizedCode 자가 검증 실패 — 원본 코드로 폴백",
                        extra={
                            "signaturePreserved": sig,
                            "behaviorEquivalent": behav,
                            "changes": meta.get("changes", []),
                        },
                    )
                    optimized_code = None
                    # feedback JSON에서도 거부된 코드 제거 — frontend parseFeedback이
                    # feedback.optimizedCode를 우선 사용하므로 양쪽 모두 정리해야 폴백이 유효함
                    parsed["optimizedCode"] = None

            # categories 스키마 검증 — list[dict]가 아니면 안전 처리
            categories = _validate_categories(categories)

            # feedback: summary + 카테고리별 코멘트 결합
            feedback_parts = [summary]
            for cat in categories:
                name = cat.get("name", "unknown")
                score = cat.get("score", 0)
                comment = cat.get("comment", "")
                feedback_parts.append(f"[{name}: {score}점] {comment}")

            score = int(total_score)
            if score == 0 and categories:
                logger.warning(
                    "totalScore=0이지만 카테고리 존재 -- 가중 평균으로 재계산"
                )
                category_scores = {
                    cat.get("name", ""): cat.get("score", 0) for cat in categories
                }
                recomputed = compute_total_score(category_scores, language)
                if recomputed > 0:
                    score = recomputed

            return {
                "feedback": json.dumps(parsed, ensure_ascii=False),
                "optimized_code": optimized_code,
                "score": score,
                "status": "completed",
                "categories": categories,
            }

        except (json.JSONDecodeError, ValueError, KeyError) as e:
            # Sprint 159 핫픽스 — raw 텍스트를 feedback 필드에 그대로 저장하지 않고,
            # 항상 유효 JSON envelope 으로 감싸 DB에 저장.
            # 근거: dh4m 제출 사례에서 catch-all 폴백이 raw 마크다운/JSON을 노출 →
            # 프론트 parseFeedback catch 블록이 summary=raw 로 표시.
            # PII/잠재 비밀이 raw 에 포함될 수 있으므로 raw 는 로그에도 노출 금지 (Critic P2).

            # 원본 텍스트에서 totalScore 추출 시도 (정규식 fallback)
            score = 0
            score_match = re.search(r'"totalScore"\s*:\s*(\d+)', raw_text)
            if score_match:
                score = int(score_match.group(1))

            logger.warning(
                "Claude 응답 파싱 실패 -- envelope fallback 사용",
                extra={
                    "error": str(e)[:100],
                    "score_extracted": score,
                    "raw_length": len(raw_text),
                },
            )

            # score가 추출되면 분석 자체는 성공 — JSON 파싱만 실패한 것
            status = "completed" if score > 0 else "failed"
            if status == "completed":
                logger.info(
                    "파싱 실패하였으나 score 추출 성공 -- completed 처리",
                    extra={"score": score},
                )

            # 유효 JSON envelope — 프론트에서 즉시 구조화 렌더링 가능
            envelope = {
                "totalScore": score,
                "summary": (
                    "AI 분석 결과 파싱에 일시적 오류가 발생했습니다. "
                    "점수만 확인하실 수 있습니다."
                )
                if score > 0
                else ("AI 분석 결과를 표시할 수 없습니다. 잠시 후 다시 시도해주세요."),
                "categories": [],
                "optimizedCode": None,
            }
            return {
                "feedback": json.dumps(envelope, ensure_ascii=False),
                "optimized_code": None,
                "score": score,
                "status": status,
                "categories": [],
            }

    def group_analyze(
        self,
        code_snippets: list[dict],
        source_platform: str | None = None,
    ) -> dict:
        """
        그룹 분석 요청 -- 여러 제출 코드를 비교 분석

        @domain ai
        @param code_snippets: [{language, userId, code}] 형태 리스트
        @param source_platform: 문제 플랫폼 (예: 'BOJ', 'PROGRAMMERS') — 프롬프트 맥락 주입
        @returns: 구조화된 그룹 분석 결과 dict
        """
        if not circuit_breaker.can_execute():
            logger.warning("Circuit Breaker OPEN -- 그룹 분석 거부")
            raise CircuitBreakerOpenError("Circuit Breaker OPEN")

        try:
            user_prompt = build_group_user_prompt(
                code_snippets, source_platform=source_platform
            )

            # code_snippets에서 언어 추출 (그룹 분석은 동일 문제 → 첫 번째 스니펫 기준)
            group_language = code_snippets[0]["language"] if code_snippets else "python"

            message = self.client.messages.create(
                model=MODEL_ID,
                max_tokens=MAX_TOKENS,
                system=get_group_system_prompt(group_language),
                messages=[{"role": "user", "content": user_prompt}],
            )

            circuit_breaker.record_success()
            claude_requests_total.labels(status="success").inc()

            # 토큰 사용량 로깅
            input_tokens = message.usage.input_tokens
            output_tokens = message.usage.output_tokens
            logger.info(
                "그룹 분석 토큰 사용량",
                extra={
                    "inputTokens": input_tokens,
                    "outputTokens": output_tokens,
                    "totalTokens": input_tokens + output_tokens,
                },
            )

            raw_text = message.content[0].text if message.content else ""
            result = self._parse_group_response(raw_text)

            logger.info(
                "그룹 분석 완료",
                extra={
                    "snippets": len(code_snippets),
                    "status": result.get("status", "unknown"),
                },
            )

            return result

        except CircuitBreakerOpenError:
            raise

        except Exception as e:
            circuit_breaker.record_failure()
            claude_requests_total.labels(status="error").inc()
            safe_error = str(e)[:100]
            logger.error("그룹 분석 Claude API 오류", extra={"error": safe_error})
            return {
                "comparison": "AI 분석 중 오류가 발생했습니다.",
                "bestApproach": None,
                "optimizedCode": None,
                "learningPoints": [],
                "status": "failed",
            }

    def _parse_group_response(self, raw_text: str) -> dict:
        """
        그룹 분석 Claude 응답 JSON 파싱 -- 비교/최적화 결과 추출

        GROUP_SYSTEM_PROMPT 스키마:
        { comparison, bestApproach, optimizedCode, learningPoints }

        @domain ai
        @param raw_text: Claude 원본 응답 텍스트
        @returns: 파싱된 그룹 분석 결과 dict
        """
        try:
            cleaned = self._strip_markdown_block(raw_text)

            try:
                parsed = json.loads(cleaned)
            except json.JSONDecodeError:
                # Fallback: 첫 번째 유효 JSON 객체 추출
                parsed = self._extract_first_json_object(cleaned)

            # 필수 필드 추출 (누락 시 기본값)
            comparison = parsed.get("comparison", "")
            best_approach = parsed.get("bestApproach", "")
            optimized_code = parsed.get("optimizedCode")
            learning_points = parsed.get("learningPoints", [])

            # learningPoints가 리스트가 아닌 경우 보정
            if not isinstance(learning_points, list):
                learning_points = [str(learning_points)] if learning_points else []

            return {
                "comparison": comparison,
                "bestApproach": best_approach,
                "optimizedCode": optimized_code,
                "learningPoints": learning_points,
                "status": "completed",
                "raw": json.dumps(parsed, ensure_ascii=False),
            }

        except (json.JSONDecodeError, ValueError, KeyError) as e:
            # Sprint 164 시드 #신규3 — Sprint 159 single 분석 envelope 패턴을 group 측 회수.
            # 기존 fallback 은 raw_text 를 comparison 에 50000자까지 노출 → PII/잠재 secret 노출 위험.
            # 본문 노출 0 + raw_length 만 로깅 + user-facing 안전 문구 envelope 반환.

            # Sprint 174 #신규7 — 실패 envelope 반환 전에 부분 복구 시도.
            # 모델이 완전히 종결한 top-level 필드만 회수 (절단/trailing comma 등).
            # 미종결 문자열 필드는 절대 복구하지 않음 → Sprint 164 보안 경계 보존.
            recovered = self._recover_partial_json_object(raw_text)
            if (
                isinstance(recovered, dict)
                and isinstance(recovered.get("comparison"), str)
                and recovered["comparison"]
            ):
                learning_points = recovered.get("learningPoints", [])
                if not isinstance(learning_points, list):
                    learning_points = [str(learning_points)] if learning_points else []
                logger.info(
                    "그룹 분석 부분 복구 성공",
                    extra={
                        "raw_length": len(raw_text),
                        "recovered_fields": len(recovered),
                    },
                )
                return {
                    "comparison": recovered["comparison"],
                    "bestApproach": recovered.get("bestApproach") or None,
                    "optimizedCode": recovered.get("optimizedCode"),
                    "learningPoints": learning_points,
                    "status": "completed",
                    "raw": json.dumps(recovered, ensure_ascii=False),
                }

            logger.warning(
                "그룹 분석 Claude 응답 파싱 실패 -- envelope fallback 사용",
                extra={
                    "error": str(e)[:100],
                    "raw_length": len(raw_text),
                },
            )

            # group 은 single 의 score 정규식 추출 패턴 없음 → 항상 status="failed".
            # 유효 JSON 구조 envelope — 프론트가 즉시 구조화 렌더링 가능.
            return {
                "comparison": (
                    "AI 그룹 분석 결과 파싱에 일시적 오류가 발생했습니다. "
                    "잠시 후 다시 시도해주세요."
                ),
                "bestApproach": None,
                "optimizedCode": None,
                "learningPoints": [],
                "status": "failed",
            }

    @staticmethod
    def _strip_markdown_block(text: str) -> str:
        """마크다운 코드 블록(```json ... ```) 제거

        @domain ai
        @param text: 원본 텍스트
        @returns: 마크다운 블록이 제거된 텍스트
        """
        cleaned = text.strip()
        if cleaned.startswith("```"):
            first_newline = cleaned.index("\n")
            lines = cleaned.split("\n")
            end_idx = len(cleaned)
            for i in range(len(lines) - 1, 0, -1):
                if lines[i].strip() == "```":
                    end_idx = sum(len(line) + 1 for line in lines[:i])
                    break
            cleaned = cleaned[first_newline + 1 : end_idx].strip()
        return cleaned

    @staticmethod
    def _extract_first_json_object(text: str) -> dict:
        """텍스트에서 첫 번째 유효 JSON 객체를 추출

        @domain ai
        @param text: JSON 객체가 포함된 텍스트
        @returns: 파싱된 dict
        @raises json.JSONDecodeError: JSON 추출 실패 시
        """
        start = text.find("{")
        if start == -1:
            raise json.JSONDecodeError("No JSON object found", text, 0)
        depth = 0
        end = -1
        in_string = False
        escape = False
        for i, ch in enumerate(text[start:], start):
            if escape:
                escape = False
                continue
            if ch == "\\":
                escape = True
                continue
            if ch == '"':
                in_string = not in_string
                continue
            if in_string:
                continue
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    end = i
                    break
        if end == -1:
            raise json.JSONDecodeError("Unclosed JSON object", text, start)
        return json.loads(text[start : end + 1])

    @staticmethod
    def _recover_partial_json_object(text: str) -> dict | None:
        """절단/손상된 JSON 에서 모델이 완전히 종결한 top-level 필드만 복구.

        Sprint 174 #신규7 — 그룹 분석 fallback 부분 회수용. prefix-at-comma-boundary
        전략: root object 내부에서 깊이 1(=top-level)·문자열 밖에서 만난 콤마 직전까지는
        완전히 종결된 key:value 쌍들이므로 안전한 복구 후보(cut point)다. 후보 prefix 의
        끝 trailing comma/whitespace 를 제거하고 열려있는 컨테이너만큼 닫는 괄호를 붙여
        json.loads 로 검증한 결과만 반환한다.

        보안 불변식 (Sprint 164 경계 보존):
        - raw_text(또는 substring)를 json.loads 없이 반환하지 않음.
        - EOF 시점 in_string==True(미종결 문자열)면 EOF 후보 사용 금지 →
          절단된 마지막 필드(echoed secret/PII 노출 지점)를 절대 복구하지 않음.
        - re.search 텍스트 span 추출 금지 — 오직 종결된 prefix 의 json.loads 결과만.

        @domain ai
        @param text: Claude 원본 응답 텍스트(절단/손상 가능)
        @returns: 복구된 dict (키 1개 이상). 복구 불가 시 None.
        """
        # _strip_markdown_block 은 개행 없는 미종결 펜스(예: "```")에서 ValueError 발생.
        # 복구 헬퍼는 절대 raise 하지 않는 total 함수여야 함 (Path B 안전 envelope 보장).
        # 루트 원인(.index)은 Path A→B 라우팅이 의존하므로 건드리지 않고 여기서만 방어.
        try:
            cleaned = ClaudeClient._strip_markdown_block(text)
        except (ValueError, IndexError):
            return None
        start = cleaned.find("{")
        if start == -1:
            return None

        # walk: 문자열/이스케이프/컨테이너 깊이 추적.
        # candidates[i] = (prefix_end_exclusive, stack_after) — 해당 콤마 직전까지 닫으면
        # 종결된 쌍들만 남는 cut point. stack 은 prefix 시점에 열려있는 컨테이너 종류.
        candidates: list[tuple[int, list[str]]] = []
        stack: list[str] = []
        in_string = False
        escape = False
        for i, ch in enumerate(cleaned[start:], start):
            if escape:
                escape = False
                continue
            if ch == "\\":
                escape = True
                continue
            if ch == '"':
                in_string = not in_string
                continue
            if in_string:
                continue
            if ch in "{[":
                stack.append(ch)
            elif ch in "}]":
                if stack:
                    stack.pop()
            elif ch == "," and len(stack) == 1 and stack[0] == "{":
                # root object 내부 top-level 콤마 → 직전까지 종결된 쌍들.
                candidates.append((i, list(stack)))

        # EOF 후보: 미종결 문자열·미종결 중첩 컨테이너가 없을 때만 추가 (root 만 열림).
        # in_string==True(문자열 절단) 또는 len(stack)>1(중첩 array/object 절단)이면
        # 마지막 필드가 미종결이므로 EOF 후보를 만들지 않고 comma-boundary 후보로 폴백
        # → 절단된 필드(echoed secret/PII)는 어떤 후보에도 포함되지 않아 폐기됨.
        if not in_string and len(stack) == 1 and stack[0] == "{":
            candidates.append((len(cleaned), list(stack)))

        # 가장 뒤(가장 많이 회수) 후보부터 시도.
        for prefix_end, prefix_stack in reversed(candidates):
            prefix = cleaned[start:prefix_end].rstrip()
            prefix = prefix.rstrip(",").rstrip()
            # 열려있는 컨테이너를 역순으로 닫음.
            closing = "".join(
                "}" if opener == "{" else "]" for opener in reversed(prefix_stack)
            )
            try:
                parsed = json.loads(prefix + closing)
            except (json.JSONDecodeError, ValueError):
                continue
            if isinstance(parsed, dict) and parsed:
                return parsed
        return None

    @staticmethod
    def _fallback_result() -> dict:
        """Circuit Breaker OPEN 시 fallback 결과"""
        return {
            "feedback": "AI 분석이 일시적으로 지연되고 있습니다. 잠시 후 다시 확인해주세요.",
            "optimized_code": None,
            "score": 0,
            "status": "delayed",
            "categories": [],
        }
