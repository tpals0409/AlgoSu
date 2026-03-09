"""
Claude Sonnet API 클라이언트

@file Claude API 호출 + Circuit Breaker + 구조화된 응답 파싱
@domain ai
@layer service
@related prompt, circuit_breaker, metrics
"""

import json
import logging
import anthropic
from .config import settings
from .circuit_breaker import circuit_breaker
from .prompt import SYSTEM_PROMPT, build_user_prompt

logger = logging.getLogger(__name__)

# ─── CONSTANTS ────────────────────────────────

MODEL_ID = "claude-haiku-4-5-20251001"
MAX_TOKENS = 4096


class CircuitBreakerOpenError(Exception):
    """Circuit Breaker OPEN 상태 전용 예외

    Worker에서 catch하여 NACK+requeue 처리에 사용.

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

    async def analyze_code(
        self,
        code: str,
        language: str,
        problem_title: str = "",
        problem_description: str = "",
    ) -> dict:
        """
        코드 분석 요청 -- 5개 카테고리 구조화 결과 반환

        @domain ai
        @param code: 분석 대상 코드
        @param language: 프로그래밍 언어
        @param problem_title: 문제 제목
        @param problem_description: 문제 설명
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
            )

            # 동기 호출 (worker 스레드에서 실행되므로 sync 사용)
            message = self.client.messages.create(
                model=MODEL_ID,
                max_tokens=MAX_TOKENS,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": user_prompt}],
            )

            circuit_breaker.record_success()

            raw_text = message.content[0].text if message.content else ""
            result = self._parse_response(raw_text)

            code_preview = code[:50] + "..." if len(code) > 50 else code
            logger.info(
                f"Claude 분석 완료: language={language}, "
                f"score={result.get('score', 0)}, code_preview={code_preview}"
            )

            return result

        except anthropic.RateLimitError:
            circuit_breaker.record_failure()
            logger.warning("Claude API Rate Limit 초과")
            return self._fallback_result()

        except Exception as e:
            circuit_breaker.record_failure()
            safe_error = str(e)[:100]
            logger.error(f"Claude API 오류: {safe_error}")
            return {
                "feedback": "AI 분석 중 오류가 발생했습니다.",
                "optimized_code": None,
                "score": 0,
                "status": "failed",
                "categories": [],
            }

    def _parse_response(self, raw_text: str) -> dict:
        """
        Claude 응답 JSON 파싱 -- 구조화된 결과 추출

        @domain ai
        @param raw_text: Claude 원본 응답 텍스트
        @returns: 파싱된 분석 결과 dict
        """
        try:
            # 마크다운 코드 블록 제거 — 최외곽 ```json ... ``` 만 strip
            cleaned = raw_text.strip()
            if cleaned.startswith("```"):
                first_newline = cleaned.index("\n")
                # 끝에서부터 줄 단위로 ``` 를 찾아 최외곽 닫힘만 제거
                lines = cleaned.split("\n")
                end_idx = len(cleaned)
                for i in range(len(lines) - 1, 0, -1):
                    if lines[i].strip() == "```":
                        end_idx = sum(len(l) + 1 for l in lines[:i])
                        break
                cleaned = cleaned[first_newline + 1 : end_idx].strip()

            parsed = json.loads(cleaned)

            # 필수 필드 검증
            total_score = parsed.get("totalScore", 0)
            summary = parsed.get("summary", "")
            categories = parsed.get("categories", [])
            optimized_code = parsed.get("optimizedCode")

            # feedback: summary + 카테고리별 코멘트 결합
            feedback_parts = [summary]
            for cat in categories:
                name = cat.get("name", "unknown")
                score = cat.get("score", 0)
                comment = cat.get("comment", "")
                feedback_parts.append(f"[{name}: {score}점] {comment}")

            return {
                "feedback": json.dumps(parsed, ensure_ascii=False),
                "optimized_code": optimized_code,
                "score": int(total_score),
                "status": "completed",
                "categories": categories,
            }

        except (json.JSONDecodeError, ValueError, KeyError) as e:
            logger.warning(f"Claude 응답 파싱 실패: {str(e)[:100]}")
            # 파싱 실패 시에도 마크다운 블록 strip 후 저장
            fallback = raw_text.strip()
            if fallback.startswith("```"):
                fallback = fallback.split("\n", 1)[-1]  # 첫 줄 제거
                if fallback.rstrip().endswith("```"):
                    fallback = fallback.rstrip()[:-3].rstrip()
            return {
                "feedback": fallback[:50000],
                "optimized_code": None,
                "score": 0,
                "status": "completed",
                "categories": [],
            }

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
