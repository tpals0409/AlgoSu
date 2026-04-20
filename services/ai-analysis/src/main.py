"""
AlgoSu AI Analysis Service -- FastAPI 메인

@file FastAPI 앱 + Worker 스레드 + Quota API + 그룹 분석
@domain ai
@layer controller
@related ClaudeClient, AIAnalysisWorker, prompt
"""

import hmac
import logging
import threading
from contextlib import asynccontextmanager
from datetime import date

import httpx
import redis
from fastapi import FastAPI, Header, HTTPException, Query, Request
from pydantic import BaseModel

from .circuit_breaker import circuit_breaker
from .claude_client import MAX_TOKENS, MODEL_ID, ClaudeClient
from .config import settings
from .logger import setup_logging
from .metrics import (
    PrometheusMiddleware,
    ai_quota_checks_total,
    metrics_endpoint,
    update_circuit_breaker_gauge,
)
from .prompt import GROUP_SYSTEM_PROMPT, build_group_user_prompt
from .worker import AIAnalysisWorker

# ─── LOGGING ──────────────────────────────────

setup_logging()
logger = logging.getLogger("ai-analysis")

# ─── APP ──────────────────────────────────────

worker_instance: AIAnalysisWorker | None = None
worker_thread: threading.Thread | None = None
redis_client: redis.Redis | None = None


# ─── QUOTA HELPER ────────────────────────────


def _check_and_increment_quota(user_id: str, limit: int) -> dict:
    """
    AI 일일 한도 체크 + INCR -- Redis INCR/TTL 원자적 패턴

    @domain ai
    @guard ai-quota
    @param user_id: 사용자 ID
    @param limit: 일일 한도
    @returns: { allowed: bool, used: int, limit: int }
    @raises HTTPException: Redis 미연결 시 503
    """
    if not redis_client:
        raise HTTPException(status_code=503, detail="Redis 미연결")

    today = date.today().isoformat()
    key = f"ai_limit:{user_id}:{today}"

    pipe = redis_client.pipeline()
    pipe.incr(key)
    pipe.ttl(key)
    results = pipe.execute()
    current = int(results[0])
    ttl = int(results[1])

    # 첫 사용 시 TTL 설정 (24시간)
    if ttl == -1:
        redis_client.expire(key, 86400)

    if current > limit:
        # 한도 초과 시 DECR로 원복
        redis_client.decr(key)
        ai_quota_checks_total.labels(result="denied").inc()
        return {
            "allowed": False,
            "used": current - 1,
            "limit": limit,
        }

    ai_quota_checks_total.labels(result="allowed").inc()
    return {
        "allowed": True,
        "used": current,
        "limit": limit,
    }


def _rollback_quota(user_id: str) -> None:
    """Quota INCR 롤백 (에러 시 DECR)"""
    if not redis_client:
        return
    today = date.today().isoformat()
    key = f"ai_limit:{user_id}:{today}"
    redis_client.decr(key)


# ─── LIFECYCLE ────────────────────────────────


async def startup_event():
    """서비스 시작 시 RabbitMQ Worker를 백그라운드 스레드로 실행"""
    global worker_instance, worker_thread, redis_client

    circuit_breaker.set_state_change_callback(update_circuit_breaker_gauge)
    update_circuit_breaker_gauge(circuit_breaker.state.value)

    redis_client = redis.from_url(settings.redis_url)

    worker_instance = AIAnalysisWorker()
    worker_thread = threading.Thread(target=worker_instance.start, daemon=True)
    worker_thread.start()
    logger.info("AI Analysis Worker 백그라운드 시작")


async def shutdown_event():
    """Graceful Shutdown"""
    global worker_instance, redis_client
    if worker_instance:
        worker_instance.stop()
    if redis_client:
        redis_client.close()
    logger.info("AI Analysis Service 종료")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPI lifespan context manager — startup/shutdown 통합"""
    await startup_event()
    yield
    await shutdown_event()


app = FastAPI(
    title="AlgoSu AI Analysis Service",
    description="Claude 기반 코드 분석 + Circuit Breaker + AI Quota",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(PrometheusMiddleware)
app.get("/metrics")(metrics_endpoint)


# ─── HEALTH ───────────────────────────────────


@app.get("/health")
async def health():
    """헬스체크 -- Circuit Breaker 상태 포함"""
    return {
        "status": "ok",
        "circuit_breaker": {
            "state": circuit_breaker.state.value,
            "failure_count": circuit_breaker.failure_count,
        },
    }


@app.get("/health/ready")
async def health_ready():
    """Readiness 체크 -- Worker 스레드 + Redis 연결 확인"""
    errors = []

    if worker_thread is None or not worker_thread.is_alive():
        errors.append("Worker thread not running")

    if redis_client:
        try:
            redis_client.ping()
        except Exception:
            errors.append("Redis not ready")
    else:
        errors.append("Redis not initialized")

    if errors:
        raise HTTPException(status_code=503, detail="; ".join(errors))

    return {"status": "ok"}


# ─── CIRCUIT BREAKER ─────────────────────────


@app.get("/circuit-breaker/status")
async def cb_status(
    x_internal_key: str = Header(alias="X-Internal-Key", default=""),
):
    """
    Circuit Breaker 상태 조회 (내부 전용)

    @api GET /circuit-breaker/status
    @guard internal-key
    """
    if not hmac.compare_digest(x_internal_key or "", settings.internal_api_key):
        raise HTTPException(status_code=401, detail="Invalid Internal Key")

    return {
        "state": circuit_breaker.state.value,
        "failure_count": circuit_breaker.failure_count,
        "last_failure_time": circuit_breaker.last_failure_time,
        "half_open_successes": circuit_breaker.half_open_successes,
    }


# ─── AI QUOTA ─────────────────────────────────


@app.get("/quota")
async def get_quota(
    request: Request,
    user_id: str = Query(alias="userId", default=""),
    x_internal_key: str = Header(alias="X-Internal-Key", default=""),
):
    """
    AI 일일 사용량 조회

    Gateway 프록시 경유 시 X-User-ID 헤더에서 userId를 자동 추출.
    직접 호출 시 userId query param 사용.

    @api GET /quota?userId=xxx
    @guard internal-key
    @guard ai-quota
    """
    if not hmac.compare_digest(x_internal_key or "", settings.internal_api_key):
        raise HTTPException(status_code=401, detail="Invalid Internal Key")

    # Gateway 프록시가 주입하는 X-User-ID 헤더 fallback
    resolved_user_id = user_id or request.headers.get("x-user-id", "")
    if not resolved_user_id:
        raise HTTPException(status_code=400, detail="userId 필수")

    user_id = resolved_user_id

    today = date.today().isoformat()
    key = f"ai_limit:{user_id}:{today}"

    used = 0
    if redis_client:
        val = redis_client.get(key)
        if val:
            used = int(val)

    limit = settings.ai_daily_limit
    return {
        "data": {
            "used": used,
            "limit": limit,
            "remaining": max(0, limit - used),
        }
    }


@app.post("/quota/check")
async def check_and_increment_quota(
    user_id: str = Query(alias="userId"),
    x_internal_key: str = Header(alias="X-Internal-Key", default=""),
):
    """
    AI 한도 체크 + INCR (Saga에서 AI 큐잉 전 호출)

    @api POST /quota/check?userId=xxx
    @guard internal-key
    @guard ai-quota
    @returns: { allowed: bool, used: N, limit: 5 }
    """
    if not hmac.compare_digest(x_internal_key or "", settings.internal_api_key):
        raise HTTPException(status_code=401, detail="Invalid Internal Key")

    if not user_id:
        raise HTTPException(status_code=400, detail="userId 필수")

    limit = settings.ai_daily_limit
    result = _check_and_increment_quota(user_id, limit)

    return {"data": result}


# ─── GROUP ANALYSIS ──────────────────────────


class GroupAnalysisRequest(BaseModel):
    problem_id: str
    study_id: str
    user_id: str
    source_platform: str | None = None


@app.post("/group-analysis")
async def group_analysis(
    req: GroupAnalysisRequest,
    x_internal_key: str = Header(alias="X-Internal-Key", default=""),
):
    """
    그룹 최적화 코드 합성 -- 스터디 전체 제출을 종합 분석

    @api POST /group-analysis
    @guard internal-key
    @guard circuit-breaker
    @guard ai-quota
    @domain ai
    """
    if not hmac.compare_digest(x_internal_key or "", settings.internal_api_key):
        raise HTTPException(status_code=401, detail="Invalid Internal Key")

    # Circuit Breaker 체크
    if not circuit_breaker.can_execute():
        logger.warning(
            "그룹 분석 Circuit Breaker OPEN",
            extra={"problemId": req.problem_id, "studyId": req.study_id},
        )
        raise HTTPException(
            status_code=503,
            detail="AI 분석 서비스가 일시적으로 중단되었습니다. 잠시 후 다시 시도해 주세요.",
        )

    # AI 일일 한도 체크 + 증가
    limit = settings.ai_daily_limit
    quota_result = _check_and_increment_quota(req.user_id, limit)

    if not quota_result["allowed"]:
        logger.warning(
            "그룹 분석 Quota 초과",
            extra={
                "userId": f"{req.user_id[:8]}***",
                "used": quota_result["used"],
                "limit": limit,
            },
        )
        raise HTTPException(
            status_code=429,
            detail=f"AI 일일 사용 한도({limit}회)를 초과하였습니다.",
        )

    # Submission Service에서 해당 문제의 전체 제출 조회
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{settings.submission_service_url}/internal/by-problem/{req.problem_id}",
                params={"studyId": req.study_id},
                headers={"X-Internal-Key": settings.submission_service_key},
            )
            resp.raise_for_status()
            submissions = resp.json()["data"]
    except Exception as e:
        _rollback_quota(req.user_id)
        logger.error("그룹 분석 제출 조회 실패", extra={"error": str(e)[:200]})
        raise HTTPException(status_code=502, detail="제출 데이터 조회 실패")

    if not submissions:
        _rollback_quota(req.user_id)
        raise HTTPException(status_code=404, detail="해당 문제에 대한 제출이 없습니다.")

    # Claude API로 그룹 분석
    claude = ClaudeClient()
    code_snippets = [
        {
            "language": sub["language"],
            "userId": sub["userId"],
            "code": sub["code"],
        }
        for sub in submissions
    ]

    user_prompt = build_group_user_prompt(code_snippets, source_platform=req.source_platform)

    try:
        message = claude.client.messages.create(
            model=MODEL_ID,
            max_tokens=MAX_TOKENS,
            system=GROUP_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_prompt}],
        )

        raw_text = message.content[0].text if message.content else ""
        result = claude._parse_group_response(raw_text)
        circuit_breaker.record_success()

    except Exception as e:
        circuit_breaker.record_failure()
        _rollback_quota(req.user_id)
        logger.error("그룹 분석 Claude 호출 실패", extra={"error": str(e)[:200]})
        raise HTTPException(status_code=502, detail="AI 분석 실패")

    logger.info(
        "그룹 분석 완료",
        extra={
            "problemId": req.problem_id,
            "studyId": req.study_id,
            "submissions": len(submissions),
        },
    )

    return {
        "data": {
            "problemId": req.problem_id,
            "studyId": req.study_id,
            "submissionCount": len(submissions),
            "comparison": result.get("comparison", ""),
            "bestApproach": result.get("bestApproach"),
            "optimizedCode": result.get("optimizedCode"),
            "learningPoints": result.get("learningPoints", []),
            "status": result.get("status", "failed"),
        }
    }
