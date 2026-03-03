"""
AlgoSu AI Analysis Service -- FastAPI 메인

@file FastAPI 앱 + Worker 스레드 + Quota API + 그룹 분석
@domain ai
@layer controller
@related ClaudeClient, AIAnalysisWorker, prompt
"""

import logging
import threading
from datetime import date

import httpx
import redis
from fastapi import FastAPI, HTTPException, Header, Query
from pydantic import BaseModel

from .config import settings
from .worker import AIAnalysisWorker
from .claude_client import ClaudeClient
from .circuit_breaker import circuit_breaker
from .logger import setup_logging
from .metrics import (
    PrometheusMiddleware,
    metrics_endpoint,
    update_circuit_breaker_gauge,
)
from .prompt import GROUP_SYSTEM_PROMPT, build_group_user_prompt

# ─── LOGGING ──────────────────────────────────

setup_logging()
logger = logging.getLogger("ai-analysis")

# ─── APP ──────────────────────────────────────

app = FastAPI(
    title="AlgoSu AI Analysis Service",
    description="Claude 기반 코드 분석 + Circuit Breaker + AI Quota",
    version="2.0.0",
)

app.add_middleware(PrometheusMiddleware)
app.get("/metrics")(metrics_endpoint)

worker_instance: AIAnalysisWorker | None = None
worker_thread: threading.Thread | None = None
redis_client: redis.Redis | None = None


# ─── LIFECYCLE ────────────────────────────────


@app.on_event("startup")
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


@app.on_event("shutdown")
async def shutdown_event():
    """Graceful Shutdown"""
    global worker_instance, redis_client
    if worker_instance:
        worker_instance.stop()
    if redis_client:
        redis_client.close()
    logger.info("AI Analysis Service 종료")


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
    if x_internal_key != settings.internal_api_key:
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
    user_id: str = Query(alias="userId"),
    x_internal_key: str = Header(alias="X-Internal-Key", default=""),
):
    """
    AI 일일 사용량 조회

    @api GET /quota?userId=xxx
    @guard internal-key
    @guard ai-quota
    """
    if x_internal_key != settings.internal_api_key:
        raise HTTPException(status_code=401, detail="Invalid Internal Key")

    if not user_id:
        raise HTTPException(status_code=400, detail="userId 필수")

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
    if x_internal_key != settings.internal_api_key:
        raise HTTPException(status_code=401, detail="Invalid Internal Key")

    if not user_id:
        raise HTTPException(status_code=400, detail="userId 필수")

    today = date.today().isoformat()
    key = f"ai_limit:{user_id}:{today}"
    limit = settings.ai_daily_limit

    if not redis_client:
        raise HTTPException(status_code=503, detail="Redis 미연결")

    # INCR + TTL 패턴 (원자적)
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
        return {
            "data": {
                "allowed": False,
                "used": current - 1,
                "limit": limit,
            }
        }

    return {
        "data": {
            "allowed": True,
            "used": current,
            "limit": limit,
        }
    }


# ─── GROUP ANALYSIS ──────────────────────────


class GroupAnalysisRequest(BaseModel):
    problem_id: str
    study_id: str


@app.post("/group-analysis")
async def group_analysis(
    req: GroupAnalysisRequest,
    x_internal_key: str = Header(alias="X-Internal-Key", default=""),
):
    """
    그룹 최적화 코드 합성 -- 스터디 전체 제출을 종합 분석

    @api POST /group-analysis
    @guard internal-key
    @domain ai
    """
    if x_internal_key != settings.internal_api_key:
        raise HTTPException(status_code=401, detail="Invalid Internal Key")

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
        logger.error(f"그룹 분석 제출 조회 실패: {str(e)[:200]}")
        raise HTTPException(status_code=502, detail="제출 데이터 조회 실패")

    if not submissions:
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

    user_prompt = build_group_user_prompt(code_snippets)

    try:
        message = claude.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            system=GROUP_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_prompt}],
        )

        raw_text = message.content[0].text if message.content else ""
        result = claude._parse_response(raw_text)

    except Exception as e:
        logger.error(f"그룹 분석 Claude 호출 실패: {str(e)[:200]}")
        raise HTTPException(status_code=502, detail="AI 분석 실패")

    logger.info(
        f"그룹 분석 완료: problemId={req.problem_id}, "
        f"studyId={req.study_id}, submissions={len(submissions)}"
    )

    return {
        "data": {
            "problemId": req.problem_id,
            "studyId": req.study_id,
            "submissionCount": len(submissions),
            "feedback": result.get("feedback", ""),
            "optimizedCode": result.get("optimized_code"),
            "score": result.get("score", 0),
            "status": result.get("status", "failed"),
        }
    }
