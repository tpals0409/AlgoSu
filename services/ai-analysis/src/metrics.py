"""
@file AI Analysis Prometheus 메트릭 — HTTP + Circuit Breaker + MQ 카운터
@domain ai
@layer util
@related main.py, worker.py, circuit_breaker.py

AlgoSu AI Analysis Service — Prometheus Metrics
-------------------------------------------------
규칙 근거: /docs/monitoring-log-rules.md §9

네이밍: algosu_{service}_{metric_name}_{unit}
라벨 정책: method, path(정규화), status_code — userId/traceId 금지
보안: /metrics 인증 없이 접근 가능 (클러스터 내부 전용)
"""

from __future__ import annotations

import re
import time

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response as StarletteResponse
from prometheus_client import (
    Counter,
    Gauge,
    Histogram,
    generate_latest,
    CONTENT_TYPE_LATEST,
    REGISTRY,
)

# ---------------------------------------------------------------------------
# 경로 정규화 (고카디널리티 방지)
# ---------------------------------------------------------------------------
_UUID_RE = re.compile(
    r"/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
)
_NUMERIC_ID_RE = re.compile(r"/\d+")
_EXCLUDED_PATHS: frozenset[str] = frozenset({"/health", "/metrics"})


def _normalize_path(path: str) -> str:
    path = _UUID_RE.sub("/:id", path)
    path = _NUMERIC_ID_RE.sub("/:id", path)
    return path


# ---------------------------------------------------------------------------
# 메트릭 정의
# ---------------------------------------------------------------------------

http_request_duration = Histogram(
    name="algosu_ai_analysis_http_request_duration_seconds",
    documentation="HTTP request duration in seconds",
    labelnames=["method", "path", "status_code"],
    buckets=(0.01, 0.05, 0.1, 0.3, 0.5, 1.0, 2.0, 5.0),
)

http_requests_total = Counter(
    name="algosu_ai_analysis_http_requests_total",
    documentation="Total number of HTTP requests",
    labelnames=["method", "path", "status_code"],
)

http_active_requests = Gauge(
    name="algosu_ai_analysis_http_active_requests",
    documentation="Number of active HTTP requests",
)

circuit_breaker_state = Gauge(
    name="algosu_ai_analysis_circuit_breaker_state",
    documentation="Circuit Breaker state (0=CLOSED, 0.5=HALF_OPEN, 1=OPEN)",
)

claude_requests_total = Counter(
    name="algosu_ai_analysis_claude_requests_total",
    documentation="Claude API call total",
    labelnames=["status"],
)

ai_quota_checks_total = Counter(
    name="algosu_ai_analysis_quota_checks_total",
    documentation="AI quota check total",
    labelnames=["result"],  # allowed, denied
)

dlq_messages_total = Counter(
    name="algosu_ai_analysis_dlq_messages_total",
    documentation="Total messages sent to DLQ",
    labelnames=["reason"],  # parse_error, process_failure
)

mq_messages_processed_total = Counter(
    name="algosu_ai_analysis_mq_messages_processed_total",
    documentation="Total MQ messages processed",
    labelnames=["result"],  # ack, nack_dlq
)

CIRCUIT_STATE_VALUES: dict[str, float] = {
    "CLOSED": 0.0,
    "HALF_OPEN": 0.5,
    "OPEN": 1.0,
}


def update_circuit_breaker_gauge(state_value: str) -> None:
    """Circuit Breaker 상태 변경 시 Gauge 업데이트."""
    circuit_breaker_state.set(CIRCUIT_STATE_VALUES.get(state_value, 0.0))


# ---------------------------------------------------------------------------
# FastAPI 미들웨어
# ---------------------------------------------------------------------------


class PrometheusMiddleware(BaseHTTPMiddleware):
    """HTTP 요청 메트릭 수집. /health, /metrics는 제외."""

    async def dispatch(
        self,
        request: Request,
        call_next: RequestResponseEndpoint,
    ) -> StarletteResponse:
        path = request.url.path

        if path in _EXCLUDED_PATHS:
            return await call_next(request)

        method = request.method
        normalized_path = _normalize_path(path)

        http_active_requests.inc()
        start_time = time.perf_counter()
        status_code = "500"

        try:
            response = await call_next(request)
            status_code = str(response.status_code)
            return response
        except Exception:
            raise
        finally:
            duration = time.perf_counter() - start_time
            http_active_requests.dec()
            http_request_duration.labels(
                method=method,
                path=normalized_path,
                status_code=status_code,
            ).observe(duration)
            http_requests_total.labels(
                method=method,
                path=normalized_path,
                status_code=status_code,
            ).inc()


# ---------------------------------------------------------------------------
# /metrics 엔드포인트
# ---------------------------------------------------------------------------


async def metrics_endpoint() -> StarletteResponse:
    """Prometheus scraper용 /metrics. 인증 없음."""
    return StarletteResponse(
        content=generate_latest(REGISTRY),
        media_type=CONTENT_TYPE_LATEST,
    )
