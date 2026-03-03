"""
AI Analysis Service 설정

@file 환경변수 기반 서비스 설정
@domain ai
@layer config
@related ClaudeClient, AIAnalysisWorker
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """AI Analysis Service 설정

    보안: API 키는 환경변수에서만 주입, 로그 노출 금지
    """

    rabbitmq_url: str = "amqp://algosu:change_me@localhost:5672"
    redis_url: str = "redis://localhost:6379"
    anthropic_api_key: str = ""
    submission_service_url: str = "http://submission-service:3003"
    submission_service_key: str = ""
    internal_api_key: str = ""

    # AI 일일 한도
    ai_daily_limit: int = 5

    # Circuit Breaker
    cb_failure_threshold: int = 5
    cb_recovery_timeout: int = 30
    cb_half_open_requests: int = 2

    class Config:
        env_file = ".env"


settings = Settings()
