"""CircuitBreaker 단위 테스트 (14개)

CircuitBreaker 클래스만 직접 import하여 테스트.
모듈 레벨 싱글턴(circuit_breaker)은 테스트 대상 아님.
"""

import threading
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
        assert cb._half_open_in_flight == 0


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


class TestIsOpenWhenClosed:
    """4b. is_open -- CLOSED 상태: else 분기 → False 즉시 반환 (line 87)"""

    def test_is_open_returns_false_when_closed(self, cb: CircuitBreaker):
        """CLOSED 상태에서 is_open은 False (else branch → line 87)"""
        assert cb.state == CircuitState.CLOSED
        assert cb.is_open is False

    def test_is_open_returns_false_when_half_open(self, cb: CircuitBreaker):
        """HALF_OPEN 상태에서 is_open은 False (else branch → line 87)"""
        cb.state = CircuitState.HALF_OPEN
        assert cb.is_open is False


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


class TestSetStateChangeCallback:
    """set_state_change_callback() 및 _notify_state_change() 콜백 호출"""

    def test_callback_registered_and_invoked_on_state_change(self, cb: CircuitBreaker):
        """콜백 등록 후 상태 전이 시 호출 확인"""
        called_with = []

        def my_callback(state_value: str):
            called_with.append(state_value)

        cb.set_state_change_callback(my_callback)
        assert cb._on_state_change is my_callback

        # threshold=5 실패 → OPEN (콜백 호출)
        for _ in range(5):
            cb.record_failure()

        assert called_with == ["OPEN"]

    def test_notify_without_callback_does_not_raise(self, cb: CircuitBreaker):
        """콜백 없으면 _notify_state_change() 호출해도 예외 없음"""
        assert cb._on_state_change is None
        cb._notify_state_change()  # 예외 없어야 함

    def test_callback_called_on_half_open_to_closed(self, cb: CircuitBreaker):
        """HALF_OPEN → CLOSED 전이 시 콜백 호출"""
        state_changes = []
        cb.set_state_change_callback(lambda s: state_changes.append(s))

        cb.state = CircuitState.HALF_OPEN
        cb.half_open_successes = 0
        # 2회 성공 → CLOSED
        cb.record_success()
        cb.record_success()

        assert "CLOSED" in state_changes

    def test_callback_called_on_half_open_to_open_failure(self, cb: CircuitBreaker):
        """HALF_OPEN → OPEN 전이 시 콜백 호출"""
        state_changes = []
        cb.set_state_change_callback(lambda s: state_changes.append(s))

        cb.state = CircuitState.HALF_OPEN
        cb.record_failure()

        assert "OPEN" in state_changes


class TestThreadSafety:
    """Thread safety 검증 — Lock 적용 후 동시 접근 안정성"""

    def test_has_lock_attribute(self, cb: CircuitBreaker):
        """_lock 속성이 threading.Lock 인스턴스인지 확인"""
        assert hasattr(cb, "_lock")
        # Lock은 _thread.lock 타입이므로 acquire/release 메서드로 확인
        assert callable(getattr(cb._lock, "acquire", None))
        assert callable(getattr(cb._lock, "release", None))

    def test_concurrent_record_failure_no_race(self):
        """다중 스레드에서 record_failure() 동시 호출 — failure_count 정합성"""
        cb = CircuitBreaker(failure_threshold=1000, recovery_timeout=30)
        num_threads = 10
        calls_per_thread = 100
        barrier = threading.Barrier(num_threads)

        def worker():
            barrier.wait()
            for _ in range(calls_per_thread):
                cb.record_failure()

        threads = [threading.Thread(target=worker) for _ in range(num_threads)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert cb.failure_count == num_threads * calls_per_thread

    def test_concurrent_record_success_and_failure(self):
        """record_success()와 record_failure() 동시 호출 — 예외 없이 완료"""
        cb = CircuitBreaker(failure_threshold=1000, recovery_timeout=30)
        num_threads = 10
        calls_per_thread = 100
        barrier = threading.Barrier(num_threads * 2)
        errors: list = []

        def success_worker():
            barrier.wait()
            try:
                for _ in range(calls_per_thread):
                    cb.record_success()
            except Exception as e:
                errors.append(e)

        def failure_worker():
            barrier.wait()
            try:
                for _ in range(calls_per_thread):
                    cb.record_failure()
            except Exception as e:
                errors.append(e)

        threads = []
        for _ in range(num_threads):
            threads.append(threading.Thread(target=success_worker))
            threads.append(threading.Thread(target=failure_worker))

        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert len(errors) == 0
        # 상태는 CLOSED 또는 OPEN 중 하나 (HALF_OPEN은 아닌 상태)
        assert cb.state in (CircuitState.CLOSED, CircuitState.OPEN)

    def test_concurrent_can_execute_no_crash(self):
        """다중 스레드에서 can_execute() 동시 호출 — 예외 없이 완료"""
        cb = CircuitBreaker(failure_threshold=5, recovery_timeout=30)
        num_threads = 20
        calls_per_thread = 100
        barrier = threading.Barrier(num_threads)
        errors: list = []

        def worker():
            barrier.wait()
            try:
                for _ in range(calls_per_thread):
                    cb.can_execute()
            except Exception as e:
                errors.append(e)

        threads = [threading.Thread(target=worker) for _ in range(num_threads)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert len(errors) == 0


class TestHalfOpenInflightTracking:
    """HALF_OPEN 상태 in-flight 요청 수 추적 — P1 감사 수정 (audit-20260422-p1-018)

    HALF_OPEN 진입 후 half_open_requests를 초과하는 동시 요청이
    Claude API로 쇄도하는 것을 방지하는 기능을 검증한다.
    """

    def test_can_execute_increments_in_flight_in_half_open(self, cb: CircuitBreaker):
        """HALF_OPEN에서 can_execute() 호출 시 in-flight 카운터 증가"""
        cb.state = CircuitState.HALF_OPEN
        cb._half_open_in_flight = 0

        cb.can_execute()
        assert cb._half_open_in_flight == 1

        cb.can_execute()
        assert cb._half_open_in_flight == 2

    def test_can_execute_blocks_when_in_flight_at_limit(self, cb: CircuitBreaker):
        """HALF_OPEN in-flight 한도(half_open_requests=2) 도달 시 추가 요청 차단"""
        cb.state = CircuitState.HALF_OPEN
        cb._half_open_in_flight = 0

        assert cb.can_execute() is True   # in-flight=1
        assert cb.can_execute() is True   # in-flight=2 (한도)
        assert cb.can_execute() is False  # 한도 초과 → 차단
        assert cb._half_open_in_flight == 2

    def test_record_success_decrements_in_flight_in_half_open(self, cb: CircuitBreaker):
        """HALF_OPEN record_success() — in-flight 감소 (HALF_OPEN 유지)"""
        cb.state = CircuitState.HALF_OPEN
        cb._half_open_in_flight = 2
        cb.half_open_successes = 0

        cb.record_success()

        assert cb._half_open_in_flight == 1
        assert cb.state == CircuitState.HALF_OPEN
        assert cb.half_open_successes == 1

    def test_record_failure_decrements_in_flight_in_half_open(self, cb: CircuitBreaker):
        """HALF_OPEN record_failure() — in-flight 감소 후 OPEN 전환"""
        cb.state = CircuitState.HALF_OPEN
        cb._half_open_in_flight = 2

        cb.record_failure()

        assert cb._half_open_in_flight == 1
        assert cb.state == CircuitState.OPEN

    def test_slot_freed_by_success_allows_next_request(self, cb: CircuitBreaker):
        """record_success()로 슬롯 해제 후 can_execute() 재허용"""
        cb.state = CircuitState.HALF_OPEN
        cb._half_open_in_flight = 0

        assert cb.can_execute() is True   # in-flight=1
        assert cb.can_execute() is True   # in-flight=2 (한도)
        assert cb.can_execute() is False  # 차단

        # 슬롯 1개 해제
        cb.record_success()               # in-flight=1, successes=1
        assert cb._half_open_in_flight == 1

        assert cb.can_execute() is True   # in-flight=2 (한도 재도달)
        assert cb.can_execute() is False  # 차단

    def test_can_execute_transitions_open_to_half_open_after_timeout(self, cb: CircuitBreaker):
        """can_execute(): OPEN + timeout 경과 → HALF_OPEN 전환 + True 반환 + in-flight=1"""
        for _ in range(5):
            cb.record_failure()
        assert cb.state == CircuitState.OPEN

        with patch("src.circuit_breaker.time") as mock_time:
            mock_time.time.return_value = cb.last_failure_time + 31
            result = cb.can_execute()

        assert result is True
        assert cb.state == CircuitState.HALF_OPEN
        assert cb._half_open_in_flight == 1

    def test_in_flight_not_negative_on_underflow(self, cb: CircuitBreaker):
        """in-flight 카운터가 0 미만으로 내려가지 않음 (방어 코드 검증)"""
        cb.state = CircuitState.HALF_OPEN
        cb._half_open_in_flight = 0

        cb.record_success()  # in-flight=max(0, -1)=0
        assert cb._half_open_in_flight == 0

    def test_concurrent_half_open_allows_exactly_half_open_requests(self):
        """동시 다발 접근 시 정확히 half_open_requests 수만큼만 허용 (스레드 안전)"""
        half_open_req = 3
        cb = CircuitBreaker(
            failure_threshold=5,
            recovery_timeout=30,
            half_open_requests=half_open_req,
        )
        cb.state = CircuitState.HALF_OPEN
        cb._half_open_in_flight = 0

        num_threads = 20
        results: list = []
        results_lock = threading.Lock()
        barrier = threading.Barrier(num_threads)

        def worker():
            barrier.wait()
            allowed = cb.can_execute()
            with results_lock:
                results.append(allowed)

        threads = [threading.Thread(target=worker) for _ in range(num_threads)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        allowed_count = sum(1 for r in results if r)
        assert allowed_count == half_open_req
        assert cb._half_open_in_flight == half_open_req
