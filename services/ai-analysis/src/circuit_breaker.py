"""
@file Circuit Breaker — Claude API 과부하 보호 패턴
@domain ai
@layer service
@related worker.py, claude_client.py, metrics.py
"""

import logging
import time
from enum import Enum
from threading import Lock

logger = logging.getLogger(__name__)


class CircuitState(str, Enum):
    CLOSED = "CLOSED"
    OPEN = "OPEN"
    HALF_OPEN = "HALF_OPEN"


class CircuitBreaker:
    """Circuit Breaker — Claude API 보호

    동작 기준:
    - 실패율 50% 초과 (failure_threshold 연속 실패) → OPEN
    - recovery_timeout(30초) 후 → HALF_OPEN
    - HALF_OPEN에서 half_open_requests만큼 성공 → CLOSED
    - HALF_OPEN에서 실패 → 다시 OPEN

    HALF_OPEN 동시 요청 제한:
    - _half_open_in_flight 로 현재 처리 중인 시험 요청 수를 추적
    - half_open_requests 한도 초과 요청은 즉시 차단 (CircuitBreakerOpenError 동등)
    - can_execute() 내에서 원자적으로 슬롯을 점유 — 경쟁 조건 없음

    Fallback: analysis_status = DELAYED + "분석 지연 중" 알림
    """

    def __init__(
        self,
        failure_threshold: int = 5,
        recovery_timeout: int = 30,
        half_open_requests: int = 2,
    ):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.half_open_requests = half_open_requests

        self._lock = Lock()
        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.success_count = 0
        self.last_failure_time: float = 0
        self.half_open_successes = 0
        self._half_open_in_flight: int = 0  # HALF_OPEN 동시 in-flight 요청 수
        self._on_state_change = None

    def set_state_change_callback(self, callback) -> None:
        """상태 전이 시 호출될 콜백 등록 (Prometheus gauge 등)"""
        self._on_state_change = callback

    def _notify_state_change(self) -> None:
        """상태 변경 시 콜백 호출"""
        if self._on_state_change:
            self._on_state_change(self.state.value)

    @property
    def is_open(self) -> bool:
        """회로 차단 여부 — OPEN + timeout 미경과 시 True.

        OPEN + timeout 경과 시 HALF_OPEN으로 전환하고 False 반환.
        요청 gate로는 can_execute() 사용 권장 (in-flight 원자적 추적 포함).
        """
        notify = False
        with self._lock:
            if self.state == CircuitState.OPEN:
                # recovery_timeout 경과 시 HALF_OPEN 전환
                if time.time() - self.last_failure_time >= self.recovery_timeout:
                    logger.info("Circuit Breaker: OPEN → HALF_OPEN (복구 시도)")
                    self.state = CircuitState.HALF_OPEN
                    self.half_open_successes = 0
                    self._half_open_in_flight = 0  # 전환 시 in-flight 카운터 초기화
                    notify = True
                else:
                    return True
            else:
                return False
        # Lock 밖에서 콜백 호출 (deadlock 방지)
        if notify:
            self._notify_state_change()
        return False

    def record_success(self) -> None:
        notify = False
        with self._lock:
            if self.state == CircuitState.HALF_OPEN:
                self._half_open_in_flight = max(0, self._half_open_in_flight - 1)
                self.half_open_successes += 1
                if self.half_open_successes >= self.half_open_requests:
                    logger.info("Circuit Breaker: HALF_OPEN → CLOSED (정상화)")
                    self.state = CircuitState.CLOSED
                    self.failure_count = 0
                    self.half_open_successes = 0
                    notify = True
            else:
                self.failure_count = 0
        # Lock 밖에서 콜백 호출 (deadlock 방지)
        if notify:
            self._notify_state_change()

    def record_failure(self) -> None:
        notify = False
        with self._lock:
            self.failure_count += 1
            self.last_failure_time = time.time()

            if self.state == CircuitState.HALF_OPEN:
                self._half_open_in_flight = max(0, self._half_open_in_flight - 1)
                logger.warning("Circuit Breaker: HALF_OPEN → OPEN (복구 실패)")
                self.state = CircuitState.OPEN
                notify = True
            elif self.failure_count >= self.failure_threshold:
                logger.warning(
                    "Circuit Breaker: CLOSED → OPEN",
                    extra={"failureCount": self.failure_count},
                )
                self.state = CircuitState.OPEN
                notify = True
        # Lock 밖에서 콜백 호출 (deadlock 방지)
        if notify:
            self._notify_state_change()

    def can_execute(self) -> bool:
        """요청 실행 가능 여부 — HALF_OPEN in-flight 수 원자적 추적

        HALF_OPEN 상태에서는 half_open_requests 수만큼만 동시 시험 요청을 허용하여
        복구 중에 과도한 요청이 Claude API로 쇄도하는 것을 방지한다.
        슬롯 점유(체크 + 카운터 증가)는 단일 Lock 내에서 원자적으로 처리된다.

        @returns: True이면 요청 전송 허용, False이면 차단
        """
        notify = False
        allowed = False

        with self._lock:
            if self.state == CircuitState.OPEN:
                if time.time() - self.last_failure_time >= self.recovery_timeout:
                    # OPEN → HALF_OPEN 전환 + 첫 시험 요청 슬롯 원자적 점유
                    logger.info("Circuit Breaker: OPEN → HALF_OPEN (복구 시도)")
                    self.state = CircuitState.HALF_OPEN
                    self.half_open_successes = 0
                    self._half_open_in_flight = 1
                    notify = True
                    allowed = True
                # else: recovery_timeout 미경과 → 차단
            elif self.state == CircuitState.HALF_OPEN:
                if self._half_open_in_flight < self.half_open_requests:
                    self._half_open_in_flight += 1
                    allowed = True
                else:
                    logger.debug(
                        "Circuit Breaker HALF_OPEN: in-flight 한도 초과 — 요청 차단",
                        extra={
                            "inFlight": self._half_open_in_flight,
                            "limit": self.half_open_requests,
                        },
                    )
            else:  # CLOSED
                allowed = True

        if notify:
            self._notify_state_change()

        return allowed


# 싱글턴 인스턴스 (config에서 설정값 주입)
from .config import settings  # noqa: E402

circuit_breaker = CircuitBreaker(
    failure_threshold=settings.cb_failure_threshold,
    recovery_timeout=settings.cb_recovery_timeout,
    half_open_requests=settings.cb_half_open_requests,
)
