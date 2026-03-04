"""logger 모듈 단위 테스트

sanitize_str, mask_ip, mask_email, sanitize_headers, JsonFormatter, log_http
"""

import json
import logging
from unittest.mock import patch

from src.logger import (
    sanitize_str,
    mask_ip,
    mask_email,
    sanitize_headers,
    JsonFormatter,
    setup_logging,
    log_http,
)


class TestSanitizeStr:
    """sanitize_str() -- 제어문자 제거 + truncate"""

    def test_removes_control_chars(self):
        assert sanitize_str("hello\x00world\n") == "helloworld"

    def test_truncates_long_string(self):
        result = sanitize_str("a" * 600, max_len=500)
        assert len(result) == 500

    def test_normal_string_unchanged(self):
        assert sanitize_str("hello world") == "hello world"


class TestMaskIp:
    """mask_ip() -- 마지막 옥텟 마스킹"""

    def test_ipv4_mask(self):
        assert mask_ip("192.168.1.100") == "192.168.1.**"

    def test_no_dot_returns_as_is(self):
        assert mask_ip("localhost") == "localhost"


class TestMaskEmail:
    """mask_email() -- 앞 2자 + ** 마스킹"""

    def test_normal_email(self):
        assert mask_email("user@example.com") == "us**@example.com"

    def test_no_at_sign(self):
        assert mask_email("noemail") == "**"

    def test_short_local(self):
        assert mask_email("a@x.com") == "a**@x.com"


class TestSanitizeHeaders:
    """sanitize_headers() -- 민감 헤더 마스킹"""

    def test_redacts_sensitive_headers(self):
        headers = {
            "Authorization": "Bearer token123",
            "X-Internal-Key": "secret-key",
            "Cookie": "session=abc",
            "Content-Type": "application/json",
        }
        result = sanitize_headers(headers)
        assert result["Authorization"] == "[REDACTED]"
        assert result["X-Internal-Key"] == "[REDACTED]"
        assert result["Cookie"] == "[REDACTED]"
        assert result["Content-Type"] == "application/json"


class TestJsonFormatter:
    """JsonFormatter -- JSON 로그 포맷 검증"""

    def test_format_basic_record(self):
        formatter = JsonFormatter()
        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="test.py",
            lineno=1,
            msg="테스트 메시지",
            args=None,
            exc_info=None,
        )
        output = formatter.format(record)
        parsed = json.loads(output)
        assert parsed["level"] == "info"
        assert parsed["message"] == "테스트 메시지"
        assert parsed["service"] == "ai-analysis"
        assert "ts" in parsed

    def test_format_error_with_exception(self):
        formatter = JsonFormatter()
        try:
            raise ValueError("test error")
        except ValueError:
            import sys
            exc_info = sys.exc_info()

        record = logging.LogRecord(
            name="test",
            level=logging.ERROR,
            pathname="test.py",
            lineno=1,
            msg="에러 발생",
            args=None,
            exc_info=exc_info,
        )
        output = formatter.format(record)
        parsed = json.loads(output)
        assert parsed["level"] == "error"
        assert "error" in parsed
        assert parsed["error"]["name"] == "ValueError"

    def test_format_with_extra_fields(self):
        formatter = JsonFormatter()
        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="test.py",
            lineno=1,
            msg="extra test",
            args=None,
            exc_info=None,
        )
        record.tag = "HTTP_REQUEST"
        record.method = "GET"
        record.path = "/health"
        output = formatter.format(record)
        parsed = json.loads(output)
        assert parsed["tag"] == "HTTP_REQUEST"
        assert parsed["method"] == "GET"
        assert parsed["path"] == "/health"

    def test_level_map_warning(self):
        formatter = JsonFormatter()
        record = logging.LogRecord(
            name="test",
            level=logging.WARNING,
            pathname="test.py",
            lineno=1,
            msg="warn",
            args=None,
            exc_info=None,
        )
        output = formatter.format(record)
        parsed = json.loads(output)
        assert parsed["level"] == "warn"

    def test_level_map_critical(self):
        formatter = JsonFormatter()
        record = logging.LogRecord(
            name="test",
            level=logging.CRITICAL,
            pathname="test.py",
            lineno=1,
            msg="critical",
            args=None,
            exc_info=None,
        )
        output = formatter.format(record)
        parsed = json.loads(output)
        assert parsed["level"] == "error"  # CRITICAL -> error


class TestSetupLogging:
    """setup_logging() -- 로깅 초기화"""

    def test_setup_logging_configures_root_logger(self):
        setup_logging()
        root = logging.getLogger()
        assert len(root.handlers) > 0
        assert isinstance(root.handlers[0].formatter, JsonFormatter)


class TestLogHttp:
    """log_http() -- HTTP 구조화 로그"""

    def test_log_http_info_level(self):
        mock_logger = logging.getLogger("test-log-http")
        with patch.object(mock_logger, "log") as mock_log:
            log_http(
                method="GET",
                path="/health",
                status_code=200,
                latency_ms=5.0,
                logger=mock_logger,
            )
            mock_log.assert_called_once()
            assert mock_log.call_args[0][0] == logging.INFO

    def test_log_http_warning_for_4xx(self):
        mock_logger = logging.getLogger("test-log-http-4xx")
        with patch.object(mock_logger, "log") as mock_log:
            log_http(
                method="GET",
                path="/not-found",
                status_code=404,
                latency_ms=2.0,
                logger=mock_logger,
            )
            assert mock_log.call_args[0][0] == logging.WARNING

    def test_log_http_error_for_5xx(self):
        mock_logger = logging.getLogger("test-log-http-5xx")
        with patch.object(mock_logger, "log") as mock_log:
            log_http(
                method="POST",
                path="/error",
                status_code=500,
                latency_ms=100.0,
                logger=mock_logger,
            )
            assert mock_log.call_args[0][0] == logging.ERROR

    def test_log_http_with_user_info(self):
        mock_logger = logging.getLogger("test-log-http-user")
        with patch.object(mock_logger, "log") as mock_log:
            log_http(
                method="GET",
                path="/api/test",
                status_code=200,
                latency_ms=3.0,
                ip="192.168.1.100",
                user_id="user-123",
                logger=mock_logger,
            )
            extra = mock_log.call_args[1]["extra"]
            assert extra["ip"] == "192.168.1.**"
            assert extra["userId"] == "user-123"
