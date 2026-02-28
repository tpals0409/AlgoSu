"""CircuitBreaker 단위 테스트 (10개)

CircuitBreaker 클래스만 직접 import하여 테스트.
모듈 레벨 싱글턴(circuit_breaker)은 테스트 대상 아님.
"""

import time
from unittest.mock import patch

import pytest

from src.circuit_breaker import CircuitBreaker, CircuitState


@pytest.fixture
def cb() -> CircuitBreaker:
    """기본 CircuitBreaker (threshold=5, timeout=30, half_open=2)"""
    return CircuitBreaker(
        failure_threshold=5,
        recovery_timeout=30,
        half_open_requests=2,
    )


class TestCircuitBreakerInitialState:
    """1. 초기 상태 검증"""

    def test_initial_state_is_closed(self, cb: CircuitBreaker):
        assert cb.state == CircuitState.CLOSED
        assert cb.failure_count == 0
        assert cb.success_count == 0
        assert cb.half_open_successes == 0
        assert cb.last_failure_time == 0


class TestRecordSuccess:
    """2. record_success() -- CLOSED 상태에서 failure_count 리셋"""

    def test_success_resets_failure_count_in_closed(self, cb: CircuitBreaker):
        cb.failure_count = 3
        cb.record_success()
        assert cb.failure_count == 0
        assert cb.state == CircuitState.CLOSED


class TestRecordFailureBelowThreshold:
    """3. record_failure() -- threshold 미만: 상태 유지"""

    def test_failure_below_threshold_keeps_closed(self, cb: CircuitBreaker):
        for _ in range(4):  # threshold=5이므로 4회는 미만
            cb.record_failure()

        assert cb.failure_count == 4
        assert cb.state == CircuitState.CLOSED


class TestRecordFailureAtThreshold:
    """4. record_failure() -- threshold 도달: OPEN 전환"""

    def test_failure_at_threshold_opens_circuit(self, cb: CircuitBreaker):
        for _ in range(5):  # threshold=5
            cb.record_failure()

        assert cb.state == CircuitState.OPEN
        assert cb.failure_count == 5


class TestIsOpenBeforeTimeout:
    """5. is_open -- OPEN + timeout 미경과: True"""

    def test_is_open_before_timeout(self, cb: CircuitBreaker):
        # OPEN 상태 만들기
        for _ in range(5):
            cb.record_failure()

        assert cb.state == CircuitState.OPEN
        assert cb.is_open is True


class TestIsOpenAfterTimeout:
    """6. is_open -- OPEN + timeout 경과: HALF_OPEN 전환"""

    def test_is_open_transitions_to_half_open_after_timeout(self, cb: CircuitBreaker):
        # OPEN 상태 만들기
        for _ in range(5):
            cb.record_failure()

        assert cb.state == CircuitState.OPEN

        # timeout 경과 시뮬레이션
        with patch("src.circuit_breaker.time") as mock_time:
            mock_time.time.return_value = cb.last_failure_time + 31  # 30초 초과
            result = cb.is_open

        assert result is False
        assert cb.state == CircuitState.HALF_OPEN
        assert cb.half_open_successes == 0


class TestHalfOpenToClosedOnSuccess:
    """7. record_success() -- HALF_OPEN -> threshold 도달 -> CLOSED"""

    def test_half_open_successes_close_circuit(self, cb: CircuitBreaker):
        # HALF_OPEN 상태 만들기
        cb.state = CircuitState.HALF_OPEN
        cb.half_open_successes = 0

        # half_open_requests=2 만큼 성공
        cb.record_success()
        assert cb.state == CircuitState.HALF_OPEN
        assert cb.half_open_successes == 1

        cb.record_success()
        assert cb.state == CircuitState.CLOSED
        assert cb.failure_count == 0
        assert cb.half_open_successes == 0


class TestHalfOpenToOpenOnFailure:
    """8. record_failure() -- HALF_OPEN -> OPEN"""

    def test_half_open_failure_reopens_circuit(self, cb: CircuitBreaker):
        cb.state = CircuitState.HALF_OPEN

        cb.record_failure()

        assert cb.state == CircuitState.OPEN


class TestCanExecuteClosed:
    """9. can_execute() -- CLOSED: True"""

    def test_can_execute_when_closed(self, cb: CircuitBreaker):
        assert cb.state == CircuitState.CLOSED
        assert cb.can_execute() is True


class TestCanExecuteOpen:
    """10. can_execute() -- OPEN: False"""

    def test_cannot_execute_when_open(self, cb: CircuitBreaker):
        # OPEN 상태 만들기
        for _ in range(5):
            cb.record_failure()

        assert cb.state == CircuitState.OPEN
        assert cb.can_execute() is False
