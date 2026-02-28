from __future__ import annotations

import logging
import signal
import sys
import threading
from typing import Optional
from fastapi import FastAPI, HTTPException, Header
from .config import settings
from .worker import AIAnalysisWorker
from .circuit_breaker import circuit_breaker, CircuitState

# 구조화 JSON 로깅 초기화 (monitoring-log-rules.md §1)
from .logger import setup_logging
setup_logging()
logger = logging.getLogger("ai-analysis")

# Prometheus 메트릭 (monitoring-log-rules.md §9)
from .metrics import PrometheusMiddleware, metrics_endpoint, update_circuit_breaker_gauge

app = FastAPI(
    title="AlgoSu AI Analysis Service",
    description="Gemini 기반 코드 분석 + Circuit Breaker",
    version="1.0.0",
)

# Prometheus 미들웨어 + /metrics 엔드포인트
app.add_middleware(PrometheusMiddleware)
app.get("/metrics")(metrics_endpoint)

worker_instance: AIAnalysisWorker | None = None
worker_thread: threading.Thread | None = None


@app.on_event("startup")
async def startup_event():
    """서비스 시작 시 RabbitMQ Worker를 백그라운드 스레드로 실행"""
    global worker_instance, worker_thread

    # Circuit Breaker 초기 상태를 Gauge에 반영
    update_circuit_breaker_gauge(circuit_breaker.state.value)

    worker_instance = AIAnalysisWorker()
    worker_thread = threading.Thread(target=worker_instance.start, daemon=True)
    worker_thread.start()
    logger.info("AI Analysis Worker 백그라운드 시작")


@app.on_event("shutdown")
async def shutdown_event():
    """Graceful Shutdown"""
    global worker_instance
    if worker_instance:
        worker_instance.stop()
    logger.info("AI Analysis Service 종료")


@app.get("/health")
async def health():
    """헬스체크 — Circuit Breaker 상태 포함"""
    return {
        "status": "ok",
        "circuit_breaker": {
            "state": circuit_breaker.state.value,
            "failure_count": circuit_breaker.failure_count,
        },
    }


@app.get("/circuit-breaker/status")
async def cb_status(x_internal_key: str = Header(alias="X-Internal-Key", default="")):
    """Circuit Breaker 상태 조회 (내부 전용)"""
    if x_internal_key != settings.internal_api_key:
        raise HTTPException(status_code=401, detail="Invalid Internal Key")

    return {
        "state": circuit_breaker.state.value,
        "failure_count": circuit_breaker.failure_count,
        "last_failure_time": circuit_breaker.last_failure_time,
        "half_open_successes": circuit_breaker.half_open_successes,
    }
