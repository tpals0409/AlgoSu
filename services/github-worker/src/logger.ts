/**
 * AlgoSu GitHub Worker — Structured Logger
 * -----------------------------------------
 * 규칙 근거: /docs/monitoring-log-rules.md
 *
 * 보안 요구사항:
 * - process.stdout.write() 직접 사용 (console.log 금지)
 * - production 환경에서 debug 출력 안 함
 * - production 환경에서 stack trace 제거
 * - GitHub App Token / X-Internal-Key / Authorization 로그 금지
 * - path, queue 등 사용자 입력값 제어문자 제거 + truncate
 * - Log Injection 방지: 반드시 JSON 구조화 출력
 */

// ---------------------------------------------------------------------------
// 공통 상수
// ---------------------------------------------------------------------------

const SERVICE_NAME = 'github-worker' as const;
const VERSION = process.env['SERVICE_VERSION'] ?? '1.0.0';
const ENV = process.env['ENV'] ?? 'development';
const PID = process.pid;

// Log Injection 방지: 제어문자 패턴
const CONTROL_CHAR_RE = /[\x00-\x1f\x7f]/g;

// ---------------------------------------------------------------------------
// 타입 정의
// ---------------------------------------------------------------------------

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** 공통 필수 필드 (monitoring-log-rules.md §1-1) */
interface BaseLogEntry {
  ts: string;
  level: LogLevel;
  service: typeof SERVICE_NAME;
  traceId: string;
  message: string;
  pid: number;
  env: string;
  version: string;
}

/** RabbitMQ 확장 필드 (monitoring-log-rules.md §6) */
interface MQFields {
  queue?: string;
  deliveryTag?: number;
  retryCount?: number;
  redelivered?: boolean;
  messageAgeMs?: number;
  exchange?: string;
  routingKey?: string;
  sagaStep?: string;
  messageSize?: number;
  result?: string;
  durationMs?: number;
}

/** 에러 확장 필드 (monitoring-log-rules.md §1-3) */
interface ErrorFields {
  error?: {
    name: string;
    message: string;
    /** development 환경에서만 포함 */
    stack?: string;
    code?: string;
  };
}

/** Saga 확장 필드 (monitoring-log-rules.md §5) */
interface SagaFields {
  tag?: string;
  from?: string;
  to?: string;
  studyId?: string;
  userId?: string;
  step?: string;
  compensationType?: string;
  reason?: string;
  errorCode?: string;
  action?: string;
}

/** logger 메서드에 전달하는 선택적 컨텍스트 */
export interface LogContext extends MQFields, SagaFields {
  traceId?: string;
  err?: Error | unknown;
  /** 에러 코드 (GHW_BIZ_001 등, monitoring-log-rules.md §7) */
  code?: string;
}

type LogEntry = BaseLogEntry & MQFields & ErrorFields & SagaFields & {
  tag?: string;
  code?: string;
  [key: string]: unknown;
};

// ---------------------------------------------------------------------------
// 보안 유틸리티
// ---------------------------------------------------------------------------

/** 제어문자 제거 + 길이 truncate (Log Injection 방지) */
function sanitizeStr(value: string, maxLen = 500): string {
  return value.replace(CONTROL_CHAR_RE, '').slice(0, maxLen);
}

// ---------------------------------------------------------------------------
// ISO 8601 UTC (밀리초 포함)
// ---------------------------------------------------------------------------

function isoNow(): string {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// 에러 직렬화
// ---------------------------------------------------------------------------

function serializeError(
  err: Error | unknown,
  code?: string,
): LogEntry['error'] {
  if (err instanceof Error) {
    const obj: NonNullable<LogEntry['error']> = {
      name: err.name,
      message: sanitizeStr(err.message, 500),
    };
    // production에서 stack trace 제거 (monitoring-log-rules.md §1-3)
    if (ENV !== 'production' && err.stack) {
      obj.stack = err.stack;
    }
    if (code) obj.code = code;
    return obj;
  }
  return {
    name: 'UnknownError',
    message: sanitizeStr(String(err), 500),
    ...(code ? { code } : {}),
  };
}

// ---------------------------------------------------------------------------
// 핵심 직렬화 함수
// ---------------------------------------------------------------------------

function buildEntry(
  level: LogLevel,
  message: string,
  ctx: LogContext = {},
): LogEntry {
  const { err, traceId, code, ...rest } = ctx;

  const entry: LogEntry = {
    ts: isoNow(),
    level,
    service: SERVICE_NAME,
    traceId: traceId ?? '',
    message: sanitizeStr(message, 500),
    pid: PID,
    env: ENV,
    version: VERSION,
  };

  // RabbitMQ / Saga 확장 필드 병합 (undefined 키 제외)
  const MQ_SAGA_KEYS: (keyof typeof rest)[] = [
    'queue', 'deliveryTag', 'retryCount', 'redelivered',
    'messageAgeMs', 'exchange', 'routingKey', 'sagaStep',
    'messageSize', 'result', 'durationMs',
    'tag', 'from', 'to', 'studyId', 'userId',
    'step', 'compensationType', 'reason', 'errorCode', 'action',
  ];

  for (const key of MQ_SAGA_KEYS) {
    const val = rest[key as keyof typeof rest];
    if (val !== undefined && val !== null) {
      // queue 필드는 제어문자 방지 처리
      if (key === 'queue' && typeof val === 'string') {
        (entry as Record<string, unknown>)[key] = sanitizeStr(val, 200);
      } else {
        (entry as Record<string, unknown>)[key] = val;
      }
    }
  }

  // 에러 직렬화
  if (err !== undefined) {
    entry.error = serializeError(err, code);
  } else if (code) {
    entry.code = code;
  }

  return entry;
}

/** JSON 한 줄 → stdout (console.log 금지, monitoring-log-rules.md §1) */
function emit(entry: LogEntry): void {
  process.stdout.write(JSON.stringify(entry) + '\n');
}

// ---------------------------------------------------------------------------
// 레벨별 숫자 (필터링용)
// ---------------------------------------------------------------------------

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/** 현재 환경의 최소 출력 레벨 결정 (monitoring-log-rules.md §2-2) */
const MIN_LEVEL: LogLevel = ENV === 'production' ? 'info' : 'debug';

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[MIN_LEVEL];
}

// ---------------------------------------------------------------------------
// 공개 Logger 인터페이스
// ---------------------------------------------------------------------------

export const logger = {
  /**
   * DEBUG — 개발/진단 목적 (production에서 출력 안 함)
   * 사용 예: SQL, MQ 메시지 본문, 캐시 히트/미스
   */
  debug(message: string, ctx?: LogContext): void {
    if (!shouldLog('debug')) return;
    emit(buildEntry('debug', message, ctx));
  },

  /**
   * INFO — 정상 비즈니스 이벤트 및 상태 변화
   * 사용 예: MQ_CONSUME, MQ_CONSUME_DONE, SAGA_TRANSITION
   */
  info(message: string, ctx?: LogContext): void {
    if (!shouldLog('info')) return;
    emit(buildEntry('info', message, ctx));
  },

  /**
   * WARN — 동작은 계속되나 주의 필요, 일시적 실패, 재시도
   * 사용 예: TOKEN_INVALID 재시도 불필요 판단, 재시도 경고
   */
  warn(message: string, ctx?: LogContext): void {
    if (!shouldLog('warn')) return;
    emit(buildEntry('warn', message, ctx));
  },

  /**
   * ERROR — 서비스 정상 동작 불가, 데이터 손실, 처리 불가 예외
   * 사용 예: DLQ_RECEIVED, 최종 실패, MQ nack
   */
  error(message: string, ctx?: LogContext): void {
    if (!shouldLog('error')) return;
    emit(buildEntry('error', message, ctx));
  },
} as const;

// ---------------------------------------------------------------------------
// MQ 특화 로깅 헬퍼 (monitoring-log-rules.md §6)
// ---------------------------------------------------------------------------

export interface MQConsumeOptions {
  traceId: string;
  queue: string;
  deliveryTag: number;
  redelivered: boolean;
  messageAgeMs?: number;
}

export interface MQConsumeDoneOptions extends MQConsumeOptions {
  result: 'ACK' | 'NACK_DLQ';
  durationMs: number;
}

/** MQ_CONSUME 로그 (소비 시작) */
export function logMqConsume(opts: MQConsumeOptions): void {
  logger.info('MQ 메시지 소비 시작', {
    tag: 'MQ_CONSUME',
    traceId: opts.traceId,
    queue: opts.queue,
    deliveryTag: opts.deliveryTag,
    redelivered: opts.redelivered,
    ...(opts.messageAgeMs !== undefined ? { messageAgeMs: opts.messageAgeMs } : {}),
  });
}

/** MQ_CONSUME_DONE 로그 (소비 완료) */
export function logMqConsumeDone(opts: MQConsumeDoneOptions): void {
  const level: LogLevel = opts.result === 'NACK_DLQ' ? 'error' : 'info';
  logger[level]('MQ 메시지 소비 완료', {
    tag: 'MQ_CONSUME_DONE',
    traceId: opts.traceId,
    queue: opts.queue,
    deliveryTag: opts.deliveryTag,
    redelivered: opts.redelivered,
    result: opts.result,
    durationMs: opts.durationMs,
  });
}

/** DLQ_RECEIVED 로그 (즉시 error, monitoring-log-rules.md §6-3) */
export function logDlqReceived(opts: {
  traceId: string;
  queue: string;
  deliveryTag: number;
  reason: string;
  err?: Error | unknown;
}): void {
  logger.error('Dead Letter Queue 메시지 수신', {
    tag: 'DLQ_RECEIVED',
    traceId: opts.traceId,
    queue: opts.queue,
    deliveryTag: opts.deliveryTag,
    reason: opts.reason,
    code: 'MQ_002',
    ...(opts.err ? { err: opts.err } : {}),
  });
}
