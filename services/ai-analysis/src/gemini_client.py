import logging
import google.generativeai as genai
from .config import settings
from .circuit_breaker import CircuitBreaker

logger = logging.getLogger(__name__)

# Circuit Breaker 인스턴스 (모듈 레벨 싱글톤)
circuit_breaker = CircuitBreaker(
    failure_threshold=settings.cb_failure_threshold,
    recovery_timeout=settings.cb_recovery_timeout,
    half_open_requests=settings.cb_half_open_requests,
)


class GeminiClient:
    """Gemini API 클라이언트 — Circuit Breaker 적용

    보안:
    - API Key 로그 노출 금지
    - 사용자 코드는 로그에 일부만 기록 (최대 50자)
    """

    def __init__(self):
        # API Key 설정 — 로그 노출 금지
        genai.configure(api_key=settings.gemini_api_key)
        self.model = genai.GenerativeModel("gemini-1.5-flash")

    async def analyze_code(
        self, code: str, language: str, problem_context: str = ""
    ) -> dict:
        """코드 분석 요청

        Returns:
            {
                "feedback": str,  # 개인 피드백
                "optimized_code": str | None,  # 최적화 제안
                "score": int,  # 0-100 점수
                "status": "completed" | "delayed" | "failed"
            }
        """
        if not circuit_breaker.can_execute():
            logger.warning("Circuit Breaker OPEN — fallback 반환")
            return {
                "feedback": "AI 분석이 일시적으로 지연되고 있습니다. 잠시 후 다시 확인해주세요.",
                "optimized_code": None,
                "score": 0,
                "status": "delayed",
            }

        try:
            prompt = self._build_prompt(code, language, problem_context)
            response = self.model.generate_content(prompt)

            circuit_breaker.record_success()

            # 응답 파싱 (간단 구현 — 추후 구조화)
            feedback_text = response.text if response.text else "분석 결과 없음"

            # 코드 로그: 최대 50자만 기록
            code_preview = code[:50] + "..." if len(code) > 50 else code
            logger.info(
                f"Gemini 분석 완료: language={language}, code_preview={code_preview}"
            )

            return {
                "feedback": feedback_text,
                "optimized_code": None,  # 추후 파싱 구현
                "score": 0,  # 추후 스코어링 구현
                "status": "completed",
            }
        except Exception as e:
            circuit_breaker.record_failure()
            # API Key 포함 가능성 — 에러 메시지 검열
            safe_error = str(e)[:100] if len(str(e)) > 100 else str(e)
            logger.error(f"Gemini API 오류: {safe_error}")

            return {
                "feedback": "AI 분석 중 오류가 발생했습니다.",
                "optimized_code": None,
                "score": 0,
                "status": "failed",
            }

    def _build_prompt(self, code: str, language: str, problem_context: str) -> str:
        return f"""당신은 알고리즘 코드 리뷰 전문가입니다.

다음 {language} 코드를 분석해주세요:

```{language}
{code}
```

{f"문제 컨텍스트: {problem_context}" if problem_context else ""}

다음 항목을 분석해주세요:
1. **코드 정확성**: 로직 오류가 있는지
2. **시간 복잡도**: Big-O 분석
3. **공간 복잡도**: 메모리 사용량 분석
4. **코드 품질**: 가독성, 네이밍, 구조
5. **최적화 제안**: 더 효율적인 접근법이 있다면

한국어로 답변해주세요."""
