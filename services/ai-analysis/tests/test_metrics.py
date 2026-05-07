"""metrics 모듈 단위 테스트

_normalize_path, update_circuit_breaker_gauge, PrometheusMiddleware
"""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.metrics import (
    CB_NAME_CLAUDE_API,
    CIRCUIT_STATE_VALUES,
    PrometheusMiddleware,
    _normalize_path,
    circuit_breaker_state,
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
    """update_circuit_breaker_gauge() -- Sprint 141 TS schema 통일 (0/1/2 + name 라벨)"""

    def _gauge_value(self, name: str = CB_NAME_CLAUDE_API) -> float:
        return circuit_breaker_state.labels(name=name)._value.get()

    def test_closed_state_sets_gauge_zero(self):
        update_circuit_breaker_gauge("CLOSED")
        assert self._gauge_value() == 0.0

    def test_half_open_state_sets_gauge_one(self):
        # Sprint 141: 0.5 → 1.0 (TS STATE_CODE.halfOpen=1과 일관)
        update_circuit_breaker_gauge("HALF_OPEN")
        assert self._gauge_value() == 1.0

    def test_open_state_sets_gauge_two(self):
        # Sprint 141: 1.0 → 2.0 (TS STATE_CODE.open=2와 일관)
        update_circuit_breaker_gauge("OPEN")
        assert self._gauge_value() == 2.0

    def test_unknown_state_defaults_to_zero(self):
        update_circuit_breaker_gauge("UNKNOWN")
        assert self._gauge_value() == 0.0

    def test_default_name_is_claude_api(self):
        update_circuit_breaker_gauge("CLOSED")
        assert CB_NAME_CLAUDE_API == "claude-api"
        # default name으로 호출 시 라벨이 정상 부착됨을 검증
        assert self._gauge_value("claude-api") == 0.0

    def test_custom_name_label(self):
        # 미래 multi-CB 확장 대비: name 인자 전달 가능
        update_circuit_breaker_gauge("OPEN", name="test-cb")
        assert self._gauge_value("test-cb") == 2.0


class TestCircuitStateValues:
    """CIRCUIT_STATE_VALUES 매핑 검증 — Sprint 141 TS schema 통일 (0/1/2)"""

    def test_values(self):
        # submission/github-worker STATE_CODE와 일관: 0=CLOSED, 1=HALF_OPEN, 2=OPEN
        assert CIRCUIT_STATE_VALUES["CLOSED"] == 0.0
        assert CIRCUIT_STATE_VALUES["HALF_OPEN"] == 1.0
        assert CIRCUIT_STATE_VALUES["OPEN"] == 2.0


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
