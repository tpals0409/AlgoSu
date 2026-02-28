/**
 * AlgoSu Gateway — Request ID Middleware
 * ---------------------------------------
 * 규칙 근거: /docs/monitoring-log-rules.md §1-4
 *
 * 역할:
 * - 모든 HTTP 요청에 X-Request-Id, X-Trace-Id 헤더 부여
 * - 클라이언트가 전송한 X-Request-Id가 있으면 재사용 (UUID 형식 검증)
 * - X-Trace-Id: 제출 흐름이면 submissionId 재사용, 아니면 UUID 생성
 * - 응답 헤더에도 X-Request-Id, X-Trace-Id 추가 (디버깅 편의)
 * - 요청 완료 시 구조화 HTTP 로그 출력
 *
 * 보안 요구사항:
 * - IP 마지막 옥텟 마스킹
 * - path 제어문자 제거
 * - 5xx → error, 4xx → warn, 나머지 → info
 */
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { StructuredLoggerService } from '../logger/structured-logger.service';
import { sanitizePath, maskIp, sanitizeUserAgent } from '../logger/sanitize';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  constructor(private readonly logger: StructuredLoggerService) {
    this.logger.setContext('RequestIdMiddleware');
  }

  use(req: Request, res: Response, next: NextFunction): void {
    const start = process.hrtime.bigint();

    // X-Request-Id: 클라이언트 전달값이 UUID 형식이면 재사용, 아니면 생성
    let requestId = req.headers['x-request-id'] as string | undefined;
    if (!requestId || !UUID_REGEX.test(requestId)) {
      requestId = uuidv4();
    }
    req.headers['x-request-id'] = requestId;

    // X-Trace-Id: 제출 흐름이면 submissionId 재사용, 아니면 UUID 생성
    let traceId = req.headers['x-trace-id'] as string | undefined;
    if (!traceId || !UUID_REGEX.test(traceId)) {
      traceId = uuidv4();
    }
    req.headers['x-trace-id'] = traceId;

    // 응답 헤더에도 추가 (클라이언트 디버깅 편의)
    res.setHeader('X-Request-Id', requestId);
    res.setHeader('X-Trace-Id', traceId);

    // 응답 완료 시 구조화 HTTP 로그 출력
    res.on('finish', () => {
      const elapsed = Number(process.hrtime.bigint() - start) / 1_000_000;
      const statusCode = res.statusCode;

      const safePath = sanitizePath(req.originalUrl || req.url);
      const safeIp = maskIp(req.ip ?? req.socket.remoteAddress ?? 'unknown');
      const safeUa = sanitizeUserAgent(
        (req.headers['user-agent'] as string) ?? '',
      );

      // 로그 레벨 결정: 5xx → error, 4xx → warn, 나머지 → info
      const logExtra = {
        traceId,
        requestId,
        tag: 'HTTP_REQUEST',
        method: req.method,
        path: safePath,
        statusCode,
        latencyMs: Math.round(elapsed * 100) / 100,
        ip: safeIp,
        userAgent: safeUa,
        userId: (req.headers['x-user-id'] as string) ?? '',
      };

      const message = `${req.method} ${safePath} ${statusCode}`;

      if (statusCode >= 500) {
        this.logger.error(message, logExtra);
      } else if (statusCode >= 400) {
        this.logger.warn(message, logExtra);
      } else {
        this.logger.log(message, logExtra);
      }
    });

    next();
  }
}
