import time
import logging
from enum import Enum
from typing import TypeVar

logger = logging.getLogger(__name__)

T = TypeVar("T")


class CircuitState(str, Enum):
    CLOSED = "CLOSED"
    OPEN = "OPEN"
    HALF_OPEN = "HALF_OPEN"


class CircuitBreaker:
    """Circuit Breaker — Gemini API 보호

    동작 기준:
    - 실패율 50% 초과 (failure_threshold 연속 실패) → OPEN
    - recovery_timeout(30초) 후 → HALF_OPEN
    - HALF_OPEN에서 half_open_requests만큼 성공 → CLOSED
    - HALF_OPEN에서 실패 → 다시 OPEN

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

        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.success_count = 0
        self.last_failure_time: float = 0
        self.half_open_successes = 0

    @property
    def is_open(self) -> bool:
        if self.state == CircuitState.OPEN:
            # recovery_timeout 경과 시 HALF_OPEN 전환
            if time.time() - self.last_failure_time >= self.recovery_timeout:
                logger.info("Circuit Breaker: OPEN → HALF_OPEN (복구 시도)")
                self.state = CircuitState.HALF_OPEN
                self.half_open_successes = 0
                return False
            return True
        return False

    def record_success(self) -> None:
        if self.state == CircuitState.HALF_OPEN:
            self.half_open_successes += 1
            if self.half_open_successes >= self.half_open_requests:
                logger.info("Circuit Breaker: HALF_OPEN → CLOSED (정상화)")
                self.state = CircuitState.CLOSED
                self.failure_count = 0
                self.half_open_successes = 0
        else:
            self.failure_count = 0

    def record_failure(self) -> None:
        self.failure_count += 1
        self.last_failure_time = time.time()

        if self.state == CircuitState.HALF_OPEN:
            logger.warning("Circuit Breaker: HALF_OPEN → OPEN (복구 실패)")
            self.state = CircuitState.OPEN
        elif self.failure_count >= self.failure_threshold:
            logger.warning(
                f"Circuit Breaker: CLOSED → OPEN (연속 {self.failure_count}회 실패)"
            )
            self.state = CircuitState.OPEN

    def can_execute(self) -> bool:
        """요청 실행 가능 여부"""
        return not self.is_open


# 싱글턴 인스턴스 (config에서 설정값 주입)
from .config import settings  # noqa: E402

circuit_breaker = CircuitBreaker(
    failure_threshold=settings.cb_failure_threshold,
    recovery_timeout=settings.cb_recovery_timeout,
    half_open_requests=settings.cb_half_open_requests,
)
