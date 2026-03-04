/**
 * @file StudyMember Guard — 스터디 멤버십 사전 검증 + Redis 캐시
 * @domain common
 * @layer guard
 * @related ConfigService, Redis
 */
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import Redis from 'ioredis';
import { StructuredLoggerService } from '../logger/structured-logger.service';

/**
 * Express Request에 StudyMemberGuard가 주입하는 멤버십 역할 필드를 추가합니다.
 */
interface StudyMemberRequest extends Request {
  studyMemberRole: string;
}

/**
 * StudyMember Guard — 스터디 멤버십 사전 검증
 *
 * M4: Redis 캐시 사용 (인메모리 Map 제거)
 *
 * 검증 순서:
 * 1. X-User-ID + X-Study-ID 헤더 추출
 * 2. Redis 캐시 확인: study:membership:{study_id}:{user_id} (TTL 10분)
 * 3. 캐시 miss → Gateway Internal API 호출
 * 4. 비멤버 → 403 Forbidden
 *
 * 보안: IDOR 방지 (studyId + userId 조합 검증)
 */
@Injectable()
export class StudyMemberGuard implements CanActivate {
  private readonly logger: StructuredLoggerService;
  private readonly redis: Redis;
  private static readonly CACHE_TTL_SECONDS = 600; // 10분

  constructor(private readonly configService: ConfigService) {
    this.logger = new StructuredLoggerService();
    this.logger.setContext(StudyMemberGuard.name);
    const redisUrl = this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');
    this.redis = new Redis(redisUrl);
    this.redis.on('error', (err: Error) => {
      this.logger.error(`Redis 연결 오류: ${err.message}`);
    });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const userId = request.headers['x-user-id'] as string | undefined;
    const studyId = request.headers['x-study-id'] as string | undefined;

    if (!userId || typeof userId !== 'string') {
      this.logger.warn(`X-User-ID 헤더 없음 — path: ${request.path}`);
      throw new ForbiddenException('X-User-ID 헤더가 필요합니다.');
    }

    if (!studyId || typeof studyId !== 'string') {
      this.logger.warn(`X-Study-ID 헤더 없음 — path: ${request.path}`);
      throw new ForbiddenException('X-Study-ID 헤더가 필요합니다.');
    }

    const cacheKey = `study:membership:${studyId}:${userId}`;
    let role: string | null = null;

    // M4: Redis 캐시 확인
    try {
      role = await this.redis.get(cacheKey);
    } catch (err: unknown) {
      this.logger.warn(`Redis 조회 실패: ${(err as Error).message}`);
    }

    if (role) {
      (request as StudyMemberRequest).studyMemberRole = role;
      return true;
    }

    // 캐시 miss → Gateway Internal API 호출
    const gatewayUrl = this.configService.getOrThrow<string>('GATEWAY_INTERNAL_URL');
    const internalKey = this.configService.getOrThrow<string>('INTERNAL_KEY_GATEWAY');

    try {
      const response = await fetch(
        `${gatewayUrl}/internal/studies/${studyId}/members/${userId}`,
        {
          method: 'GET',
          headers: {
            'x-internal-key': internalKey,
            'Content-Type': 'application/json',
          },
        },
      );

      if (response.status === 404) {
        this.logger.warn(
          `스터디 멤버 아님: studyId=${studyId}, userId=${userId}`,
        );
        throw new ForbiddenException('스터디 멤버가 아닙니다.');
      }

      if (!response.ok) {
        this.logger.error(
          `Gateway 멤버십 확인 실패: status=${response.status}`,
        );
        throw new ForbiddenException('스터디 멤버가 아닙니다.');
      }

      const data = (await response.json()) as { role: string };

      // Redis에 캐싱
      try {
        await this.redis.set(cacheKey, data.role, 'EX', StudyMemberGuard.CACHE_TTL_SECONDS);
      } catch { /* 캐시 실패 무시 — fail-open */ }

      (request as StudyMemberRequest).studyMemberRole = data.role;

      return true;
    } catch (error: unknown) {
      if (error instanceof ForbiddenException) throw error;

      this.logger.error(
        `Gateway 멤버십 확인 실패: ${(error as Error).message}`,
      );
      throw new ForbiddenException('스터디 멤버가 아닙니다.');
    }
  }
}
