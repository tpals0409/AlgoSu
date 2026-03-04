"""FastAPI 엔드포인트 단위 테스트

Mock: redis, worker, circuit_breaker
httpx.AsyncClient(TestClient) 사용
"""

import json
from unittest.mock import patch, MagicMock, AsyncMock

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def mock_app_deps():
    """main.py 의존성 모킹"""
    with (
        patch("src.main.redis") as mock_redis_mod,
        patch("src.main.AIAnalysisWorker") as mock_worker_cls,
        patch("src.main.circuit_breaker") as mock_cb,
        patch("src.main.update_circuit_breaker_gauge"),
        patch("src.main.settings") as mock_settings,
    ):
        mock_settings.internal_api_key = "test-key"
        mock_settings.redis_url = "redis://localhost:6379"
        mock_settings.ai_daily_limit = 5
        mock_settings.submission_service_url = "http://submission:3003"
        mock_settings.submission_service_key = "sub-key"

        mock_cb.state.value = "CLOSED"
        mock_cb.failure_count = 0
        mock_cb.can_execute.return_value = True

        mock_redis_client = MagicMock()
        mock_redis_mod.from_url.return_value = mock_redis_client

        yield {
            "cb": mock_cb,
            "settings": mock_settings,
            "redis_client": mock_redis_client,
            "worker_cls": mock_worker_cls,
        }


@pytest.fixture
def client(mock_app_deps):
    """TestClient 생성"""
    from src.main import app
    return TestClient(app, raise_server_exceptions=False)


class TestHealth:
    """GET /health"""

    def test_health_returns_ok(self, client, mock_app_deps):
        resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert "circuit_breaker" in data


class TestCircuitBreakerStatus:
    """GET /circuit-breaker/status"""

    def test_cb_status_requires_internal_key(self, client, mock_app_deps):
        resp = client.get("/circuit-breaker/status")
        assert resp.status_code == 401

    def test_cb_status_with_valid_key(self, client, mock_app_deps):
        deps = mock_app_deps
        deps["cb"].last_failure_time = 0
        deps["cb"].half_open_successes = 0

        resp = client.get(
            "/circuit-breaker/status",
            headers={"X-Internal-Key": "test-key"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "state" in data


class TestGetQuota:
    """GET /quota"""

    def test_quota_requires_internal_key(self, client, mock_app_deps):
        resp = client.get("/quota", params={"userId": "user-1"})
        assert resp.status_code == 401

    def test_quota_requires_user_id(self, client, mock_app_deps):
        resp = client.get(
            "/quota",
            headers={"X-Internal-Key": "test-key"},
        )
        assert resp.status_code == 400

    def test_quota_returns_usage(self, client, mock_app_deps):
        deps = mock_app_deps
        deps["redis_client"].get.return_value = b"3"

        # redis_client를 main 모듈에 주입
        import src.main as main_mod
        main_mod.redis_client = deps["redis_client"]

        resp = client.get(
            "/quota",
            params={"userId": "user-1"},
            headers={"X-Internal-Key": "test-key"},
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["used"] == 3
        assert data["limit"] == 5
        assert data["remaining"] == 2


class TestCheckAndIncrementQuota:
    """POST /quota/check"""

    def test_quota_check_requires_internal_key(self, client, mock_app_deps):
        resp = client.post("/quota/check", params={"userId": "user-1"})
        assert resp.status_code == 401

    def test_quota_check_allowed(self, client, mock_app_deps):
        deps = mock_app_deps
        pipe_mock = MagicMock()
        pipe_mock.execute.return_value = [2, 86000]
        deps["redis_client"].pipeline.return_value = pipe_mock

        import src.main as main_mod
        main_mod.redis_client = deps["redis_client"]

        resp = client.post(
            "/quota/check",
            params={"userId": "user-1"},
            headers={"X-Internal-Key": "test-key"},
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["allowed"] is True
        assert data["used"] == 2

    def test_quota_check_denied_over_limit(self, client, mock_app_deps):
        deps = mock_app_deps
        pipe_mock = MagicMock()
        pipe_mock.execute.return_value = [6, 86000]  # limit=5, current=6
        deps["redis_client"].pipeline.return_value = pipe_mock

        import src.main as main_mod
        main_mod.redis_client = deps["redis_client"]

        resp = client.post(
            "/quota/check",
            params={"userId": "user-1"},
            headers={"X-Internal-Key": "test-key"},
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["allowed"] is False
        deps["redis_client"].decr.assert_called()

    def test_quota_check_sets_ttl_on_first_use(self, client, mock_app_deps):
        deps = mock_app_deps
        pipe_mock = MagicMock()
        pipe_mock.execute.return_value = [1, -1]  # first use, ttl=-1
        deps["redis_client"].pipeline.return_value = pipe_mock

        import src.main as main_mod
        main_mod.redis_client = deps["redis_client"]

        resp = client.post(
            "/quota/check",
            params={"userId": "user-1"},
            headers={"X-Internal-Key": "test-key"},
        )
        assert resp.status_code == 200
        deps["redis_client"].expire.assert_called_once()

    def test_quota_check_no_redis(self, client, mock_app_deps):
        import src.main as main_mod
        main_mod.redis_client = None

        resp = client.post(
            "/quota/check",
            params={"userId": "user-1"},
            headers={"X-Internal-Key": "test-key"},
        )
        assert resp.status_code == 503


class TestHealthReady:
    """GET /health/ready"""

    def test_ready_no_worker_thread(self, client, mock_app_deps):
        """Worker 스레드가 없으면 503"""
        import src.main as main_mod
        main_mod.worker_thread = None
        main_mod.redis_client = mock_app_deps["redis_client"]

        resp = client.get("/health/ready")
        assert resp.status_code == 503
        assert "Worker" in resp.json()["detail"]

    def test_ready_worker_dead(self, client, mock_app_deps):
        """Worker 스레드가 죽어 있으면 503"""
        import src.main as main_mod
        mock_thread = MagicMock()
        mock_thread.is_alive.return_value = False
        main_mod.worker_thread = mock_thread
        main_mod.redis_client = mock_app_deps["redis_client"]

        resp = client.get("/health/ready")
        assert resp.status_code == 503

    def test_ready_redis_not_initialized(self, client, mock_app_deps):
        """Redis가 초기화되지 않으면 503"""
        import src.main as main_mod
        mock_thread = MagicMock()
        mock_thread.is_alive.return_value = True
        main_mod.worker_thread = mock_thread
        main_mod.redis_client = None

        resp = client.get("/health/ready")
        assert resp.status_code == 503
        assert "Redis" in resp.json()["detail"]

    def test_ready_redis_ping_fails(self, client, mock_app_deps):
        """Redis ping 실패 시 503"""
        import src.main as main_mod
        mock_thread = MagicMock()
        mock_thread.is_alive.return_value = True
        main_mod.worker_thread = mock_thread

        mock_redis = MagicMock()
        mock_redis.ping.side_effect = Exception("Connection refused")
        main_mod.redis_client = mock_redis

        resp = client.get("/health/ready")
        assert resp.status_code == 503
        assert "Redis" in resp.json()["detail"]

    def test_ready_all_ok(self, client, mock_app_deps):
        """모든 조건 충족 시 200"""
        import src.main as main_mod
        mock_thread = MagicMock()
        mock_thread.is_alive.return_value = True
        main_mod.worker_thread = mock_thread
        main_mod.redis_client = mock_app_deps["redis_client"]

        resp = client.get("/health/ready")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"


class TestGroupAnalysis:
    """POST /group-analysis"""

    def test_group_analysis_requires_internal_key(self, client, mock_app_deps):
        """Internal Key 없으면 401"""
        resp = client.post(
            "/group-analysis",
            json={"problem_id": "p1", "study_id": "s1", "user_id": "u1"},
        )
        assert resp.status_code == 401

    def test_group_analysis_circuit_breaker_open(self, client, mock_app_deps):
        """Circuit Breaker OPEN이면 503"""
        mock_app_deps["cb"].can_execute.return_value = False

        resp = client.post(
            "/group-analysis",
            json={"problem_id": "p1", "study_id": "s1", "user_id": "u1"},
            headers={"X-Internal-Key": "test-key"},
        )
        assert resp.status_code == 503

    def test_group_analysis_no_redis(self, client, mock_app_deps):
        """Redis 미연결 시 503"""
        import src.main as main_mod
        main_mod.redis_client = None

        resp = client.post(
            "/group-analysis",
            json={"problem_id": "p1", "study_id": "s1", "user_id": "u1"},
            headers={"X-Internal-Key": "test-key"},
        )
        assert resp.status_code == 503

    def test_group_analysis_quota_exceeded(self, client, mock_app_deps):
        """Quota 초과 시 429"""
        import src.main as main_mod
        deps = mock_app_deps
        pipe_mock = MagicMock()
        pipe_mock.execute.return_value = [6, 86000]  # limit=5, current=6
        deps["redis_client"].pipeline.return_value = pipe_mock
        main_mod.redis_client = deps["redis_client"]

        resp = client.post(
            "/group-analysis",
            json={"problem_id": "p1", "study_id": "s1", "user_id": "u1"},
            headers={"X-Internal-Key": "test-key"},
        )
        assert resp.status_code == 429
        deps["redis_client"].decr.assert_called()

    @patch("src.main.httpx")
    def test_group_analysis_submission_fetch_error(self, mock_httpx, client, mock_app_deps):
        """제출 조회 실패 시 502"""
        import src.main as main_mod
        deps = mock_app_deps
        pipe_mock = MagicMock()
        pipe_mock.execute.return_value = [1, 86000]
        deps["redis_client"].pipeline.return_value = pipe_mock
        main_mod.redis_client = deps["redis_client"]

        # AsyncClient mock이 예외 발생
        mock_async_client = AsyncMock()
        mock_async_client.get.side_effect = Exception("connection error")
        mock_async_client.__aenter__ = AsyncMock(return_value=mock_async_client)
        mock_async_client.__aexit__ = AsyncMock(return_value=False)
        mock_httpx.AsyncClient.return_value = mock_async_client

        resp = client.post(
            "/group-analysis",
            json={"problem_id": "p1", "study_id": "s1", "user_id": "u1"},
            headers={"X-Internal-Key": "test-key"},
        )
        assert resp.status_code == 502

    @patch("src.main.ClaudeClient")
    @patch("src.main.httpx")
    def test_group_analysis_no_submissions(self, mock_httpx, mock_claude_cls, client, mock_app_deps):
        """제출이 없으면 404"""
        import src.main as main_mod
        deps = mock_app_deps
        pipe_mock = MagicMock()
        pipe_mock.execute.return_value = [1, 86000]
        deps["redis_client"].pipeline.return_value = pipe_mock
        main_mod.redis_client = deps["redis_client"]

        # 빈 제출 목록 -- httpx.AsyncClient 응답은 MagicMock 사용 (json()이 동기)
        mock_resp = MagicMock()
        mock_resp.json.return_value = {"data": []}
        mock_resp.raise_for_status = MagicMock()

        mock_async_client = MagicMock()
        mock_async_client.get = AsyncMock(return_value=mock_resp)
        mock_async_client.__aenter__ = AsyncMock(return_value=mock_async_client)
        mock_async_client.__aexit__ = AsyncMock(return_value=False)
        mock_httpx.AsyncClient.return_value = mock_async_client

        resp = client.post(
            "/group-analysis",
            json={"problem_id": "p1", "study_id": "s1", "user_id": "u1"},
            headers={"X-Internal-Key": "test-key"},
        )
        assert resp.status_code == 404

    @patch("src.main.ClaudeClient")
    @patch("src.main.httpx")
    def test_group_analysis_success(self, mock_httpx, mock_claude_cls, client, mock_app_deps):
        """정상 그룹 분석"""
        import src.main as main_mod
        deps = mock_app_deps
        pipe_mock = MagicMock()
        pipe_mock.execute.return_value = [1, 86000]
        deps["redis_client"].pipeline.return_value = pipe_mock
        main_mod.redis_client = deps["redis_client"]

        # 제출 목록 -- json()은 동기 메서드이므로 MagicMock 사용
        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            "data": [
                {"language": "python", "userId": "u1", "code": "def sol(): pass"},
            ]
        }
        mock_resp.raise_for_status = MagicMock()

        mock_async_client = MagicMock()
        mock_async_client.get = AsyncMock(return_value=mock_resp)
        mock_async_client.__aenter__ = AsyncMock(return_value=mock_async_client)
        mock_async_client.__aexit__ = AsyncMock(return_value=False)
        mock_httpx.AsyncClient.return_value = mock_async_client

        # Claude 모킹
        mock_claude = MagicMock()
        mock_message = MagicMock()
        mock_message.content = [MagicMock(text='{"totalScore": 80, "summary": "Good", "categories": []}')]
        mock_claude.client.messages.create.return_value = mock_message
        mock_claude._parse_response.return_value = {
            "feedback": "Good",
            "optimized_code": None,
            "score": 80,
            "status": "completed",
        }
        mock_claude_cls.return_value = mock_claude

        resp = client.post(
            "/group-analysis",
            json={"problem_id": "p1", "study_id": "s1", "user_id": "u1"},
            headers={"X-Internal-Key": "test-key"},
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["problemId"] == "p1"
        assert data["submissionCount"] == 1

    @patch("src.main.ClaudeClient")
    @patch("src.main.httpx")
    def test_group_analysis_claude_error(self, mock_httpx, mock_claude_cls, client, mock_app_deps):
        """Claude API 실패 시 502"""
        import src.main as main_mod
        deps = mock_app_deps
        pipe_mock = MagicMock()
        pipe_mock.execute.return_value = [1, 86000]
        deps["redis_client"].pipeline.return_value = pipe_mock
        main_mod.redis_client = deps["redis_client"]

        # 제출 목록
        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            "data": [
                {"language": "python", "userId": "u1", "code": "pass"},
            ]
        }
        mock_resp.raise_for_status = MagicMock()

        mock_async_client = MagicMock()
        mock_async_client.get = AsyncMock(return_value=mock_resp)
        mock_async_client.__aenter__ = AsyncMock(return_value=mock_async_client)
        mock_async_client.__aexit__ = AsyncMock(return_value=False)
        mock_httpx.AsyncClient.return_value = mock_async_client

        # Claude 호출에서 예외 발생
        mock_claude = MagicMock()
        mock_claude.client.messages.create.side_effect = Exception("API error")
        mock_claude_cls.return_value = mock_claude

        resp = client.post(
            "/group-analysis",
            json={"problem_id": "p1", "study_id": "s1", "user_id": "u1"},
            headers={"X-Internal-Key": "test-key"},
        )
        assert resp.status_code == 502

    def test_group_analysis_first_use_sets_ttl(self, client, mock_app_deps):
        """첫 사용 시 TTL 설정"""
        import src.main as main_mod
        deps = mock_app_deps
        pipe_mock = MagicMock()
        pipe_mock.execute.return_value = [1, -1]  # ttl=-1, first use
        deps["redis_client"].pipeline.return_value = pipe_mock
        main_mod.redis_client = deps["redis_client"]

        # Circuit breaker OPEN으로 설정하면 quota 체크 후 CB 체크에서 실패
        # 대신 no_redis가 아닌 상태에서 redis 미연결 아닌 상태로 quota까지 도달
        # expire가 호출되는지 확인 - group_analysis는 quota 후 submission fetch에서 실패할 것
        with patch("src.main.httpx") as mock_httpx:
            mock_async_client = AsyncMock()
            mock_async_client.get.side_effect = Exception("conn error")
            mock_async_client.__aenter__ = AsyncMock(return_value=mock_async_client)
            mock_async_client.__aexit__ = AsyncMock(return_value=False)
            mock_httpx.AsyncClient.return_value = mock_async_client

            resp = client.post(
                "/group-analysis",
                json={"problem_id": "p1", "study_id": "s1", "user_id": "u1"},
                headers={"X-Internal-Key": "test-key"},
            )
            # TTL 설정 확인
            deps["redis_client"].expire.assert_called_once()


class TestGetQuotaXUserIdFallback:
    """GET /quota -- X-User-ID 헤더 fallback"""

    def test_quota_x_user_id_header_fallback(self, client, mock_app_deps):
        """userId 파라미터 없을 때 X-User-ID 헤더로 fallback"""
        deps = mock_app_deps
        deps["redis_client"].get.return_value = b"1"

        import src.main as main_mod
        main_mod.redis_client = deps["redis_client"]

        resp = client.get(
            "/quota",
            headers={"X-Internal-Key": "test-key", "X-User-ID": "user-from-header"},
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["used"] == 1

    def test_quota_redis_none_returns_zero(self, client, mock_app_deps):
        """Redis에 값이 없으면 used=0"""
        deps = mock_app_deps
        deps["redis_client"].get.return_value = None

        import src.main as main_mod
        main_mod.redis_client = deps["redis_client"]

        resp = client.get(
            "/quota",
            params={"userId": "user-1"},
            headers={"X-Internal-Key": "test-key"},
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["used"] == 0
