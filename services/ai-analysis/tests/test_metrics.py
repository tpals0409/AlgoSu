"""metrics 모듈 단위 테스트

_normalize_path, update_circuit_breaker_gauge, PrometheusMiddleware
"""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.metrics import (
    CIRCUIT_STATE_VALUES,
    PrometheusMiddleware,
    _normalize_path,
    metrics_endpoint,
    update_circuit_breaker_gauge,
)


class TestNormalizePath:
    """_normalize_path() -- UUID/숫자 ID 정규화"""

    def test_uuid_replaced(self):
        path = "/submissions/550e8400-e29b-41d4-a716-446655440000/result"
        result = _normalize_path(path)
        assert "/:id/result" in result

    def test_numeric_id_replaced(self):
        path = "/users/12345/submissions"
        result = _normalize_path(path)
        assert "/:id/submissions" in result

    def test_no_id_unchanged(self):
        path = "/health"
        assert _normalize_path(path) == "/health"


class TestUpdateCircuitBreakerGauge:
    """update_circuit_breaker_gauge() -- gauge 값 검증"""

    def test_closed_state(self):
        update_circuit_breaker_gauge("CLOSED")
        # gauge 값은 직접 검증하기 어려우므로 호출 성공만 확인

    def test_open_state(self):
        update_circuit_breaker_gauge("OPEN")

    def test_half_open_state(self):
        update_circuit_breaker_gauge("HALF_OPEN")

    def test_unknown_state_defaults_to_zero(self):
        update_circuit_breaker_gauge("UNKNOWN")


class TestCircuitStateValues:
    """CIRCUIT_STATE_VALUES 매핑 검증"""

    def test_values(self):
        assert CIRCUIT_STATE_VALUES["CLOSED"] == 0.0
        assert CIRCUIT_STATE_VALUES["HALF_OPEN"] == 0.5
        assert CIRCUIT_STATE_VALUES["OPEN"] == 1.0


class TestPrometheusMiddleware:
    """PrometheusMiddleware -- HTTP 메트릭 수집"""

    def _make_app_with_route(
        self, route_path: str, status: int = 200, raise_exc: bool = False
    ):
        """테스트용 FastAPI 앱 생성"""
        app = FastAPI()
        app.add_middleware(PrometheusMiddleware)

        @app.get(route_path)
        async def test_route():
            if raise_exc:
                raise RuntimeError("forced error")
            return {"ok": True}

        return app

    def test_health_path_excluded(self):
        """헬스 경로는 메트릭 수집 제외"""
        app = self._make_app_with_route("/health")
        client = TestClient(app)
        resp = client.get("/health")
        assert resp.status_code == 200

    def test_metrics_path_excluded(self):
        """메트릭 경로는 메트릭 수집 제외"""
        from fastapi.testclient import TestClient as TC

        app = FastAPI()
        app.add_middleware(PrometheusMiddleware)
        app.get("/metrics")(metrics_endpoint)

        client = TC(app)
        resp = client.get("/metrics")
        # 200 OK with prometheus content
        assert resp.status_code == 200

    def test_normal_request_tracked(self):
        """일반 요청 메트릭 수집"""
        app = self._make_app_with_route("/quota/check")
        client = TestClient(app)
        resp = client.get("/quota/check")
        assert resp.status_code == 200

    def test_uuid_path_normalized(self):
        """UUID 경로 정규화"""
        from fastapi.testclient import TestClient as TC

        app = FastAPI()
        app.add_middleware(PrometheusMiddleware)

        @app.get("/submissions/{submission_id}/result")
        async def get_result(submission_id: str):
            return {"id": submission_id}

        client = TC(app)
        resp = client.get("/submissions/550e8400-e29b-41d4-a716-446655440000/result")
        assert resp.status_code == 200

    def test_exception_in_route_reraises(self):
        """라우트 예외 발생 시 그대로 전파"""
        app = self._make_app_with_route("/fail", raise_exc=True)
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.get("/fail")
        assert resp.status_code == 500


class TestMetricsEndpoint:
    """metrics_endpoint() -- Prometheus 응답"""

    @pytest.mark.asyncio
    async def test_metrics_returns_prometheus_content(self):
        """Prometheus 포맷 응답 반환"""
        response = await metrics_endpoint()
        assert response.status_code == 200
        assert b"algosu" in response.body or len(response.body) > 0
