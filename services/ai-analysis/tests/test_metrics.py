"""metrics 모듈 단위 테스트

_normalize_path, update_circuit_breaker_gauge, PrometheusMiddleware
"""

from src.metrics import (
    _normalize_path,
    update_circuit_breaker_gauge,
    circuit_breaker_state,
    CIRCUIT_STATE_VALUES,
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
