import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

/**
 * StudyMember Guard — 스터디 멤버십 사전 검증
 *
 * 검증 순서:
 * 1. X-User-ID + X-Study-ID 헤더 추출
 * 2. Redis 캐시 확인: study_member:{study_id}:{user_id} (TTL 10분)
 * 3. 캐시 miss → Gateway Internal API 호출
 * 4. 비멤버 → 403 Forbidden
 *
 * 보안: IDOR 방지 (studyId + userId 조합 검증)
 */
@Injectable()
export class StudyMemberGuard implements CanActivate {
  private readonly logger = new Logger(StudyMemberGuard.name);

  // 인메모리 캐시 (Redis 미연결 시 fallback)
  private readonly cache = new Map<string, { role: string; expiresAt: number }>();
  private static readonly CACHE_TTL_MS = 10 * 60 * 1000; // 10분

  constructor(private readonly configService: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const userId = request.headers['x-user-id'] as string | undefined;
    const studyId = request.headers['x-study-id'] as string | undefined;

    if (!userId || !studyId) {
      throw new ForbiddenException('X-User-ID 및 X-Study-ID 헤더가 필요합니다.');
    }

    // 캐시 확인
    const cacheKey = `study_member:${studyId}:${userId}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      // 캐시 히트 — role을 request에 저장
      (request as any).studyMemberRole = cached.role;
      return true;
    }

    // 캐시 miss — Gateway Internal API 호출
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
        throw new ForbiddenException('해당 스터디의 멤버가 아닙니다.');
      }

      if (!response.ok) {
        this.logger.error(
          `Gateway 멤버십 확인 실패: status=${response.status}`,
        );
        throw new ForbiddenException('멤버십 확인에 실패했습니다.');
      }

      const data = (await response.json()) as { role: string };

      // 캐시 저장
      this.cache.set(cacheKey, {
        role: data.role,
        expiresAt: Date.now() + StudyMemberGuard.CACHE_TTL_MS,
      });

      // role을 request에 저장
      (request as any).studyMemberRole = data.role;

      return true;
    } catch (error: unknown) {
      if (error instanceof ForbiddenException) throw error;

      this.logger.error(
        `Gateway 멤버십 확인 실패: ${(error as Error).message}`,
      );
      throw new ForbiddenException('멤버십 확인에 실패했습니다.');
    }
  }
}
