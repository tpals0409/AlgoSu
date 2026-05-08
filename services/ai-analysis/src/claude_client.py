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
    get_group_system_prompt,
    get_system_prompt,
    get_weights,
)

logger = logging.getLogger(__name__)

# ─── CONSTANTS ────────────────────────────────

MODEL_ID = "claude-haiku-4-5-20251001"
MAX_TOKENS = 8192


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
                weights = get_weights(language)
                weighted_sum = sum(
                    cat.get("score", 0) * weights.get(cat.get("name", ""), 0)
                    for cat in categories
                )
                if weighted_sum > 0:
                    score = round(weighted_sum)

            return {
                "feedback": json.dumps(parsed, ensure_ascii=False),
                "optimized_code": optimized_code,
                "score": score,
                "status": "completed",
                "categories": categories,
            }

        except (json.JSONDecodeError, ValueError, KeyError) as e:
            logger.warning("Claude 응답 파싱 실패", extra={"error": str(e)[:100]})
            # 파싱 실패 시에도 마크다운 블록 strip 후 저장
            fallback = raw_text.strip()
            if fallback.startswith("```"):
                fallback = fallback.split("\n", 1)[-1]  # 첫 줄 제거
                if fallback.rstrip().endswith("```"):
                    fallback = fallback.rstrip()[:-3].rstrip()

            # 원본 텍스트에서 totalScore 추출 시도 (정규식 fallback)
            score = 0
            score_match = re.search(r'"totalScore"\s*:\s*(\d+)', raw_text)
            if score_match:
                score = int(score_match.group(1))
                logger.info(
                    "파싱 실패 fallback -- totalScore 정규식 추출",
                    extra={"score": score},
                )

            # score가 추출되면 분석 자체는 성공 — JSON 파싱만 실패한 것
            status = "completed" if score > 0 else "failed"
            if status == "completed":
                logger.info(
                    "파싱 실패하였으나 score 추출 성공 -- completed 처리",
                    extra={"score": score},
                )

            return {
                "feedback": fallback[:50000],
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
            logger.warning("그룹 분석 응답 파싱 실패", extra={"error": str(e)[:100]})
            fallback = raw_text.strip()
            if fallback.startswith("```"):
                fallback = fallback.split("\n", 1)[-1]
                if fallback.rstrip().endswith("```"):
                    fallback = fallback.rstrip()[:-3].rstrip()

            return {
                "comparison": fallback[:50000],
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
    def _fallback_result() -> dict:
        """Circuit Breaker OPEN 시 fallback 결과"""
        return {
            "feedback": "AI 분석이 일시적으로 지연되고 있습니다. 잠시 후 다시 확인해주세요.",
            "optimized_code": None,
            "score": 0,
            "status": "delayed",
            "categories": [],
        }
