/**
 * @file StudyMember Guard — 스터디 멤버십 사전 검증 + Redis 캐시
 * @domain common
 * @layer guard
 * @related GatewayContextMiddleware, ConfigService, Redis
 *
 * 보안:
 * - userId는 GatewayContextMiddleware가 검증한 request.user.userId에서 읽음
 *   (클라이언트 X-User-ID 헤더 직접 신뢰 금지 — P0 수정)
 * - studyId는 X-Study-ID 헤더에서 읽음 (UUID 형식 검증)
 */
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { StructuredLoggerService } from '../logger/structured-logger.service';
import { GatewayRequest } from '../middleware/gateway-context.middleware';

/** X-Study-ID UUID 형식 검증 정규식 */
const STUDY_ID_UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 허용 멤버 역할 */
const ALLOWED_ROLES = new Set(['ADMIN', 'MEMBER']);

/**
 * StudyMember Guard — 스터디 멤버십 사전 검증
 *
 * M4: Redis 캐시 사용 (인메모리 Map 제거)
 *
 * 검증 순서:
 * 1. request.user.userId 추출 (GatewayContextMiddleware 검증값 — 신뢰 컨텍스트)
 * 2. X-Study-ID 헤더 추출 + UUID 형식 검증
 * 3. Redis 캐시 확인: membership:{study_id}:{user_id} (TTL 5분)
 * 4. 캐시 miss → Gateway Internal API 호출
 * 5. 비멤버 → 403 Forbidden
 *
 * 보안: IDOR 방지 (studyId + userId 조합 검증)
 */
@Injectable()
export class StudyMemberGuard implements CanActivate {
  private readonly logger: StructuredLoggerService;
  private readonly redis: Redis;
  private static readonly CACHE_TTL_SECONDS = 300; // 5분 — 통일 규격

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
    const request = context.switchToHttp().getRequest<GatewayRequest>();

    // [P0 수정] request.user.userId 사용 — GatewayContextMiddleware가 검증한 신뢰 값
    // 클라이언트가 임의로 설정한 X-User-ID 헤더를 직접 읽지 않음
    const userId = request.user?.userId;

    if (!userId) {
      this.logger.warn(
        `사용자 컨텍스트 없음 (GatewayContextMiddleware 미실행?) — path: ${request.path}`,
      );
      throw new ForbiddenException('사용자 인증 컨텍스트가 없습니다.');
    }

    const studyId = request.headers['x-study-id'] as string | undefined;

    if (!studyId || typeof studyId !== 'string') {
      this.logger.warn(`X-Study-ID 헤더 없음 — path: ${request.path}`);
      throw new ForbiddenException('X-Study-ID 헤더가 필요합니다.');
    }

    if (!STUDY_ID_UUID_REGEX.test(studyId)) {
      this.logger.warn(
        `X-Study-ID UUID 형식 오류: studyId=${studyId} — path: ${request.path}`,
      );
      throw new ForbiddenException('X-Study-ID 형식이 올바르지 않습니다 (UUID 필수).');
    }

    return this.checkMembership(userId, studyId, request.path);
  }

  /**
   * 멤버십 검증: Redis 캐시 → Gateway Internal API 순으로 확인
   * @param userId 검증된 사용자 ID (GatewayContextMiddleware 설정값)
   * @param studyId 검증된 스터디 ID
   * @param path 로깅용 요청 경로
   */
  private async checkMembership(
    userId: string,
    studyId: string,
    path: string,
  ): Promise<boolean> {
    const cacheKey = `membership:${studyId}:${userId}`;
    let role: string | null = null;

    // M4: Redis 캐시 확인
    try {
      role = await this.redis.get(cacheKey);
    } catch (err: unknown) {
      this.logger.warn(`Redis 조회 실패: ${(err as Error).message}`);
    }

    if (role !== null) {
      return this.assertAllowedRole(role, studyId, userId, path);
    }

    return this.fetchAndCacheMembership(userId, studyId, cacheKey, path);
  }

  /**
   * 캐시된 역할이 허용 범위인지 검증
   */
  private assertAllowedRole(
    role: string,
    studyId: string,
    userId: string,
    path: string,
  ): boolean {
    if (!ALLOWED_ROLES.has(role)) {
      this.logger.warn(
        `스터디 멤버 역할 검증 실패: studyId=${studyId}, userId=${userId}, role=${role} — path: ${path}`,
      );
      throw new ForbiddenException('스터디 멤버가 아닙니다.');
    }
    return true;
  }

  /**
   * 캐시 miss → Gateway Internal API 호출 후 Redis 캐싱
   */
  private async fetchAndCacheMembership(
    userId: string,
    studyId: string,
    cacheKey: string,
    path: string,
  ): Promise<boolean> {
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
          `스터디 멤버 아님: studyId=${studyId}, userId=${userId} — path: ${path}`,
        );
        throw new ForbiddenException('스터디 멤버가 아닙니다.');
      }

      if (!response.ok) {
        this.logger.error(
          `Gateway 멤버십 확인 실패: status=${response.status} — path: ${path}`,
        );
        throw new ForbiddenException('스터디 멤버가 아닙니다.');
      }

      const data = (await response.json()) as { role: string };

      // Redis에 캐싱
      try {
        await this.redis.set(
          cacheKey,
          data.role,
          'EX',
          StudyMemberGuard.CACHE_TTL_SECONDS,
        );
      } catch (cacheErr: unknown) {
        this.logger.warn(`Redis 캐시 저장 실패: ${(cacheErr as Error).message}`);
      }

      return true;
    } catch (error: unknown) {
      if (error instanceof ForbiddenException) throw error;

      this.logger.error(
        `Gateway 멤버십 확인 중 예외: ${(error as Error).message} — path: ${path}`,
      );
      throw new ForbiddenException('스터디 멤버가 아닙니다.');
    }
  }
}
