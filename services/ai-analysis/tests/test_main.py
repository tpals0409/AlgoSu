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
