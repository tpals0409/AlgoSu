import logging
import threading
import httpx
from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel
from .config import settings
from .worker import AIAnalysisWorker
from .gemini_client import GeminiClient
from .circuit_breaker import circuit_breaker
from .logger import setup_logging
from .metrics import (
    PrometheusMiddleware,
    metrics_endpoint,
    update_circuit_breaker_gauge,
)

# 구조화 JSON 로깅 초기화 (monitoring-log-rules.md §1)
setup_logging()
logger = logging.getLogger("ai-analysis")

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

    # Circuit Breaker 상태 → Prometheus gauge 자동 동기화
    circuit_breaker.set_state_change_callback(update_circuit_breaker_gauge)
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


class GroupAnalysisRequest(BaseModel):
    problem_id: str
    study_id: str


@app.post("/group-analysis")
async def group_analysis(
    req: GroupAnalysisRequest,
    x_internal_key: str = Header(alias="X-Internal-Key", default=""),
):
    """그룹 최적화 코드 합성 — 스터디 전체 제출을 종합 분석"""
    if x_internal_key != settings.internal_api_key:
        raise HTTPException(status_code=401, detail="Invalid Internal Key")

    # 1. Submission Service에서 해당 문제의 전체 제출 조회
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

    # 2. Gemini API로 종합 분석
    gemini = GeminiClient()
    code_snippets = []
    for sub in submissions:
        code_preview = sub["code"][:500] if len(sub["code"]) > 500 else sub["code"]
        code_snippets.append(
            f"[{sub['language']}] (userId: {sub['userId'][:8]}...)\n```{sub['language']}\n{code_preview}\n```"
        )

    combined_code = "\n\n---\n\n".join(code_snippets)
    prompt = f"""당신은 알고리즘 코드 리뷰 전문가입니다.

다음은 같은 문제에 대한 여러 사용자의 제출 코드입니다:

{combined_code}

다음을 수행해주세요:
1. **각 풀이 비교 분석**: 시간/공간 복잡도, 접근 방식 비교
2. **최적 풀이 선정**: 가장 효율적인 접근법과 그 이유
3. **종합 최적화 코드**: 모든 풀이의 장점을 결합한 최적화 코드 작성
4. **학습 포인트**: 팀원들이 배울 수 있는 핵심 포인트

한국어로 답변해주세요."""

    try:
        result = await gemini.analyze_code(
            code=combined_code,
            language="mixed",
            problem_context="그룹 종합 분석",
        )
    except Exception as e:
        logger.error(f"그룹 분석 Gemini 호출 실패: {str(e)[:200]}")
        raise HTTPException(status_code=502, detail="AI 분석 실패")

    # 3. 결과 반환
    logger.info(
        f"그룹 분석 완료: problemId={req.problem_id}, studyId={req.study_id}, submissions={len(submissions)}"
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
