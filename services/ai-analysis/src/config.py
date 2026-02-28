from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """AI Analysis Service 설정

    보안: API 키는 환경변수에서만 주입, 로그 노출 금지
    """

    rabbitmq_url: str = "amqp://algosu:change_me@localhost:5672"
    redis_url: str = "redis://localhost:6379"
    gemini_api_key: str = ""
    submission_service_url: str = "http://submission-service:3003"
    submission_service_key: str = ""
    internal_api_key: str = ""

    # Circuit Breaker
    cb_failure_threshold: int = 5
    cb_recovery_timeout: int = 30
    cb_half_open_requests: int = 2

    class Config:
        env_file = ".env"


settings = Settings()
