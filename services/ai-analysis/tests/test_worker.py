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


class TestAnalyzeWithRetry:
    """_analyze_with_retry() -- 재시도 로직"""

    def test_first_attempt_success(self, worker, mock_dependencies):
        """첫 시도 성공 시 즉시 반환"""
        submission = {
            "code": "def sol(): return 1",
            "language": "python",
            "problemTitle": "Two Sum",
            "problemDescription": "desc",
        }
        result = worker._analyze_with_retry(submission)
        assert result["status"] == "completed"
        assert result["score"] == 85
        mock_dependencies["claude"].analyze_code.assert_called_once()

    def test_retry_on_failure_then_success(self, worker, mock_dependencies):
        """실패 후 재시도에서 성공"""
        mock_dependencies["claude"].analyze_code = AsyncMock(side_effect=[
            {"status": "failed", "feedback": "err", "score": 0, "optimized_code": None},
            {"status": "completed", "feedback": "ok", "score": 90, "optimized_code": None},
        ])

        with patch("src.worker.time.sleep"):
            submission = {"code": "x", "language": "python"}
            result = worker._analyze_with_retry(submission)
            assert result["status"] == "completed"
            assert result["score"] == 90

    def test_all_retries_fail(self, worker, mock_dependencies):
        """3회 모두 실패 시 마지막 결과 반환"""
        fail_result = {"status": "failed", "feedback": "err", "score": 0, "optimized_code": None}
        mock_dependencies["claude"].analyze_code = AsyncMock(return_value=fail_result)

        with patch("src.worker.time.sleep"):
            submission = {"code": "x", "language": "python"}
            result = worker._analyze_with_retry(submission)
            assert result["status"] == "failed"
            assert mock_dependencies["claude"].analyze_code.call_count == 3

    def test_delayed_status_returns_immediately(self, worker, mock_dependencies):
        """delayed 상태도 즉시 반환"""
        mock_dependencies["claude"].analyze_code = AsyncMock(return_value={
            "status": "delayed", "feedback": "later", "score": 0, "optimized_code": None,
        })

        submission = {"code": "x", "language": "python"}
        result = worker._analyze_with_retry(submission)
        assert result["status"] == "delayed"
        mock_dependencies["claude"].analyze_code.assert_called_once()


class TestDecrementQuota:
    """_decrement_quota() -- Redis 한도 차감"""

    def test_decrement_when_positive(self, worker, mock_dependencies):
        """카운터가 양수일 때 차감"""
        mock_dependencies["redis_client"].get.return_value = b"3"
        worker._decrement_quota("user-123")
        mock_dependencies["redis_client"].decr.assert_called_once()

    def test_no_decrement_when_zero(self, worker, mock_dependencies):
        """카운터가 0이면 차감하지 않음"""
        mock_dependencies["redis_client"].get.return_value = b"0"
        worker._decrement_quota("user-123")
        mock_dependencies["redis_client"].decr.assert_not_called()

    def test_no_decrement_when_none(self, worker, mock_dependencies):
        """값이 없으면 차감하지 않음"""
        mock_dependencies["redis_client"].get.return_value = None
        worker._decrement_quota("user-123")
        mock_dependencies["redis_client"].decr.assert_not_called()

    def test_decrement_handles_redis_error(self, worker, mock_dependencies):
        """Redis 오류 시 예외 무시"""
        mock_dependencies["redis_client"].get.side_effect = Exception("Redis down")
        # 예외가 발생하지 않아야 함
        worker._decrement_quota("user-123")


class TestWorkerStop:
    """stop() -- Graceful Shutdown"""

    def test_stop_sets_stopping_flag(self, worker, mock_dependencies):
        """stop 호출 시 _stopping 플래그 설정"""
        worker.stop()
        assert worker._stopping is True

    def test_stop_closes_resources(self, worker, mock_dependencies):
        """stop 호출 시 리소스 정리"""
        mock_channel = MagicMock()
        mock_conn = MagicMock()
        worker.channel = mock_channel
        worker.connection = mock_conn

        worker.stop()

        mock_channel.stop_consuming.assert_called_once()
        mock_conn.close.assert_called_once()
        mock_dependencies["redis_client"].close.assert_called()

    def test_stop_handles_channel_error(self, worker, mock_dependencies):
        """채널 오류 시 예외 무시"""
        mock_channel = MagicMock()
        mock_channel.stop_consuming.side_effect = Exception("already closed")
        worker.channel = mock_channel
        worker.connection = MagicMock()

        # 예외가 발생하지 않아야 함
        worker.stop()
        assert worker._stopping is True

    def test_stop_no_channel(self, worker, mock_dependencies):
        """채널이 없을 때도 정상 종료"""
        worker.channel = None
        worker.connection = None
        worker.stop()
        assert worker._stopping is True


class TestCleanupConnection:
    """_cleanup_connection() -- 연결 정리"""

    def test_cleanup_closes_channel_and_connection(self, worker, mock_dependencies):
        """채널과 연결 모두 정리"""
        mock_channel = MagicMock()
        mock_conn = MagicMock()
        worker.channel = mock_channel
        worker.connection = mock_conn

        worker._cleanup_connection()

        mock_channel.close.assert_called_once()
        mock_conn.close.assert_called_once()
        assert worker.channel is None
        assert worker.connection is None

    def test_cleanup_handles_close_error(self, worker, mock_dependencies):
        """close 오류 시 예외 무시"""
        mock_channel = MagicMock()
        mock_channel.close.side_effect = Exception("error")
        mock_conn = MagicMock()
        mock_conn.close.side_effect = Exception("error")
        worker.channel = mock_channel
        worker.connection = mock_conn

        worker._cleanup_connection()
        assert worker.channel is None
        assert worker.connection is None

    def test_cleanup_with_none(self, worker, mock_dependencies):
        """None일 때도 정상 동작"""
        worker.channel = None
        worker.connection = None
        worker._cleanup_connection()
        assert worker.channel is None


class TestReportResult:
    """_report_result() -- 결과 보고"""

    def test_report_sends_correct_payload(self, worker, mock_dependencies):
        """올바른 페이로드 전송"""
        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        mock_dependencies["http_client"].patch.return_value = mock_resp

        result = {
            "feedback": "잘 작성된 코드입니다.",
            "score": 85,
            "optimized_code": "optimized",
            "status": "completed",
        }
        worker._report_result("sub-999", result)

        mock_dependencies["http_client"].patch.assert_called_once()
        call_kwargs = mock_dependencies["http_client"].patch.call_args
        url = call_kwargs[0][0]
        assert "sub-999" in url
        assert "ai-result" in url
        payload = call_kwargs[1]["json"]
        assert payload["feedback"] == "잘 작성된 코드입니다."
        assert payload["score"] == 85
        assert payload["analysisStatus"] == "completed"


class TestOnMessageWithUserId:
    """_on_message() -- userId 포함 메시지 처리"""

    def test_failed_result_decrements_quota(self, worker, mock_dependencies, pika_mocks):
        """분석 실패 시 quota 차감"""
        mock_ch, mock_method, mock_properties = pika_mocks
        deps = mock_dependencies

        # _get_submission 모킹
        mock_resp = MagicMock()
        mock_resp.json.return_value = {"data": {"code": "x", "language": "python"}}
        mock_resp.raise_for_status = MagicMock()
        deps["http_client"].get.return_value = mock_resp

        # _report_result 모킹
        mock_patch_resp = MagicMock()
        mock_patch_resp.raise_for_status = MagicMock()
        deps["http_client"].patch.return_value = mock_patch_resp

        # 분석 실패 반환
        deps["claude"].analyze_code = AsyncMock(return_value={
            "feedback": "fail", "optimized_code": None, "score": 0, "status": "failed",
        })

        # quota 차감 확인용
        deps["redis_client"].get.return_value = b"3"

        body = json.dumps({"submissionId": "sub-fail-q", "userId": "user-abc"}).encode()

        with patch("src.worker.time.sleep"):
            worker._on_message(mock_ch, mock_method, mock_properties, body)

        # ACK 확인 (처리 자체는 성공)
        mock_ch.basic_ack.assert_called_once()

    def test_exception_with_userId_decrements_quota(self, worker, mock_dependencies, pika_mocks):
        """처리 중 예외 발생 시 userId가 있으면 quota 차감 시도"""
        mock_ch, mock_method, mock_properties = pika_mocks
        deps = mock_dependencies

        deps["http_client"].get.side_effect = Exception("Network error")
        deps["redis_client"].get.return_value = b"2"

        body = json.dumps({"submissionId": "sub-err", "userId": "user-xyz"}).encode()

        worker._on_message(mock_ch, mock_method, mock_properties, body)

        # NACK 확인
        mock_ch.basic_nack.assert_called_once()


class TestConnectWithRetry:
    """_connect_with_retry() -- 재연결 로직"""

    def test_stops_when_stopping_flag(self, worker, mock_dependencies):
        """_stopping=True면 즉시 종료"""
        worker._stopping = True
        # 무한루프에 빠지지 않아야 함
        worker._connect_with_retry()

    def test_retries_on_exception(self, worker, mock_dependencies):
        """연결 실패 시 재시도"""
        call_count = 0

        def mock_connect():
            nonlocal call_count
            call_count += 1
            if call_count >= 2:
                worker._stopping = True
            raise Exception("Connection refused")

        worker._connect_and_consume = mock_connect
        with patch("src.worker.time.sleep"):
            worker._connect_with_retry()

        assert call_count == 2
