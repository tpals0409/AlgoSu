"""
AI Analysis Worker -- RabbitMQ 소비자

@file RabbitMQ 메시지 소비 + Claude AI 분석 + 결과 저장
@domain ai
@layer service
@related ClaudeClient, prompt, SagaOrchestratorService
@event AI_ANALYSIS_COMPLETED (publish)
@event AI_ANALYSIS_FAILED (publish)
"""

import json
import logging
import time

import pika
import redis
import httpx

from .config import settings
from .claude_client import ClaudeClient

logger = logging.getLogger(__name__)

# ─── CONSTANTS ────────────────────────────────

QUEUE = "submission.ai_analysis"
MAX_RETRIES = 3
BACKOFF_BASE = 2  # 지수 백오프 기본값 (초)


class AIAnalysisWorker:
    """AI Analysis Worker -- RabbitMQ 소비자

    보안:
    - Internal API Key 환경변수 참조
    - 코드 내용 로그 미기록 (preview만)
    - Claude API Key 로그 노출 금지

    @domain ai
    """

    def __init__(self):
        self.claude = ClaudeClient()
        self.redis_client = redis.from_url(settings.redis_url)
        self.http_client = httpx.Client(timeout=30)

    def start(self):
        """RabbitMQ 연결 및 큐 구독"""
        params = pika.URLParameters(settings.rabbitmq_url)
        self.connection = pika.BlockingConnection(params)
        self.channel = self.connection.channel()
        self.channel.basic_qos(prefetch_count=2)
        self.channel.queue_declare(
            queue=QUEUE,
            durable=True,
            arguments={
                "x-dead-letter-exchange": "submission.events.dlx",
                "x-dead-letter-routing-key": "ai.analysis.dead",
            },
        )

        logger.info(f"AI Analysis Worker 시작: 큐={QUEUE}, prefetch=2")

        self.channel.basic_consume(
            queue=QUEUE,
            on_message_callback=self._on_message,
            auto_ack=False,
        )

        self.channel.start_consuming()

    def _on_message(self, ch, method, properties, body):
        """
        메시지 처리 콜백 -- 재시도 3회 (exponential backoff)

        @event AI_ANALYSIS_COMPLETED (publish)
        @event AI_ANALYSIS_FAILED (publish)
        """
        try:
            event = json.loads(body)
            submission_id = event["submissionId"]
            user_id = event.get("userId", "")
            logger.info(f"AI 분석 메시지 수신: submissionId={submission_id}")

            # 제출 데이터 조회
            submission = self._get_submission(submission_id)

            # Claude 분석 -- 재시도 3회
            result = self._analyze_with_retry(submission)

            if result["status"] == "failed":
                # 실패 시 Redis 카운터 차감 (비용 미차감)
                if user_id:
                    self._decrement_quota(user_id)

            # 분석 결과 저장 (Submission Service 콜백)
            self._report_result(submission_id, result)

            # Redis Pub/Sub 브로드캐스트
            self._publish_status(submission_id, result["status"])

            ch.basic_ack(delivery_tag=method.delivery_tag)
            logger.info(
                f"AI 분석 완료: submissionId={submission_id}, "
                f"status={result['status']}, score={result.get('score', 0)}"
            )

        except Exception as e:
            logger.error(f"AI 분석 처리 실패: {str(e)[:200]}")
            # 실패 시 카운터 차감 시도
            try:
                event_data = json.loads(body)
                uid = event_data.get("userId", "")
                if uid:
                    self._decrement_quota(uid)
            except Exception:
                pass
            ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)

    def _analyze_with_retry(self, submission: dict) -> dict:
        """
        Claude AI 분석 -- 최대 3회 재시도 (exponential backoff)

        @domain ai
        @param submission: 제출 데이터 dict
        @returns: 분석 결과 dict
        """
        import asyncio

        last_result = None
        for attempt in range(1, MAX_RETRIES + 1):
            result = asyncio.run(
                self.claude.analyze_code(
                    code=submission["code"],
                    language=submission["language"],
                    problem_title=submission.get("problemTitle", ""),
                    problem_description=submission.get("problemDescription", ""),
                )
            )

            if result["status"] in ("completed", "delayed"):
                return result

            last_result = result

            if attempt < MAX_RETRIES:
                wait_sec = BACKOFF_BASE**attempt
                logger.warning(
                    f"AI 분석 재시도: attempt={attempt}/{MAX_RETRIES}, "
                    f"wait={wait_sec}s"
                )
                time.sleep(wait_sec)

        logger.error(f"AI 분석 {MAX_RETRIES}회 실패")
        return last_result or {
            "feedback": "AI 분석이 반복 실패했습니다.",
            "optimized_code": None,
            "score": 0,
            "status": "failed",
            "categories": [],
        }

    def _get_submission(self, submission_id: str) -> dict:
        """
        Submission Service에서 제출 데이터 조회

        @domain ai
        @param submission_id: 제출 UUID
        @returns: 제출 데이터 dict
        """
        resp = self.http_client.get(
            f"{settings.submission_service_url}/internal/{submission_id}",
            headers={
                "X-Internal-Key": settings.submission_service_key,
            },
        )
        resp.raise_for_status()
        return resp.json()["data"]

    def _report_result(self, submission_id: str, result: dict):
        """
        분석 결과를 Submission Service에 보고 (PATCH)

        @domain ai
        @param submission_id: 제출 UUID
        @param result: 분석 결과 dict
        """
        payload = {
            "feedback": result.get("feedback", ""),
            "score": result.get("score", 0),
            "optimizedCode": result.get("optimized_code"),
            "analysisStatus": result.get("status", "failed"),
        }
        resp = self.http_client.patch(
            f"{settings.submission_service_url}/internal/{submission_id}/ai-result",
            headers={
                "X-Internal-Key": settings.submission_service_key,
                "Content-Type": "application/json",
            },
            json=payload,
        )
        resp.raise_for_status()

    def _publish_status(self, submission_id: str, status: str):
        """
        Redis Pub/Sub 상태 브로드캐스트

        @domain ai
        @param submission_id: 제출 UUID
        @param status: 분석 상태
        """
        channel = f"submission:status:{submission_id}"
        payload = json.dumps(
            {
                "submissionId": submission_id,
                "status": f"ai_{status}",
                "timestamp": __import__("datetime").datetime.utcnow().isoformat(),
            }
        )
        self.redis_client.publish(channel, payload)

    def _decrement_quota(self, user_id: str):
        """
        AI 실패 시 Redis 일일 카운터 차감 (DECR)

        @domain ai
        @guard ai-quota
        @param user_id: 사용자 ID
        """
        from datetime import date

        today = date.today().isoformat()
        key = f"ai_limit:{user_id}:{today}"
        try:
            current = self.redis_client.get(key)
            if current and int(current) > 0:
                self.redis_client.decr(key)
                logger.info(
                    f"AI 한도 차감 (실패 보상): userId={user_id[:8]}***, " f"key={key}"
                )
        except Exception as e:
            logger.warning(f"AI 한도 차감 실패: {str(e)[:100]}")

    def stop(self):
        """Graceful Shutdown"""
        if hasattr(self, "channel") and self.channel:
            self.channel.stop_consuming()
        if hasattr(self, "connection") and self.connection:
            self.connection.close()
        self.redis_client.close()
        self.http_client.close()
        logger.info("AI Analysis Worker 종료 완료")
