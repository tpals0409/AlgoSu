"""
AI Analysis Service 설정

@file 환경변수 기반 서비스 설정
@domain ai
@layer config
@related ClaudeClient, AIAnalysisWorker
"""

from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """AI Analysis Service 설정

    보안:
    - API 키는 환경변수에서만 주입, 로그 노출 금지
    - internal_api_key는 기본값이 없는 필수 설정 — 미설정·빈 값 시 서비스 시작 즉시 실패
    """

    rabbitmq_url: str = "amqp://guest:guest@localhost:5672"
    redis_url: str = "redis://localhost:6379"
    anthropic_api_key: str = ""
    submission_service_url: str = "http://submission-service:3003"
    submission_service_key: str = ""
    # 필수 필드 — 기본값 없음. INTERNAL_API_KEY 환경변수 미설정 시 즉시 실패.
    # 빈 문자열로 설정하면 X-Internal-Key 인증이 무력화되므로 허용하지 않는다.
    internal_api_key: str

    # AI 일일 한도
    ai_daily_limit: int = 5

    # Circuit Breaker
    cb_failure_threshold: int = 5
    cb_recovery_timeout: int = 30
    cb_half_open_requests: int = 2

    @field_validator("internal_api_key")
    @classmethod
    def internal_api_key_must_not_be_empty(cls, v: str) -> str:
        """INTERNAL_API_KEY가 빈 문자열이면 서비스 시작을 즉시 중단한다.

        빈 키를 허용하면 X-Internal-Key 헤더 없이도 hmac.compare_digest("", "")가
        True를 반환하여 내부 API 인증 전체가 우회될 수 있다.
        """
        if not v.strip():
            raise ValueError(
                "INTERNAL_API_KEY 환경변수가 비어 있거나 공백만 포함되어 있습니다. "
                "X-Internal-Key 인증이 무력화될 수 있으므로 서비스 시작을 중단합니다."
            )
        return v

    class Config:
        env_file = ".env"


settings = Settings()
