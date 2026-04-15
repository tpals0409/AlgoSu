/**
 * @file request-id.middleware.ts — X-Request-Id / X-Trace-Id 헤더 부여 미들웨어
 * @domain common
 * @layer middleware
 * @related structured-logger.service.ts
 */
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { StructuredLoggerService } from '../logger/structured-logger.service';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  constructor(private readonly logger: StructuredLoggerService) {
    this.logger.setContext(RequestIdMiddleware.name);
  }

  use(req: Request, res: Response, next: NextFunction): void {
    // X-Request-Id: 클라이언트 전달값이 UUID 형식이면 재사용
    let requestId = req.headers['x-request-id'] as string | undefined;
    if (!requestId || !UUID_REGEX.test(requestId)) {
      requestId = randomUUID();
    }
    req.headers['x-request-id'] = requestId;

    // X-Trace-Id
    let traceId = req.headers['x-trace-id'] as string | undefined;
    if (!traceId || !UUID_REGEX.test(traceId)) {
      traceId = randomUUID();
    }
    req.headers['x-trace-id'] = traceId;

    // 응답 헤더에도 추가
    res.setHeader('X-Request-Id', requestId);
    res.setHeader('X-Trace-Id', traceId);

    next();
  }
}
