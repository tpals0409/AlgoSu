import json
import logging
import threading
import pika
import redis
import httpx
from .config import settings
from .gemini_client import GeminiClient

logger = logging.getLogger(__name__)

QUEUE = "submission.ai_analysis"


class AIAnalysisWorker:
    """AI Analysis Worker — RabbitMQ 소비자

    보안:
    - Internal API Key 환경변수 참조
    - 코드 내용 로그 미기록 (preview만)
    - Gemini API Key 로그 노출 금지
    """

    def __init__(self):
        self.gemini = GeminiClient()
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
        """메시지 처리 콜백"""
        try:
            event = json.loads(body)
            submission_id = event["submissionId"]
            logger.info(f"AI 분석 메시지 수신: submissionId={submission_id}")

            # 제출 데이터 조회
            submission = self._get_submission(submission_id)

            # Gemini 분석 (동기 래퍼)
            import asyncio
            result = asyncio.run(
                self.gemini.analyze_code(
                    code=submission["code"],
                    language=submission["language"],
                )
            )

            # 분석 결과 저장 (Submission Service 콜백)
            self._report_result(submission_id, result)

            # Redis Pub/Sub 브로드캐스트
            self._publish_status(submission_id, result["status"])

            ch.basic_ack(delivery_tag=method.delivery_tag)
            logger.info(f"AI 분석 완료: submissionId={submission_id}, status={result['status']}")

        except Exception as e:
            logger.error(f"AI 분석 처리 실패: {str(e)[:200]}")
            ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)

    def _get_submission(self, submission_id: str) -> dict:
        """Submission Service에서 제출 데이터 조회"""
        resp = self.http_client.get(
            f"{settings.submission_service_url}/internal/{submission_id}",
            headers={
                "X-Internal-Key": settings.submission_service_key,
            },
        )
        resp.raise_for_status()
        return resp.json()["data"]

    def _report_result(self, submission_id: str, result: dict):
        """분석 결과를 Submission Service에 보고"""
        self.http_client.post(
            f"{settings.submission_service_url}/internal/{submission_id}/ai-result",
            headers={
                "X-Internal-Key": settings.submission_service_key,
                "Content-Type": "application/json",
            },
            json=result,
        )

    def _publish_status(self, submission_id: str, status: str):
        """Redis Pub/Sub 상태 브로드캐스트"""
        channel = f"submission:status:{submission_id}"
        payload = json.dumps({
            "submissionId": submission_id,
            "status": f"ai_{status}",
            "timestamp": __import__("datetime").datetime.utcnow().isoformat(),
        })
        self.redis_client.publish(channel, payload)

    def stop(self):
        """Graceful Shutdown"""
        if hasattr(self, "channel") and self.channel:
            self.channel.stop_consuming()
        if hasattr(self, "connection") and self.connection:
            self.connection.close()
        self.redis_client.close()
        self.http_client.close()
        logger.info("AI Analysis Worker 종료 완료")
