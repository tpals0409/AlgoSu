/**
 * @file Rate Limit 미들웨어 — 기본 600req/min + 제출 10req/min
 * @domain common
 * @layer middleware
 * @related redis-throttler.storage.ts
 */
import { Injectable, NestMiddleware, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RedisThrottlerStorage } from './redis-throttler.storage';

/**
 * Rate Limit 미들웨어 — 프록시 라우트에도 적용
 *
 * - default: 분당 600건 (인증 사용자: userId 기반, 비인증: IP 기반)
 * - submission: 분당 10건 (/api/submissions POST 전용)
 */
@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RateLimitMiddleware.name);
  private static readonly DEFAULT_LIMIT = Number(process.env['RATE_LIMIT_DEFAULT']) || 600;
  private static readonly SUBMISSION_LIMIT = 10;
  private static readonly TTL_MS = 60_000;

  constructor(private readonly storage: RedisThrottlerStorage) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    // /health는 인프라 probe용 — rate limit 제외
    if (req.path === '/health') {
      return next();
    }

    // 인증 사용자는 userId 기반, 비인증은 IP 기반
    const userId = req.headers['x-user-id'] as string | undefined;
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const identity = userId ? `user:${userId}` : `ip:${ip}`;

    // default throttler
    const defaultKey = `rl:default:${identity}`;
    const defaultRecord = await this.storage.increment(defaultKey, RateLimitMiddleware.TTL_MS);

    if (defaultRecord.totalHits > RateLimitMiddleware.DEFAULT_LIMIT) {
      this.logger.warn(`Rate limit 초과 (default): ${identity}`);
      this.setHeaders(res, defaultRecord.totalHits, RateLimitMiddleware.DEFAULT_LIMIT, defaultRecord.timeToExpire);
      throw new HttpException('Too Many Requests', HttpStatus.TOO_MANY_REQUESTS);
    }

    // submission throttler — POST /api/submissions 전용 (제출 생성만 제한)
    if (req.method === 'POST' && req.path === '/api/submissions') {
      const subKey = `rl:submission:${identity}`;
      const subRecord = await this.storage.increment(subKey, RateLimitMiddleware.TTL_MS);

      if (subRecord.totalHits > RateLimitMiddleware.SUBMISSION_LIMIT) {
        this.logger.warn(`Rate limit 초과 (submission): ${identity}`);
        res.setHeader('X-RateLimit-Limit-submission', RateLimitMiddleware.SUBMISSION_LIMIT);
        res.setHeader('X-RateLimit-Remaining-submission', 0);
        res.setHeader('Retry-After', Math.ceil(subRecord.timeToExpire / 1000));
        throw new HttpException('Too Many Requests', HttpStatus.TOO_MANY_REQUESTS);
      }

      res.setHeader('X-RateLimit-Limit-submission', RateLimitMiddleware.SUBMISSION_LIMIT);
      res.setHeader('X-RateLimit-Remaining-submission',
        Math.max(0, RateLimitMiddleware.SUBMISSION_LIMIT - subRecord.totalHits));
      res.setHeader('X-RateLimit-Reset-submission', subRecord.timeToExpire);
    }

    this.setHeaders(res, defaultRecord.totalHits, RateLimitMiddleware.DEFAULT_LIMIT, defaultRecord.timeToExpire);
    next();
  }

  private setHeaders(res: Response, hits: number, limit: number, timeToExpire: number): void {
    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - hits));
    res.setHeader('X-RateLimit-Reset', timeToExpire);
  }
}
