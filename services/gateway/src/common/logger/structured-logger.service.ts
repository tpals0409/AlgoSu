/**
 * AlgoSu Gateway — Structured Logger Service
 * --------------------------------------------
 * 규칙 근거: /docs/monitoring-log-rules.md §1
 *
 * NestJS LoggerService 인터페이스 구현.
 * 모든 로그를 JSON 구조화 포맷으로 stdout에 출력한다.
 *
 * 보안 요구사항:
 * - console.log 사용 금지, process.stdout.write 직접 사용
 * - production 환경에서 debug 출력 안 함
 * - production 환경에서 stack trace 제거
 * - 모든 문자열 필드 제어문자 제거
 */
import { Injectable, LoggerService, LogLevel } from '@nestjs/common';

const SERVICE_NAME = 'gateway' as const;
const VERSION = process.env['SERVICE_VERSION'] ?? '1.0.0';
const ENV = process.env['ENV'] ?? 'development';
const PID = process.pid;

type InternalLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  ts: string;
  level: InternalLevel;
  service: typeof SERVICE_NAME;
  traceId: string;
  requestId: string;
  message: string;
  pid: number;
  env: string;
  version: string;
  context?: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  [key: string]: unknown;
}

const LEVEL_PRIORITY: Record<InternalLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const MIN_LEVEL: InternalLevel = ENV === 'production' ? 'info' : 'debug';

// 제어문자 제거 패턴
const CONTROL_CHAR_RE = /[\x00-\x1f\x7f]/g;

function sanitize(value: string, maxLen = 500): string {
  return value.replace(CONTROL_CHAR_RE, '').slice(0, maxLen);
}

@Injectable()
export class StructuredLoggerService implements LoggerService {
  private context = '';

  setContext(context: string): void {
    this.context = context;
  }

  log(message: string, ...optionalParams: unknown[]): void {
    this.emit('info', message, optionalParams);
  }

  error(message: string, ...optionalParams: unknown[]): void {
    this.emit('error', message, optionalParams);
  }

  warn(message: string, ...optionalParams: unknown[]): void {
    this.emit('warn', message, optionalParams);
  }

  debug(message: string, ...optionalParams: unknown[]): void {
    this.emit('debug', message, optionalParams);
  }

  verbose(message: string, ...optionalParams: unknown[]): void {
    this.emit('debug', message, optionalParams);
  }

  fatal(message: string, ...optionalParams: unknown[]): void {
    this.emit('error', message, optionalParams);
  }

  setLogLevels?(_levels: LogLevel[]): void {
    // NestJS 인터페이스 충족용 — 실제 레벨은 ENV로 제어
  }

  private emit(
    level: InternalLevel,
    message: string,
    optionalParams: unknown[],
  ): void {
    if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[MIN_LEVEL]) return;

    // NestJS 패턴: 마지막 파라미터가 context 문자열인 경우
    let context = this.context;
    let extra: Record<string, unknown> = {};
    let error: Error | undefined;

    for (const param of optionalParams) {
      if (typeof param === 'string') {
        context = param;
      } else if (param instanceof Error) {
        error = param;
      } else if (param !== null && typeof param === 'object') {
        extra = { ...extra, ...(param as Record<string, unknown>) };
      }
    }

    const entry: LogEntry = {
      ts: new Date().toISOString(),
      level,
      service: SERVICE_NAME,
      traceId: (extra['traceId'] as string) ?? '',
      requestId: (extra['requestId'] as string) ?? '',
      message: sanitize(message),
      pid: PID,
      env: ENV,
      version: VERSION,
    };

    if (context) {
      entry.context = sanitize(context, 100);
    }

    // 확장 필드 병합 (traceId, requestId 중복 제외)
    const { traceId: _t, requestId: _r, ...restExtra } = extra;
    for (const [key, value] of Object.entries(restExtra)) {
      if (value !== undefined && value !== null) {
        entry[key] = value;
      }
    }

    // 에러 직렬화
    if (error) {
      entry.error = {
        name: error.name,
        message: sanitize(error.message, 500),
      };
      if (ENV !== 'production' && error.stack) {
        entry.error.stack = error.stack;
      }
    }

    process.stdout.write(JSON.stringify(entry) + '\n');
  }
}
