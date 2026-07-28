/**
 * @file Rate Limit 미들웨어 — 기본 600req/min + 제출 30req/min
 * @domain common
 * @layer middleware
 * @related redis-throttler.storage.ts
 */
import { Injectable, NestMiddleware, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';
import { RedisThrottlerStorage } from './redis-throttler.storage';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';

/**
 * Rate Limit 미들웨어 — 프록시 라우트에도 적용
 *
 * - default: 분당 600건 (인증 사용자: userId 기반, 비인증: IP 기반)
 * - submission: 분당 30건 (/api/submissions POST 전용, RATE_LIMIT_SUBMISSION 로 조정)
 *
 * @remarks
 * 한도값은 `ConfigService`(생성자 주입)로 읽는다. static 필드로 `process.env` 를 직접 읽으면
 * 클래스 로드 시점이 `ConfigModule` 의 `.env` 로딩보다 앞서 `.env` 오버라이드가 무시된다 (Critic PR#513 P2).
 */
@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private static readonly TTL_MS = 60_000;

  private readonly defaultLimit: number;
  private readonly submissionLimit: number;

  constructor(
    private readonly storage: RedisThrottlerStorage,
    private readonly logger: StructuredLoggerService,
    private readonly configService: ConfigService,
  ) {
    this.logger.setContext(RateLimitMiddleware.name);
    this.defaultLimit = Number(this.configService.get<string>('RATE_LIMIT_DEFAULT')) || 600;
    this.submissionLimit = Number(this.configService.get<string>('RATE_LIMIT_SUBMISSION')) || 30;
  }

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    // /health는 인프라 probe용 — rate limit 제외
    if (req.path === '/health') {
      return next();
    }

    // 인증 사용자는 userId 기반, 비인증은 IP 기반
    // Sprint 239 S-1 메모: HeaderSanitizerMiddleware가 외부 x-user-id를 가장 먼저 제거하므로
    // 여기서 보이는 x-user-id는 ProxyDispatchMiddleware 경유 시 게이트웨이 산물(JwtMiddleware 주입)뿐.
    // 단 RateLimit은 JwtMiddleware보다 먼저 실행되므로 이 미들웨어 시점에서 userId는 항상 비어 있고,
    // 결과적으로 identity는 항상 IP 기반으로 결정된다 (userId 분기는 미들웨어 체인 재배치 대비 보존).
    const userId = req.headers['x-user-id'] as string | undefined;
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const identity = userId ? `user:${userId}` : `ip:${ip}`;

    // default throttler
    const defaultKey = `rl:default:${identity}`;
    const defaultRecord = await this.storage.increment(defaultKey, RateLimitMiddleware.TTL_MS);

    if (defaultRecord.totalHits > this.defaultLimit) {
      this.logger.warn(`Rate limit 초과 (default): ${identity}`);
      this.setHeaders(res, defaultRecord.totalHits, this.defaultLimit, defaultRecord.timeToExpire);
      throw new HttpException('Too Many Requests', HttpStatus.TOO_MANY_REQUESTS);
    }

    // submission throttler — POST /api/submissions 전용 (제출 생성만 제한)
    if (req.method === 'POST' && req.path === '/api/submissions') {
      const subKey = `rl:submission:${identity}`;
      const subRecord = await this.storage.increment(subKey, RateLimitMiddleware.TTL_MS);

      if (subRecord.totalHits > this.submissionLimit) {
        this.logger.warn(`Rate limit 초과 (submission): ${identity}`);
        res.setHeader('X-RateLimit-Limit-submission', this.submissionLimit);
        res.setHeader('X-RateLimit-Remaining-submission', 0);
        res.setHeader('Retry-After', Math.ceil(subRecord.timeToExpire / 1000));
        throw new HttpException('Too Many Requests', HttpStatus.TOO_MANY_REQUESTS);
      }

      res.setHeader('X-RateLimit-Limit-submission', this.submissionLimit);
      res.setHeader('X-RateLimit-Remaining-submission',
        Math.max(0, this.submissionLimit - subRecord.totalHits));
      res.setHeader('X-RateLimit-Reset-submission', subRecord.timeToExpire);
    }

    this.setHeaders(res, defaultRecord.totalHits, this.defaultLimit, defaultRecord.timeToExpire);
    next();
  }

  private setHeaders(res: Response, hits: number, limit: number, timeToExpire: number): void {
    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - hits));
    res.setHeader('X-RateLimit-Reset', timeToExpire);
  }
}
