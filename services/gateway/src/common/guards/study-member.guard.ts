/**
 * @file 스터디 멤버십 검증 가드 (fail-close)
 * @domain study
 * @layer guard
 * @guard study-member
 * @related StudyMember, StudyController
 */
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { Request } from 'express';
import { StructuredLoggerService } from '../logger/structured-logger.service';
import { IdentityClientService } from '../../identity-client/identity-client.service';

@Injectable()
export class StudyMemberGuard implements CanActivate {
  private readonly redis: Redis;
  private static readonly CACHE_TTL = 300; // 5분

  constructor(
    private readonly configService: ConfigService,
    private readonly identityClient: IdentityClientService,
    private readonly logger: StructuredLoggerService,
  ) {
    this.logger.setContext(StudyMemberGuard.name);
    const redisUrl = this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');
    this.redis = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const userId = req.headers['x-user-id'] as string;
    const studyId = req.params['id'] || req.params['studyId'];

    if (!userId || !studyId) {
      throw new ForbiddenException('사용자 또는 스터디 정보가 없습니다.');
    }

    const cacheKey = `membership:${studyId}:${userId}`;
    const deniedKey = `${cacheKey}:denied`;

    // 1. Redis 캐시 확인
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached === 'ADMIN' || cached === 'MEMBER') return true;

      const denied = await this.redis.get(deniedKey);
      if (denied) throw new ForbiddenException('해당 스터디의 멤버가 아닙니다.');
    } catch (err) {
      if (err instanceof ForbiddenException) throw err;
      this.logger.warn(`Redis 캐시 조회 실패 — DB 폴백: ${(err as Error).message}`);
    }

    // 2. Identity API 폴백 (fail-close: 확인 불가하면 거부)
    let member: Record<string, unknown> | null = null;
    try {
      member = await this.identityClient.getMember(studyId, userId);
    } catch {
      member = null;
    }

    if (!member) {
      // 비멤버: denied 키에 캐시 (짧은 TTL 60초)
      try { await this.redis.set(deniedKey, '1', 'EX', 60); } catch (err: unknown) {
        this.logger.warn(`Redis 캐시 저장 실패 (비멤버): ${(err as Error).message}`);
      }
      throw new ForbiddenException('해당 스터디의 멤버가 아닙니다.');
    }

    // 멤버: role 문자열로 캐시 (TTL 300초)
    try { await this.redis.set(cacheKey, String(member['role'] ?? 'MEMBER'), 'EX', StudyMemberGuard.CACHE_TTL); } catch (err: unknown) {
      this.logger.warn(`Redis 캐시 저장 실패 (멤버): ${(err as Error).message}`);
    }

    return true;
  }
}
