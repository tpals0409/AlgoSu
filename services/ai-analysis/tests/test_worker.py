"""AIAnalysisWorker 단위 테스트 (4개)

Mock: ClaudeClient, redis, httpx, pika
"""

import json
from unittest.mock import patch, MagicMock, AsyncMock

import pytest


@pytest.fixture
def mock_dependencies():
    """Worker의 모든 외부 의존성 모킹"""
    with (
        patch("src.worker.ClaudeClient") as mock_claude_cls,
        patch("src.worker.redis") as mock_redis_module,
        patch("src.worker.httpx") as mock_httpx_module,
        patch("src.worker.settings") as mock_settings,
    ):
        # ClaudeClient 모킹
        mock_claude = MagicMock()
        mock_claude.analyze_code = AsyncMock(return_value={
            "feedback": "좋은 코드입니다.",
            "optimized_code": None,
            "score": 85,
            "status": "completed",
        })
        mock_claude_cls.return_value = mock_claude

        # Redis 모킹
        mock_redis_client = MagicMock()
        mock_redis_module.from_url.return_value = mock_redis_client

        # httpx 모킹
        mock_http_client = MagicMock()
        mock_httpx_module.Client.return_value = mock_http_client

        # settings 모킹
        mock_settings.redis_url = "redis://localhost:6379"
        mock_settings.submission_service_url = "http://submission-service:3003"
        mock_settings.submission_service_key = "test-internal-key-secret"
        mock_settings.rabbitmq_url = "amqp://guest:guest@localhost:5672"

        yield {
            "claude_cls": mock_claude_cls,
            "claude": mock_claude,
            "redis_client": mock_redis_client,
            "http_client": mock_http_client,
            "settings": mock_settings,
        }


@pytest.fixture
def worker(mock_dependencies):
    """AIAnalysisWorker 인스턴스"""
    from src.worker import AIAnalysisWorker
    return AIAnalysisWorker()


@pytest.fixture
def pika_mocks():
    """pika channel/method 모킹"""
    mock_ch = MagicMock()
    mock_method = MagicMock()
    mock_method.delivery_tag = 42
    mock_properties = MagicMock()
    return mock_ch, mock_method, mock_properties


class TestOnMessageSuccess:
    """1. _on_message() -- 정상: 파싱 -> 분석 -> 결과 보고 -> Pub/Sub -> ACK"""

    def test_normal_flow_ack(self, worker, mock_dependencies, pika_mocks):
        mock_ch, mock_method, mock_properties = pika_mocks
        deps = mock_dependencies

        # _get_submission 응답 모킹
        mock_submission_resp = MagicMock()
        mock_submission_resp.json.return_value = {
            "data": {
                "code": "def solution(): return 42",
                "language": "python",
            },
        }
        mock_submission_resp.raise_for_status = MagicMock()
        deps["http_client"].get.return_value = mock_submission_resp

        # _report_result 응답 모킹 (PATCH method)
        mock_patch_resp = MagicMock()
        mock_patch_resp.raise_for_status = MagicMock()
        deps["http_client"].patch.return_value = mock_patch_resp

        body = json.dumps({"submissionId": "sub-123"}).encode()

        worker._on_message(mock_ch, mock_method, mock_properties, body)

        # 1) _get_submission 호출 확인
        deps["http_client"].get.assert_called_once()
        call_url = deps["http_client"].get.call_args[0][0]
        assert "sub-123" in call_url

        # 2) claude.analyze_code 호출 확인
        deps["claude"].analyze_code.assert_called_once()

        # 3) _report_result 호출 확인 (PATCH method)
        deps["http_client"].patch.assert_called_once()
        patch_url = deps["http_client"].patch.call_args[0][0]
        assert "sub-123" in patch_url
        assert "ai-result" in patch_url

        # 4) Redis publish 호출 확인
        deps["redis_client"].publish.assert_called_once()
        pub_channel = deps["redis_client"].publish.call_args[0][0]
        assert pub_channel == "submission:status:sub-123"

        # 5) ACK 확인
        mock_ch.basic_ack.assert_called_once_with(delivery_tag=42)
        mock_ch.basic_nack.assert_not_called()


class TestOnMessageFailure:
    """2. _on_message() -- 실패: NACK (requeue=False)"""

    def test_failure_nack_no_requeue(self, worker, mock_dependencies, pika_mocks):
        mock_ch, mock_method, mock_properties = pika_mocks
        deps = mock_dependencies

        # _get_submission에서 예외 발생
        deps["http_client"].get.side_effect = Exception("Connection refused")

        body = json.dumps({"submissionId": "sub-fail"}).encode()

        worker._on_message(mock_ch, mock_method, mock_properties, body)

        # NACK with requeue=False
        mock_ch.basic_nack.assert_called_once_with(
            delivery_tag=42, requeue=False
        )
        mock_ch.basic_ack.assert_not_called()


class TestGetSubmissionInternalKey:
    """3. _get_submission() -- X-Internal-Key 헤더 포함 확인"""

    def test_internal_key_header_included(self, worker, mock_dependencies):
        deps = mock_dependencies

        mock_resp = MagicMock()
        mock_resp.json.return_value = {"data": {"code": "x=1", "language": "python"}}
        mock_resp.raise_for_status = MagicMock()
        deps["http_client"].get.return_value = mock_resp

        worker._get_submission("sub-789")

        # GET 호출 확인
        deps["http_client"].get.assert_called_once()
        call_kwargs = deps["http_client"].get.call_args

        # URL 확인
        url = call_kwargs[0][0]
        assert url == "http://submission-service:3003/internal/sub-789"

        # X-Internal-Key 헤더 확인
        headers = call_kwargs[1]["headers"] if len(call_kwargs) > 1 and "headers" in call_kwargs[1] else call_kwargs.kwargs.get("headers", {})
        assert headers.get("X-Internal-Key") == "test-internal-key-secret"


class TestPublishStatus:
    """4. _publish_status() -- Redis publish 채널명 + 페이로드"""

    def test_publish_channel_and_payload(self, worker, mock_dependencies):
        deps = mock_dependencies

        worker._publish_status("sub-456", "completed")

        deps["redis_client"].publish.assert_called_once()
        call_args = deps["redis_client"].publish.call_args[0]

        # 채널명 확인
        channel = call_args[0]
        assert channel == "submission:status:sub-456"

        # 페이로드 확인
        payload = json.loads(call_args[1])
        assert payload["submissionId"] == "sub-456"
        assert payload["status"] == "ai_completed"
        assert "timestamp" in payload
