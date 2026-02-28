import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../cache/cache.module';
import { Request } from 'express';

/**
 * 스터디 멤버십 검증 가드 (Problem Service)
 *
 * 검증 순서:
 * 1. X-User-ID + X-Study-ID 헤더 추출
 * 2. Redis 캐시 확인: study_member:{study_id}:{user_id} (TTL 10분)
 * 3. 캐시 miss → Gateway Internal API 호출
 * 4. 비멤버 → 403 Forbidden
 */
@Injectable()
export class StudyMemberGuard implements CanActivate {
  private readonly logger = new Logger(StudyMemberGuard.name);
  private readonly MEMBER_TTL = 600; // 10분

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { studyRole?: string }>();

    const userId = request.headers['x-user-id'];
    const studyId = request.headers['x-study-id'];

    if (!userId || typeof userId !== 'string') {
      this.logger.warn(`X-User-ID 헤더 없음 — path: ${request.path}`);
      throw new ForbiddenException('X-User-ID 헤더가 필요합니다.');
    }

    if (!studyId || typeof studyId !== 'string') {
      this.logger.warn(`X-Study-ID 헤더 없음 — path: ${request.path}`);
      throw new ForbiddenException('X-Study-ID 헤더가 필요합니다.');
    }

    const cacheKey = `study_member:${studyId}:${userId}`;
    let role: string | null = null;

    // 1. Redis 캐시 확인
    try {
      role = await this.redis.get(cacheKey);
    } catch (error: unknown) {
      this.logger.warn(`Redis 조회 실패: ${(error as Error).message}`);
    }

    // 2. 캐시 miss → Gateway Internal API 호출
    if (!role) {
      try {
        const gatewayUrl = this.configService.get<string>('GATEWAY_INTERNAL_URL', 'http://localhost:3000');
        const internalKey = this.configService.get<string>('INTERNAL_KEY_GATEWAY', '');
        const response = await fetch(
          `${gatewayUrl}/internal/studies/${studyId}/members/${userId}`,
          { headers: { 'x-internal-key': internalKey } },
        );

        if (response.ok) {
          const data = (await response.json()) as { role: string };
          role = data.role;
          // Redis에 캐싱
          try {
            await this.redis.set(cacheKey, role, 'EX', this.MEMBER_TTL);
          } catch { /* 캐시 실패 무시 */ }
        }
      } catch (error: unknown) {
        this.logger.warn(`Gateway 멤버십 확인 실패: ${(error as Error).message}`);
      }
    }

    if (!role || (role !== 'ADMIN' && role !== 'MEMBER')) {
      throw new ForbiddenException('스터디 멤버가 아닙니다.');
    }

    request.studyRole = role;
    return true;
  }
}
