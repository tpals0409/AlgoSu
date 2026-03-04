"""config 모듈 단위 테스트

Settings 기본값 검증
"""

from src.config import Settings


class TestSettingsDefaults:
    """Settings 기본값 검증"""

    def test_default_values(self):
        s = Settings()
        assert s.rabbitmq_url == "amqp://algosu:change_me@localhost:5672"
        assert s.redis_url == "redis://localhost:6379"
        assert s.anthropic_api_key == ""
        assert s.ai_daily_limit == 5
        assert s.cb_failure_threshold == 5
        assert s.cb_recovery_timeout == 30
        assert s.cb_half_open_requests == 2
