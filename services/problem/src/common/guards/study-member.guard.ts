import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../cache/cache.module';
import { Request } from 'express';
import { StructuredLoggerService } from '../logger/structured-logger.service';

/**
 * 스터디 멤버십 검증 가드 (Problem Service)
 *
 * 검증 순서:
 * 1. X-User-ID + X-Study-ID 헤더 추출
 * 2. Redis 캐시 확인: membership:{study_id}:{user_id} (TTL 10분)
 * 3. 캐시 miss → Gateway Internal API 호출
 * 4. 비멤버 → 403 Forbidden (fail-close)
 */
@Injectable()
export class StudyMemberGuard implements CanActivate {
  private readonly MEMBER_TTL = 300; // 5분 — 통일 규격

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly configService: ConfigService,
    private readonly logger: StructuredLoggerService,
  ) {
    this.logger.setContext(StudyMemberGuard.name);
  }

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

    const cacheKey = `membership:${studyId}:${userId}`;
    let role: string | null = null;

    // 1. Redis 캐시 확인
    try {
      role = await this.redis.get(cacheKey);
    } catch (error: unknown) {
      this.logger.warn(`Redis 조회 실패: ${(error as Error).message}`);
    }

    // 2. 캐시 miss → Gateway Internal API 호출
    if (!role) {
      const gatewayUrl = this.configService.get<string>('GATEWAY_INTERNAL_URL', 'http://localhost:3000');
      const internalKey = this.configService.get<string>('INTERNAL_KEY_GATEWAY', '');
      const url = `${gatewayUrl}/internal/studies/${studyId}/members/${userId}`;

      try {
        const response = await fetch(
          url,
          {
            method: 'GET',
            headers: {
              'x-internal-key': internalKey,
              'Content-Type': 'application/json',
            },
          },
        );

        if (response.status === 404) {
          this.logger.warn(`스터디 멤버 아님: studyId=${studyId}, userId=${userId}`);
          throw new ForbiddenException('스터디 멤버가 아닙니다.');
        }

        if (!response.ok) {
          this.logger.error(
            `Gateway 멤버십 확인 실패: status=${response.status}, path=${request.path}`,
          );
          throw new ForbiddenException('스터디 멤버가 아닙니다.');
        }

        const data = (await response.json()) as { role: string };
        role = data.role;

        // Redis에 캐싱
        if (role) {
          try {
            await this.redis.set(cacheKey, role, 'EX', this.MEMBER_TTL);
          } catch (cacheErr: unknown) {
            this.logger.warn(`Redis 캐시 저장 실패: ${(cacheErr as Error).message}`);
          }
        }
      } catch (error: unknown) {
        if (error instanceof ForbiddenException) throw error;
        this.logger.error(`Gateway 멤버십 확인 실패: ${(error as Error).message}`);
        throw new ForbiddenException('스터디 멤버가 아닙니다.');
      }
    }

    if (!role || (role !== 'ADMIN' && role !== 'MEMBER')) {
      this.logger.warn(`스터디 멤버 역할 검증 실패: studyId=${studyId}, userId=${userId}, role=${role}`);
      throw new ForbiddenException('스터디 멤버가 아닙니다.');
    }

    request.studyRole = role;
    return true;
  }
}
