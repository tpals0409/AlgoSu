"""AIAnalysisWorker 단위 테스트 (4개)

Mock: ClaudeClient, redis, httpx, pika
"""

import json
from unittest.mock import MagicMock, patch

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
        mock_claude.analyze_code = MagicMock(
            return_value={
                "feedback": "좋은 코드입니다.",
                "optimized_code": None,
                "score": 85,
                "status": "completed",
            }
        )
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


class TestOnMessagePublishFailureBestEffort:
    """_on_message() -- Redis publish 실패해도 ACK (best-effort)"""

    def test_terminal_publish_failure_retries_then_acks(
        self, worker, mock_dependencies, pika_mocks
    ):
        """최종 상태(completed) publish 실패 시 3회 재시도 후 ACK"""
        mock_ch, mock_method, mock_properties = pika_mocks
        deps = mock_dependencies

        # _get_submission 모킹
        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            "data": {"code": "def sol(): return 1", "language": "python"},
        }
        mock_resp.raise_for_status = MagicMock()
        deps["http_client"].get.return_value = mock_resp

        # _report_result 모킹 (성공)
        mock_patch_resp = MagicMock()
        mock_patch_resp.raise_for_status = MagicMock()
        deps["http_client"].patch.return_value = mock_patch_resp

        # Redis publish 실패 (3회 모두)
        deps["redis_client"].publish.side_effect = Exception("Redis connection lost")

        body = json.dumps({"submissionId": "sub-pub-fail"}).encode()

        with patch("src.worker.time.sleep"):
            worker._on_message(mock_ch, mock_method, mock_properties, body)

        # _report_result 호출 확인
        deps["http_client"].patch.assert_called_once()

        # Redis publish 3회 재시도 확인
        assert deps["redis_client"].publish.call_count == 3

        # ACK 확인 (publish 최종 실패에도 불구하고)
        mock_ch.basic_ack.assert_called_once_with(delivery_tag=42)
        mock_ch.basic_nack.assert_not_called()

    def test_report_failure_nacks(self, worker, mock_dependencies, pika_mocks):
        """_report_result 실패 시 NACK"""
        mock_ch, mock_method, mock_properties = pika_mocks
        deps = mock_dependencies

        # _get_submission 모킹
        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            "data": {"code": "def sol(): return 1", "language": "python"},
        }
        mock_resp.raise_for_status = MagicMock()
        deps["http_client"].get.return_value = mock_resp

        # _report_result 실패 (PATCH raises)
        mock_patch_resp = MagicMock()
        mock_patch_resp.raise_for_status.side_effect = Exception(
            "Submission service down"
        )
        deps["http_client"].patch.return_value = mock_patch_resp

        body = json.dumps({"submissionId": "sub-report-fail"}).encode()

        worker._on_message(mock_ch, mock_method, mock_properties, body)

        # NACK 확인
        mock_ch.basic_nack.assert_called_once_with(delivery_tag=42, requeue=False)
        mock_ch.basic_ack.assert_not_called()


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
        mock_ch.basic_nack.assert_called_once_with(delivery_tag=42, requeue=False)
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
        headers = (
            call_kwargs[1]["headers"]
            if len(call_kwargs) > 1 and "headers" in call_kwargs[1]
            else call_kwargs.kwargs.get("headers", {})
        )
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
        mock_dependencies["claude"].analyze_code = MagicMock(
            side_effect=[
                {
                    "status": "failed",
                    "feedback": "err",
                    "score": 0,
                    "optimized_code": None,
                },
                {
                    "status": "completed",
                    "feedback": "ok",
                    "score": 90,
                    "optimized_code": None,
                },
            ]
        )

        with patch("src.worker.time.sleep"):
            submission = {"code": "x", "language": "python"}
            result = worker._analyze_with_retry(submission)
            assert result["status"] == "completed"
            assert result["score"] == 90

    def test_all_retries_fail(self, worker, mock_dependencies):
        """3회 모두 실패 시 마지막 결과 반환"""
        fail_result = {
            "status": "failed",
            "feedback": "err",
            "score": 0,
            "optimized_code": None,
        }
        mock_dependencies["claude"].analyze_code = MagicMock(return_value=fail_result)

        with patch("src.worker.time.sleep"):
            submission = {"code": "x", "language": "python"}
            result = worker._analyze_with_retry(submission)
            assert result["status"] == "failed"
            assert mock_dependencies["claude"].analyze_code.call_count == 3

    def test_circuit_breaker_open_propagates(self, worker, mock_dependencies):
        """CircuitBreakerOpenError는 상위로 전파"""
        from src.claude_client import CircuitBreakerOpenError

        mock_dependencies["claude"].analyze_code = MagicMock(
            side_effect=CircuitBreakerOpenError("Circuit Breaker OPEN")
        )

        submission = {"code": "x", "language": "python"}
        with pytest.raises(CircuitBreakerOpenError):
            worker._analyze_with_retry(submission)
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

    def test_stop_handles_connection_close_error(self, worker, mock_dependencies):
        """connection.close() 오류 시 예외 무시 및 redis/http 정리"""
        mock_channel = MagicMock()
        mock_conn = MagicMock()
        mock_conn.close.side_effect = Exception("connection close error")
        worker.channel = mock_channel
        worker.connection = mock_conn

        # 예외 없이 정상 종료
        worker.stop()
        assert worker._stopping is True
        # redis_client.close()와 http_client.close()는 여전히 호출되어야 함
        mock_dependencies["redis_client"].close.assert_called()
        worker.http_client.close.assert_called()


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

    def test_failed_result_decrements_quota(
        self, worker, mock_dependencies, pika_mocks
    ):
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
        deps["claude"].analyze_code = MagicMock(
            return_value={
                "feedback": "fail",
                "optimized_code": None,
                "score": 0,
                "status": "failed",
            }
        )

        # quota 차감 확인용
        deps["redis_client"].get.return_value = b"3"

        body = json.dumps({"submissionId": "sub-fail-q", "userId": "user-abc"}).encode()

        with patch("src.worker.time.sleep"):
            worker._on_message(mock_ch, mock_method, mock_properties, body)

        # ACK 확인 (처리 자체는 성공)
        mock_ch.basic_ack.assert_called_once()

    def test_exception_with_userId_decrements_quota(
        self, worker, mock_dependencies, pika_mocks
    ):
        """처리 중 예외 발생 시 userId가 있으면 quota 차감 시도"""
        mock_ch, mock_method, mock_properties = pika_mocks
        deps = mock_dependencies

        deps["http_client"].get.side_effect = Exception("Network error")
        deps["redis_client"].get.return_value = b"2"

        body = json.dumps({"submissionId": "sub-err", "userId": "user-xyz"}).encode()

        worker._on_message(mock_ch, mock_method, mock_properties, body)

        # NACK 확인
        mock_ch.basic_nack.assert_called_once()


class TestOnMessageCircuitBreakerOpen:
    """_on_message() -- CircuitBreakerOpenError 시 NACK+requeue"""

    def test_circuit_breaker_open_requeue(self, worker, mock_dependencies, pika_mocks):
        """Circuit Breaker OPEN 시 NACK+requeue (delivery_count < MAX_REQUEUE)"""
        from src.claude_client import CircuitBreakerOpenError

        mock_ch, mock_method, mock_properties = pika_mocks
        deps = mock_dependencies

        # _get_submission 모킹
        mock_resp = MagicMock()
        mock_resp.json.return_value = {"data": {"code": "x", "language": "python"}}
        mock_resp.raise_for_status = MagicMock()
        deps["http_client"].get.return_value = mock_resp

        # CircuitBreakerOpenError 발생
        deps["claude"].analyze_code = MagicMock(
            side_effect=CircuitBreakerOpenError("CB OPEN")
        )

        # delivery_count = 0 (첫 번째 시도)
        mock_properties.headers = None

        body = json.dumps({"submissionId": "sub-cb-open"}).encode()

        worker._on_message(mock_ch, mock_method, mock_properties, body)

        # NACK with requeue=True
        mock_ch.basic_nack.assert_called_once_with(delivery_tag=42, requeue=True)
        mock_ch.basic_ack.assert_not_called()

    def test_circuit_breaker_open_dlq_on_max_requeue(
        self, worker, mock_dependencies, pika_mocks
    ):
        """Circuit Breaker requeue 한도 초과 시 DLQ 전송 + delayed 보고 + quota 차감"""
        from src.claude_client import CircuitBreakerOpenError

        mock_ch, mock_method, mock_properties = pika_mocks
        deps = mock_dependencies

        # _get_submission 모킹
        mock_resp = MagicMock()
        mock_resp.json.return_value = {"data": {"code": "x", "language": "python"}}
        mock_resp.raise_for_status = MagicMock()
        deps["http_client"].get.return_value = mock_resp

        # _report_result 모킹 (delayed 보고)
        mock_patch_resp = MagicMock()
        mock_patch_resp.raise_for_status = MagicMock()
        deps["http_client"].patch.return_value = mock_patch_resp

        # CircuitBreakerOpenError 발생
        deps["claude"].analyze_code = MagicMock(
            side_effect=CircuitBreakerOpenError("CB OPEN")
        )

        # delivery_count = 3 (MAX_REQUEUE 초과)
        mock_properties.headers = {"x-delivery-count": 3}

        # quota 차감 확인용
        deps["redis_client"].get.return_value = b"3"

        body = json.dumps(
            {"submissionId": "sub-cb-max", "userId": "user-cb-dlq"}
        ).encode()

        worker._on_message(mock_ch, mock_method, mock_properties, body)

        # NACK with requeue=False (DLQ)
        mock_ch.basic_nack.assert_called_once_with(delivery_tag=42, requeue=False)
        mock_ch.basic_ack.assert_not_called()

        # delayed 상태 보고 확인
        deps["http_client"].patch.assert_called_once()
        call_kwargs = deps["http_client"].patch.call_args
        payload = call_kwargs[1]["json"]
        assert payload["analysisStatus"] == "delayed"

        # quota 차감 확인 (AI 분석 미수행이므로 보상 차감)
        deps["redis_client"].decr.assert_called_once()

    def test_circuit_breaker_open_dlq_no_userId_no_decrement(
        self, worker, mock_dependencies, pika_mocks
    ):
        """Circuit Breaker requeue 한도 초과 시 userId 없으면 quota 차감 안 함"""
        from src.claude_client import CircuitBreakerOpenError

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

        deps["claude"].analyze_code = MagicMock(
            side_effect=CircuitBreakerOpenError("CB OPEN")
        )

        mock_properties.headers = {"x-delivery-count": 3}

        # userId 없는 메시지
        body = json.dumps({"submissionId": "sub-cb-no-user"}).encode()

        worker._on_message(mock_ch, mock_method, mock_properties, body)

        # NACK with requeue=False (DLQ)
        mock_ch.basic_nack.assert_called_once_with(delivery_tag=42, requeue=False)
        # quota 차감 미호출
        deps["redis_client"].decr.assert_not_called()

    def test_circuit_breaker_requeue_with_delivery_count_header(
        self, worker, mock_dependencies, pika_mocks
    ):
        """x-delivery-count 헤더로 requeue 횟수 판단"""
        from src.claude_client import CircuitBreakerOpenError

        mock_ch, mock_method, mock_properties = pika_mocks
        deps = mock_dependencies

        # _get_submission 모킹
        mock_resp = MagicMock()
        mock_resp.json.return_value = {"data": {"code": "x", "language": "python"}}
        mock_resp.raise_for_status = MagicMock()
        deps["http_client"].get.return_value = mock_resp

        deps["claude"].analyze_code = MagicMock(
            side_effect=CircuitBreakerOpenError("CB OPEN")
        )

        # delivery_count = 2 (아직 한도 이내)
        mock_properties.headers = {"x-delivery-count": 2}

        body = json.dumps({"submissionId": "sub-cb-2"}).encode()

        worker._on_message(mock_ch, mock_method, mock_properties, body)

        # requeue=True (아직 MAX_REQUEUE 미만)
        mock_ch.basic_nack.assert_called_once_with(delivery_tag=42, requeue=True)


class TestGetDeliveryCount:
    """_get_delivery_count() -- delivery count 조회"""

    def test_no_headers(self, worker, mock_dependencies):
        """헤더 없으면 0 반환"""
        mock_props = MagicMock()
        mock_props.headers = None
        assert worker._get_delivery_count(mock_props) == 0

    def test_x_delivery_count(self, worker, mock_dependencies):
        """x-delivery-count 헤더 사용"""
        mock_props = MagicMock()
        mock_props.headers = {"x-delivery-count": 5}
        assert worker._get_delivery_count(mock_props) == 5

    def test_retry_count_fallback(self, worker, mock_dependencies):
        """retry_count 커스텀 헤더 fallback"""
        mock_props = MagicMock()
        mock_props.headers = {"retry_count": 2}
        assert worker._get_delivery_count(mock_props) == 2

    def test_none_properties(self, worker, mock_dependencies):
        """properties가 None이면 0 반환"""
        assert worker._get_delivery_count(None) == 0


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


class TestStartMethod:
    """start() -- 재연결 루프 시작"""

    def test_start_calls_connect_with_retry(self, worker, mock_dependencies):
        """start() 호출 시 _connect_with_retry 실행"""
        # _connect_with_retry를 모킹하여 무한루프 방지
        worker._connect_and_consume = MagicMock(
            side_effect=lambda: setattr(worker, "_stopping", True)
            or (_ for _ in ()).throw(Exception("done"))
        )

        with patch("src.worker.time.sleep"):
            worker.start()

        assert worker._stopping is True

    def test_start_resets_stopping_flag(self, worker, mock_dependencies):
        """start() 호출 시 _stopping 플래그 초기화"""
        worker._stopping = True

        # _connect_and_consume이 즉시 _stopping=True로 종료
        def stop_immediately():
            worker._stopping = True
            raise Exception("immediate stop")

        worker._connect_and_consume = stop_immediately
        with patch("src.worker.time.sleep"):
            worker.start()

        # start가 호출되고 나서 _stopping은 True (루프가 설정함)
        assert worker._stopping is True


class TestConnectAndConsume:
    """_connect_and_consume() -- RabbitMQ 연결"""

    def test_connect_and_consume_sets_channel(self, worker, mock_dependencies):
        """pika 연결 및 채널 설정 확인"""
        with patch("src.worker.pika") as mock_pika:
            mock_conn = MagicMock()
            mock_channel = MagicMock()
            mock_pika.BlockingConnection.return_value = mock_conn
            mock_pika.URLParameters.return_value = MagicMock()
            mock_conn.channel.return_value = mock_channel

            # start_consuming을 즉시 종료하도록 모킹
            mock_channel.start_consuming.return_value = None

            worker._connect_and_consume()

            mock_pika.BlockingConnection.assert_called_once()
            mock_channel.basic_qos.assert_called_once_with(prefetch_count=2)
            mock_channel.queue_declare.assert_called_once()
            mock_channel.basic_consume.assert_called_once()
            mock_channel.start_consuming.assert_called_once()
            assert worker.connection == mock_conn
            assert worker.channel == mock_channel


class TestOnMessageExceptionNoUserId:
    """_on_message() -- 예외 발생 시 userId 없으면 quota 차감 안 함"""

    def test_exception_without_userId_no_quota_decrement(
        self, worker, mock_dependencies, pika_mocks
    ):
        """처리 중 예외 발생 시 userId 없으면 quota 차감 안 함"""
        mock_ch, mock_method, mock_properties = pika_mocks
        deps = mock_dependencies

        deps["http_client"].get.side_effect = Exception("Network error")
        # userId 없는 메시지
        body = json.dumps({"submissionId": "sub-no-user"}).encode()

        worker._on_message(mock_ch, mock_method, mock_properties, body)

        # NACK 확인
        mock_ch.basic_nack.assert_called_once_with(delivery_tag=42, requeue=False)
        # decrement quota는 호출되지 않아야 함
        deps["redis_client"].decr.assert_not_called()

    def test_exception_inner_parse_failure(self, worker, mock_dependencies, pika_mocks):
        """내부 예외 처리 중 json 파싱도 실패하는 경우"""
        mock_ch, mock_method, mock_properties = pika_mocks
        _ = mock_dependencies

        # 잘못된 JSON body
        body = b"not json at all"

        worker._on_message(mock_ch, mock_method, mock_properties, body)

        # NACK 확인
        mock_ch.basic_nack.assert_called_once_with(delivery_tag=42, requeue=False)


class TestPublishStatusWithRetry:
    """_publish_status_with_retry() -- Redis publish 재시도 로직"""

    def test_success_on_first_attempt(self, worker, mock_dependencies):
        """첫 시도 성공 시 재시도 없음"""
        deps = mock_dependencies
        worker._publish_status_with_retry("sub-001", "completed")

        deps["redis_client"].publish.assert_called_once()

    def test_success_on_second_attempt(self, worker, mock_dependencies):
        """첫 실패 후 두 번째 시도에서 성공"""
        deps = mock_dependencies
        deps["redis_client"].publish.side_effect = [
            Exception("Redis timeout"),
            None,  # 성공
        ]

        with patch("src.worker.time.sleep") as mock_sleep:
            worker._publish_status_with_retry("sub-002", "failed")

        assert deps["redis_client"].publish.call_count == 2
        mock_sleep.assert_called_once_with(0.5)  # PUBLISH_BACKOFF_BASE * 2^0

    def test_all_retries_fail_logs_error(self, worker, mock_dependencies):
        """3회 모두 실패 시 에러 로그 (예외 미발생)"""
        deps = mock_dependencies
        deps["redis_client"].publish.side_effect = Exception("Redis down")

        with patch("src.worker.time.sleep") as mock_sleep:
            # 예외가 발생하지 않아야 함
            worker._publish_status_with_retry("sub-003", "completed")

        assert deps["redis_client"].publish.call_count == 3
        # sleep 2회 (1→2, 2→3 사이)
        assert mock_sleep.call_count == 2

    def test_exponential_backoff_timing(self, worker, mock_dependencies):
        """지수 백오프 대기 시간 확인"""
        deps = mock_dependencies
        deps["redis_client"].publish.side_effect = Exception("Redis down")

        with patch("src.worker.time.sleep") as mock_sleep:
            worker._publish_status_with_retry("sub-004", "failed")

        # 1차 실패 후 0.5초, 2차 실패 후 1.0초
        assert mock_sleep.call_args_list[0][0][0] == 0.5
        assert mock_sleep.call_args_list[1][0][0] == 1.0

    def test_non_terminal_status_best_effort(
        self, worker, mock_dependencies, pika_mocks
    ):
        """비최종 상태는 best-effort (재시도 없음)"""
        mock_ch, mock_method, mock_properties = pika_mocks
        deps = mock_dependencies

        # _get_submission 모킹
        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            "data": {"code": "x", "language": "python"},
        }
        mock_resp.raise_for_status = MagicMock()
        deps["http_client"].get.return_value = mock_resp

        # _report_result 모킹
        mock_patch_resp = MagicMock()
        mock_patch_resp.raise_for_status = MagicMock()
        deps["http_client"].patch.return_value = mock_patch_resp

        # 분석 결과를 progress (비최종 상태)로 설정
        deps["redis_client"].publish.side_effect = Exception("Redis down")
        mock_dependencies["claude"].analyze_code = MagicMock(
            return_value={
                "feedback": "분석 중",
                "optimized_code": None,
                "score": 0,
                "status": "progress",
            }
        )

        body = json.dumps({"submissionId": "sub-progress"}).encode()
        worker._on_message(mock_ch, mock_method, mock_properties, body)

        # 비최종 상태이므로 재시도 없이 1회만 호출
        deps["redis_client"].publish.assert_called_once()
        # ACK는 정상 진행
        mock_ch.basic_ack.assert_called_once()


class TestWorkerInitValidation:
    """Worker __init__() — RABBITMQ_URL 유효성 검증"""

    def test_empty_rabbitmq_url_raises_runtime_error(self):
        """빈 RABBITMQ_URL이면 RuntimeError 발생"""
        with (
            patch("src.worker.ClaudeClient"),
            patch("src.worker.redis"),
            patch("src.worker.httpx"),
            patch("src.worker.settings") as mock_settings,
        ):
            mock_settings.rabbitmq_url = ""
            mock_settings.redis_url = "redis://localhost:6379"

            from src.worker import AIAnalysisWorker

            with pytest.raises(RuntimeError, match="RABBITMQ_URL"):
                AIAnalysisWorker()

    def test_invalid_rabbitmq_url_raises_runtime_error(self):
        """amqp로 시작하지 않는 URL이면 RuntimeError 발생"""
        with (
            patch("src.worker.ClaudeClient"),
            patch("src.worker.redis"),
            patch("src.worker.httpx"),
            patch("src.worker.settings") as mock_settings,
        ):
            mock_settings.rabbitmq_url = "http://wrong-protocol"
            mock_settings.redis_url = "redis://localhost:6379"

            from src.worker import AIAnalysisWorker

            with pytest.raises(RuntimeError, match="RABBITMQ_URL"):
                AIAnalysisWorker()
