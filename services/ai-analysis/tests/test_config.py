"""config 모듈 단위 테스트

@file Settings 기본값 검증 + internal_api_key 필수 필드 보안 검증
@domain ai
@layer test
@related src/config.py
"""

import pytest
from pydantic import ValidationError

from src.config import Settings


class TestSettingsDefaults:
    """Settings 기본값 검증"""

    def test_default_values(self, monkeypatch):
        """환경변수가 제공된 경우 기본값이 올바르게 설정된다."""
        monkeypatch.setenv("INTERNAL_API_KEY", "test-key-abc123")
        s = Settings()
        assert s.rabbitmq_url == "amqp://guest:guest@localhost:5672"
        assert s.redis_url == "redis://localhost:6379"
        assert s.anthropic_api_key == ""
        assert s.ai_daily_limit == 5
        assert s.cb_failure_threshold == 5
        assert s.cb_recovery_timeout == 30
        assert s.cb_half_open_requests == 2
        assert s.internal_api_key == "test-key-abc123"


class TestInternalApiKeyValidation:
    """internal_api_key 필수 필드 보안 검증

    P0 보안 취약점 방어:
    빈 문자열 키를 허용하면 hmac.compare_digest("", "") == True가 되어
    X-Internal-Key 헤더 없이도 내부 API 인증이 통과된다.
    """

    def test_empty_string_raises_validation_error(self, monkeypatch):
        """INTERNAL_API_KEY="" 빈 문자열이면 시작 즉시 ValidationError 발생."""
        monkeypatch.setenv("INTERNAL_API_KEY", "")
        with pytest.raises(ValidationError) as exc_info:
            Settings()
        assert "INTERNAL_API_KEY" in str(exc_info.value)

    def test_missing_env_var_raises_validation_error(self, monkeypatch):
        """INTERNAL_API_KEY 환경변수 미설정 시 ValidationError 발생 (필수 필드)."""
        monkeypatch.delenv("INTERNAL_API_KEY", raising=False)
        with pytest.raises(ValidationError):
            Settings()

    def test_valid_key_accepted(self, monkeypatch):
        """유효한 키(non-empty)는 정상 수용된다."""
        monkeypatch.setenv("INTERNAL_API_KEY", "secure-production-key-xyz")
        s = Settings()
        assert s.internal_api_key == "secure-production-key-xyz"

    def test_whitespace_only_raises_validation_error(self, monkeypatch):
        """공백 문자만 포함된 키도 거부된다."""
        monkeypatch.setenv("INTERNAL_API_KEY", "   ")
        with pytest.raises(ValidationError):
            Settings()
