"""
AlgoSu AI Analysis Service — Structured Logger
-----------------------------------------------
규칙 근거: /docs/monitoring-log-rules.md

보안 요구사항:
- gemini_api_key, submission_service_key, internal_api_key 절대 로그 금지
- Authorization / X-Internal-Key 헤더 [REDACTED] 처리
- 사용자 이메일 원문 금지, path/userAgent 제어문자 제거 + truncate
- Log Injection 방지: 반드시 JSON 구조화 출력 (문자열 concat 금지)
"""
from __future__ import annotations

import json
import logging
import os
import re
import sys
import time
import uuid
from typing import Any

# ---------------------------------------------------------------------------
# 공통 상수
# ---------------------------------------------------------------------------
SERVICE_NAME = "ai-analysis"
VERSION = os.environ.get("SERVICE_VERSION", "1.0.0")
ENV = os.environ.get("ENV", "development")
PID = os.getpid()

# Log Injection 방지: 제어문자 패턴 (CR LF TAB NUL 및 \x00-\x1f 전체)
_CONTROL_CHAR_RE = re.compile(r"[\x00-\x1f\x7f]")

# 마스킹 대상 헤더 (소문자 정규화 후 비교)
_REDACTED_HEADERS: frozenset[str] = frozenset(
    {"authorization", "x-internal-key", "cookie"}
)


# ---------------------------------------------------------------------------
# 보안 유틸리티
# ---------------------------------------------------------------------------

def sanitize_str(value: str, max_len: int = 500) -> str:
    """제어문자 제거 + 길이 truncate (Log Injection 방지)."""
    cleaned = _CONTROL_CHAR_RE.sub("", value)
    return cleaned[:max_len]


def mask_ip(ip: str) -> str:
    """마지막 옥텟 마스킹: 192.168.1.100 → 192.168.1.**"""
    parts = ip.rsplit(".", 1)
    if len(parts) == 2:
        return f"{parts[0]}.**"
    return ip


def mask_email(email: str) -> str:
    """앞 2자 + **@domain 형식: user@example.com → us**@example.com"""
    at_idx = email.find("@")
    if at_idx < 0:
        return "**"
    local = email[:at_idx]
    domain = email[at_idx:]
    return f"{local[:2]}**{domain}"


def sanitize_headers(headers: dict[str, str]) -> dict[str, str]:
    """Authorization, X-Internal-Key, Cookie → [REDACTED]"""
    return {
        k: ("[REDACTED]" if k.lower() in _REDACTED_HEADERS else v)
        for k, v in headers.items()
    }


# ---------------------------------------------------------------------------
# JSON Formatter
# ---------------------------------------------------------------------------

class JsonFormatter(logging.Formatter):
    """
    Python logging.Formatter 서브클래스.
    모든 LogRecord를 JSON 한 줄로 변환하여 stdout에 출력한다.

    필수 필드: ts, level, service, traceId, requestId, message, pid, env, version
    에러: production에서 stack trace 제거, development에서만 포함
    """

    LEVEL_MAP: dict[int, str] = {
        logging.DEBUG: "debug",
        logging.INFO: "info",
        logging.WARNING: "warn",
        logging.ERROR: "error",
        logging.CRITICAL: "error",  # Prometheus alert 단순화를 위해 error로 통일
    }

    def format(self, record: logging.LogRecord) -> str:
        # 기본 공통 필드
        entry: dict[str, Any] = {
            "ts": self._iso_now(),
            "level": self.LEVEL_MAP.get(record.levelno, "info"),
            "service": SERVICE_NAME,
            "traceId": getattr(record, "traceId", ""),
            "requestId": getattr(record, "requestId", ""),
            "message": record.getMessage(),
            "pid": PID,
            "env": ENV,
            "version": VERSION,
        }

        # 선택적 확장 필드 (LogRecord extra 에서 복사)
        _EXTRA_KEYS = {
            "tag", "method", "path", "statusCode", "latencyMs",
            "userId", "ip", "queue", "deliveryTag", "retryCount",
            "exchange", "routingKey", "sagaStep", "from", "to",
            "studyId", "durationMs", "step", "compensationType",
            "reason", "errorCode", "action", "db", "elapsedMs",
            "queryNormalized", "paramCount", "operation", "table",
            "messageSize", "redelivered", "messageAgeMs", "result",
        }
        for key in _EXTRA_KEYS:
            val = getattr(record, key, None)
            if val is not None:
                entry[key] = val

        # 에러 필드 (예외 정보 있을 때만)
        if record.exc_info and record.exc_info[0] is not None:
            exc_type, exc_val, _ = record.exc_info
            error_obj: dict[str, Any] = {
                "name": exc_type.__name__ if exc_type else "UnknownError",
                "message": str(exc_val),
            }
            # production에서 stack trace 제거
            if ENV != "production":
                error_obj["stack"] = self.formatException(record.exc_info)
            # 에러 코드 (extra 에 있을 경우)
            if getattr(record, "code", None):
                error_obj["code"] = record.code  # type: ignore[attr-defined]
            entry["error"] = error_obj

        return json.dumps(entry, ensure_ascii=False, separators=(",", ":"))

    @staticmethod
    def _iso_now() -> str:
        """현재 시각을 ISO 8601 UTC (밀리초 포함) 형식으로 반환."""
        t = time.time()
        ms = int((t % 1) * 1000)
        import datetime
        dt = datetime.datetime.utcfromtimestamp(t)
        return dt.strftime(f"%Y-%m-%dT%H:%M:%S.{ms:03d}Z")


# ---------------------------------------------------------------------------
# 전역 로깅 초기화
# ---------------------------------------------------------------------------

def setup_logging() -> None:
    """
    전역 로깅 초기화.

    - root logger를 JsonFormatter로 교체
    - 로그 레벨: production → INFO, 그 외 → DEBUG
    - uvicorn.access 로그 억제 (HTTP 미들웨어 log_http()로 대체)
    - uvicorn.error 는 유지 (서버 기동/오류 메시지)
    """
    level = logging.INFO if ENV == "production" else logging.DEBUG

    # 핸들러: stdout, JSON 포맷
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    handler.setLevel(level)

    # Root logger 재설정
    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(level)

    # uvicorn.access 억제: HTTP 로그는 log_http() 미들웨어가 담당
    logging.getLogger("uvicorn.access").handlers.clear()
    logging.getLogger("uvicorn.access").propagate = False
    logging.getLogger("uvicorn.access").setLevel(logging.CRITICAL + 1)

    # uvicorn.error → root 전파 유지 (별도 핸들러 불필요)
    logging.getLogger("uvicorn.error").propagate = True

    # pika (RabbitMQ) 클라이언트 로그 레벨 조정 (verbose 방지)
    logging.getLogger("pika").setLevel(logging.WARNING)


# ---------------------------------------------------------------------------
# FastAPI HTTP 미들웨어용 헬퍼
# ---------------------------------------------------------------------------

def log_http(
    *,
    method: str,
    path: str,
    status_code: int,
    latency_ms: float,
    trace_id: str = "",
    request_id: str = "",
    user_id: str = "",
    ip: str = "",
    logger: logging.Logger | None = None,
) -> None:
    """
    FastAPI HTTP 요청 완료 시 구조화 로그를 기록하는 헬퍼.

    사용 예시 (middleware):
        async def dispatch(self, request: Request, call_next):
            start = time.perf_counter()
            response = await call_next(request)
            latency_ms = (time.perf_counter() - start) * 1000
            log_http(
                method=request.method,
                path=request.url.path,
                status_code=response.status_code,
                latency_ms=round(latency_ms, 2),
                trace_id=request.headers.get("x-trace-id", str(uuid.uuid4())),
                request_id=request.headers.get("x-request-id", str(uuid.uuid4())),
                ip=request.client.host if request.client else "",
            )
            return response

    보안:
    - path: 제어문자 제거, 최대 500자 truncate
    - ip: 마지막 옥텟 마스킹
    - 5xx → error 레벨, 4xx → warn 레벨, 2xx/3xx → info 레벨
    """
    _logger = logger or logging.getLogger(SERVICE_NAME)

    # Log Injection 방지
    safe_path = sanitize_str(path, max_len=500)
    safe_ip = mask_ip(ip) if ip else ""
    safe_method = sanitize_str(method, max_len=10).upper()

    # 로그 레벨 결정
    if status_code >= 500:
        log_level = logging.ERROR
    elif status_code >= 400:
        log_level = logging.WARNING
    else:
        log_level = logging.INFO

    extra: dict[str, Any] = {
        "traceId": trace_id or str(uuid.uuid4()),
        "requestId": request_id or str(uuid.uuid4()),
        "tag": "HTTP_REQUEST",
        "method": safe_method,
        "path": safe_path,
        "statusCode": status_code,
        "latencyMs": round(latency_ms, 2),
    }
    if safe_ip:
        extra["ip"] = safe_ip
    if user_id:
        extra["userId"] = user_id

    _logger.log(
        log_level,
        f"HTTP {safe_method} {safe_path} {status_code}",
        extra=extra,
    )
