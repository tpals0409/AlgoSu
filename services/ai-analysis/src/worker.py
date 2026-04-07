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

import httpx
import pika
import redis

from .claude_client import CircuitBreakerOpenError, ClaudeClient
from .config import settings
from .metrics import dlq_messages_total, mq_messages_processed_total

logger = logging.getLogger(__name__)

# ─── CONSTANTS ────────────────────────────────

QUEUE = "submission.ai_analysis"
EXCHANGE = "submission.events"
ROUTING_KEY = "ai.analysis"
MAX_RETRIES = 3
BACKOFF_BASE = 2  # 지수 백오프 기본값 (초)
MAX_REQUEUE = 3  # Circuit Breaker requeue 최대 횟수
PUBLISH_MAX_RETRIES = 3  # Redis publish 재시도 횟수
PUBLISH_BACKOFF_BASE = 0.5  # Redis publish 재시도 백오프 기본값 (초)

# 최종 상태 (재시도 필수)
TERMINAL_STATUSES = {"completed", "failed"}

# RabbitMQ 재연결 상수
RECONNECT_INITIAL_DELAY = 1  # 최초 재연결 대기 (초)
RECONNECT_MAX_DELAY = 30  # 최대 재연결 대기 (초)
RECONNECT_MULTIPLIER = 2  # 지수 백오프 배수


class AIAnalysisWorker:
    """AI Analysis Worker -- RabbitMQ 소비자

    보안:
    - Internal API Key 환경변수 참조
    - 코드 내용 로그 미기록 (preview만)
    - Claude API Key 로그 노출 금지

    재연결:
    - RabbitMQ 연결 끊김 시 지수 백오프로 무한 재시도
    - 재연결 성공 시 consumer 재등록 및 채널 재설정

    @domain ai
    """

    def __init__(self):
        self.claude = ClaudeClient()
        self.redis_client = redis.from_url(settings.redis_url)
        self.http_client = httpx.Client(timeout=30)
        self.connection = None
        self.channel = None
        self._stopping = False

    def start(self):
        """RabbitMQ 연결 및 큐 구독 (재연결 루프 포함)"""
        self._stopping = False
        self._connect_with_retry()

    def _connect_with_retry(self):
        """
        RabbitMQ 연결 시도 -- 실패 시 지수 백오프로 무한 재시도

        @domain ai
        """
        delay = RECONNECT_INITIAL_DELAY
        attempt = 0

        while not self._stopping:
            try:
                attempt += 1
                logger.info(f"RabbitMQ 연결 시도: attempt={attempt}")
                self._connect_and_consume()
            except Exception as e:
                if self._stopping:
                    break
                logger.error(
                    f"RabbitMQ 연결 오류 (attempt={attempt}): {str(e)[:200]}, "
                    f"{delay}초 후 재시도"
                )
                # 재연결 전 이전 채널/연결 정리 (리소스 누수 방지)
                self._cleanup_connection()
                time.sleep(delay)
                delay = min(delay * RECONNECT_MULTIPLIER, RECONNECT_MAX_DELAY)

        logger.info("AI Analysis Worker 재연결 루프 종료")

    def _cleanup_connection(self):
        """
        pika 채널/연결 정리 -- 재연결 전 리소스 해제

        @domain ai
        """
        if self.channel:
            try:
                self.channel.close()
            except Exception:
                pass
            self.channel = None
        if self.connection:
            try:
                self.connection.close()
            except Exception:
                pass
            self.connection = None

    def _connect_and_consume(self):
        """
        RabbitMQ 연결 + 큐 설정 + 소비 시작

        연결이 끊기면 예외를 raise하여 상위 재연결 루프로 위임.

        @domain ai
        """
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

        # Exchange → Queue 바인딩 보장 (submission 서비스보다 먼저 시작될 경우 대비)
        self.channel.exchange_declare(
            exchange=EXCHANGE, exchange_type="topic", durable=True
        )
        self.channel.queue_bind(queue=QUEUE, exchange=EXCHANGE, routing_key=ROUTING_KEY)

        logger.info(f"AI Analysis Worker 시작: 큐={QUEUE}, prefetch=2")

        self.channel.basic_consume(
            queue=QUEUE,
            on_message_callback=self._on_message,
            auto_ack=False,
        )

        self.channel.start_consuming()

    def _get_delivery_count(self, properties) -> int:
        """
        RabbitMQ 메시지 delivery count 조회

        x-delivery-count 헤더(RabbitMQ 3.8+) 또는 커스텀 retry_count 사용.

        @domain ai
        @param properties: pika BasicProperties
        @returns: 현재 delivery 횟수 (0-based)
        """
        if properties and properties.headers:
            # RabbitMQ 3.8+ quorum queue: x-delivery-count
            count = properties.headers.get("x-delivery-count", 0)
            if count:
                return int(count)
            # 커스텀 헤더 fallback
            count = properties.headers.get("retry_count", 0)
            if count:
                return int(count)
        return 0

    def _on_message(self, ch, method, properties, body):
        """
        메시지 처리 콜백 -- 재시도 3회 (exponential backoff)

        CircuitBreakerOpenError 발생 시 NACK+requeue (최대 MAX_REQUEUE회).

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

            # 1) 분석 결과 저장 (Submission Service 콜백 — 필수, 실패 시 NACK)
            self._report_result(submission_id, result)

            # 2) Redis Pub/Sub 브로드캐스트
            #    최종 상태(completed/failed): 재시도 3회 후 경고 로그
            #    비최종 상태(progress 등): best-effort (현재와 동일)
            if result["status"] in TERMINAL_STATUSES:
                self._publish_status_with_retry(submission_id, result["status"])
            else:
                try:
                    self._publish_status(submission_id, result["status"])
                except Exception as pub_err:
                    logger.warning(
                        f"Redis publish 실패 (best-effort): submissionId={submission_id}, "
                        f"error={str(pub_err)[:200]}"
                    )

            # 3) 모든 필수 작업 성공 후 ACK
            ch.basic_ack(delivery_tag=method.delivery_tag)
            mq_messages_processed_total.labels(result="ack").inc()
            logger.info(
                f"AI 분석 완료: submissionId={submission_id}, "
                f"status={result['status']}, score={result.get('score', 0)}"
            )

        except CircuitBreakerOpenError:
            # Circuit Breaker OPEN -- requeue 횟수 제한
            delivery_count = self._get_delivery_count(properties)
            try:
                event_data = json.loads(body)
                sid = event_data.get("submissionId", "unknown")
                uid = event_data.get("userId", "")
            except Exception:
                sid = "unknown"
                uid = ""

            if delivery_count < MAX_REQUEUE:
                logger.warning(
                    f"Circuit Breaker OPEN -- NACK+requeue: "
                    f"submissionId={sid}, delivery={delivery_count + 1}/{MAX_REQUEUE}"
                )
                ch.basic_nack(delivery_tag=method.delivery_tag, requeue=True)
                mq_messages_processed_total.labels(result="nack_requeue").inc()
            else:
                logger.error(
                    f"Circuit Breaker OPEN -- requeue 한도 초과, DLQ 전송: "
                    f"submissionId={sid}, delivery={delivery_count + 1}"
                )
                # requeue 한도 초과 — AI 분석 미수행이므로 quota 차감 보상
                if uid:
                    self._decrement_quota(uid)
                # 한도 초과 시 delayed 상태를 DB에 저장하여 사용자에게 알림
                try:
                    self._report_result(
                        sid,
                        {
                            "feedback": "AI 분석이 일시적으로 지연되고 있습니다. 잠시 후 다시 확인해주세요.",
                            "optimized_code": None,
                            "score": 0,
                            "status": "delayed",
                        },
                    )
                except Exception as report_err:
                    logger.warning(f"delayed 상태 보고 실패: {str(report_err)[:200]}")
                ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
                dlq_messages_total.labels(reason="circuit_breaker_exhausted").inc()
                mq_messages_processed_total.labels(result="nack_dlq").inc()

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
            dlq_messages_total.labels(reason="process_failure").inc()
            mq_messages_processed_total.labels(result="nack_dlq").inc()

    def _analyze_with_retry(self, submission: dict) -> dict:
        """
        Claude AI 분석 -- 최대 3회 재시도 (exponential backoff)

        CircuitBreakerOpenError는 catch하지 않고 상위로 전파.

        @domain ai
        @param submission: 제출 데이터 dict
        @returns: 분석 결과 dict
        @raises CircuitBreakerOpenError: Circuit Breaker OPEN 시
        """
        import asyncio

        last_result = None
        for attempt in range(1, MAX_RETRIES + 1):
            # CircuitBreakerOpenError는 전파 (상위 _on_message에서 처리)
            result = asyncio.run(
                self.claude.analyze_code(
                    code=submission["code"],
                    language=submission["language"],
                    problem_title=submission.get("problemTitle", ""),
                    problem_description=submission.get("problemDescription", ""),
                )
            )

            if result["status"] == "completed":
                return result

            last_result = result

            if attempt < MAX_RETRIES:
                wait_sec = BACKOFF_BASE**attempt
                logger.warning(
                    f"AI 분석 재시도: attempt={attempt}/{MAX_RETRIES}, wait={wait_sec}s"
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

    def _publish_status_with_retry(self, submission_id: str, status: str):
        """
        Redis Pub/Sub 최종 상태 브로드캐스트 -- 재시도 포함

        최종 상태(completed/failed)는 클라이언트 SSE 수신에 필수이므로
        최대 PUBLISH_MAX_RETRIES회 재시도 (exponential backoff).
        모든 재시도 실패 시 경고 로그 기록 후 진행 (ACK는 허용).

        @domain ai
        @param submission_id: 제출 UUID
        @param status: 분석 상태 (completed/failed)
        """
        last_error = None
        for attempt in range(1, PUBLISH_MAX_RETRIES + 1):
            try:
                self._publish_status(submission_id, status)
                return
            except Exception as e:
                last_error = e
                if attempt < PUBLISH_MAX_RETRIES:
                    wait_sec = PUBLISH_BACKOFF_BASE * (2 ** (attempt - 1))
                    logger.warning(
                        f"Redis publish 재시도: submissionId={submission_id}, "
                        f"attempt={attempt}/{PUBLISH_MAX_RETRIES}, "
                        f"wait={wait_sec}s, error={str(e)[:200]}"
                    )
                    time.sleep(wait_sec)

        logger.error(
            f"Redis publish 최종 실패: submissionId={submission_id}, "
            f"status={status}, attempts={PUBLISH_MAX_RETRIES}, "
            f"error={str(last_error)[:200]}. "
            f"클라이언트 SSE가 이 상태를 수신하지 못할 수 있음"
        )

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
                    f"AI 한도 차감 (실패 보상): userId={user_id[:8]}***, key={key}"
                )
        except Exception as e:
            logger.warning(f"AI 한도 차감 실패: {str(e)[:100]}")

    def stop(self):
        """Graceful Shutdown"""
        self._stopping = True
        if hasattr(self, "channel") and self.channel:
            try:
                self.channel.stop_consuming()
            except Exception:
                pass
        if hasattr(self, "connection") and self.connection:
            try:
                self.connection.close()
            except Exception:
                pass
        self.redis_client.close()
        self.http_client.close()
        logger.info("AI Analysis Worker 종료 완료")
