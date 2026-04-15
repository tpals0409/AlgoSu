/**
 * @file structured-logger.service.ts — JSON 구조화 로거 (Loki/Promtail 호환)
 * @domain common
 * @layer service
 * @related logger.module.ts, metrics.service.ts
 */

/**
 * H10: Submission Service — Structured Logger
 *
 * JSON 구조화 로그 출력 (Loki/Promtail 호환)
 * 규칙 근거: /docs/monitoring-log-rules.md §1
 */
import { Injectable, LoggerService, LogLevel } from '@nestjs/common';

const SERVICE_NAME = 'submission' as const;
const VERSION = process.env['SERVICE_VERSION'] ?? '1.0.0';
const ENV = process.env['ENV'] ?? 'development';
const PID = process.pid;

type InternalLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  ts: string;
  level: InternalLevel;
  service: string;
  traceId: string;
  requestId: string;
  message: string;
  pid: number;
  env: string;
  version: string;
  context?: string;
  error?: { name: string; message: string; stack?: string };
  [key: string]: unknown;
}

const LEVEL_PRIORITY: Record<InternalLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const MIN_LEVEL: InternalLevel = ENV === 'production' ? 'info' : 'debug';
const CONTROL_CHAR_RE = /[\x00-\x1f\x7f]/g;

function sanitize(value: string, maxLen = 500): string {
  return value.replace(CONTROL_CHAR_RE, '').slice(0, maxLen);
}

@Injectable()
export class StructuredLoggerService implements LoggerService {
  private context = '';

  setContext(context: string): void { this.context = context; }

  log(message: string, ...params: unknown[]): void { this.emit('info', message, params); }
  error(message: string, ...params: unknown[]): void { this.emit('error', message, params); }
  warn(message: string, ...params: unknown[]): void { this.emit('warn', message, params); }
  debug(message: string, ...params: unknown[]): void { this.emit('debug', message, params); }
  verbose(message: string, ...params: unknown[]): void { this.emit('debug', message, params); }
  fatal(message: string, ...params: unknown[]): void { this.emit('error', message, params); }
  setLogLevels?(_levels: LogLevel[]): void {}

  private emit(level: InternalLevel, message: string, optionalParams: unknown[]): void {
    if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[MIN_LEVEL]) return;

    let context = this.context;
    let extra: Record<string, unknown> = {};
    let error: Error | undefined;

    for (const param of optionalParams) {
      if (typeof param === 'string') context = param;
      else if (param instanceof Error) error = param;
      else if (param !== null && typeof param === 'object') extra = { ...extra, ...(param as Record<string, unknown>) };
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

    if (context) entry.context = sanitize(context, 100);

    const { traceId: _t, requestId: _r, ...restExtra } = extra;
    for (const [key, value] of Object.entries(restExtra)) {
      if (value !== undefined && value !== null) entry[key] = value;
    }

    if (error) {
      entry.error = { name: error.name, message: sanitize(error.message, 500) };
      if (ENV !== 'production' && error.stack) entry.error.stack = error.stack;
    }

    process.stdout.write(JSON.stringify(entry) + '\n');
  }
}
