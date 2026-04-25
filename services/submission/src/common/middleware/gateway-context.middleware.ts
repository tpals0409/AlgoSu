/**
 * @file GatewayContext Middleware — 게이트웨이 신뢰 컨텍스트 확립
 * @domain common
 * @layer middleware
 * @related StudyMemberGuard, InternalKeyGuard, AppModule
 *
 * 보안 목적:
 * - X-Internal-Key 검증: 요청이 게이트웨이 경유 여부 보장 (timingSafeEqual)
 * - X-User-ID를 request.user에 주입: 클라이언트 헤더 직접 신뢰 차단
 * - 검증되지 않은 요청은 UnauthorizedException으로 즉시 차단
 *
 * 적용 범위:
 * - 제외(k8s 프로브): /health, /health/ready, /metrics, /api-docs
 * - 사용자 컨텍스트 불필요(서비스 간 내부 호출): /internal/*
 * - 나머지 모든 경로: X-Internal-Key + X-User-ID 필수
 */
import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';
import { StructuredLoggerService } from '../logger/structured-logger.service';

/** 게이트웨이가 검증 후 주입한 사용자 컨텍스트 */
export interface GatewayUser {
  userId: string;
}

/** 게이트웨이 컨텍스트가 확립된 요청 타입 */
export interface GatewayRequest extends Request {
  user?: GatewayUser;
}

/** 헬스 / 메트릭 / Swagger — 내부 키 검증 불필요 */
const PROBE_PATH_PREFIXES = ['/health', '/metrics', '/api-docs'];

/** 서비스 간 내부 호출 — 내부 키만 검증, 사용자 컨텍스트 불필요 */
const INTERNAL_PATH_PREFIX = '/internal';

/** X-User-ID UUID 형식 검증 정규식 */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class GatewayContextMiddleware implements NestMiddleware {
  private readonly logger: StructuredLoggerService;

  constructor(private readonly configService: ConfigService) {
    this.logger = new StructuredLoggerService();
    this.logger.setContext(GatewayContextMiddleware.name);
  }

  /**
   * 미들웨어 실행 순서:
   * 1. 프로브 경로 → 즉시 통과
   * 2. X-Internal-Key 검증 (timingSafeEqual)
   * 3. /internal/* → 통과 (사용자 컨텍스트 불필요)
   * 4. X-User-ID 추출 + UUID 형식 검증 → request.user 설정
   */
  use(req: GatewayRequest, _res: Response, next: NextFunction): void {
    // NestJS forRoutes('*')는 Express app.use('/(.*)', mw)로 마운트되어
    // req.path가 마운트 prefix만큼 strip됨 (`/health` → `/`).
    // 프로브 경로 우회를 위해 strip되지 않는 originalUrl을 사용하고
    // 쿼리스트링은 제거해 prefix 매칭만 수행한다.
    const path = this.resolveRequestPath(req);

    // 1. k8s 프로브 / Swagger — 내부 키 검증 불필요
    if (this.isProbe(path)) {
      return next();
    }

    // 2. X-Internal-Key 검증 — 요청 출처가 게이트웨이인지 보장
    this.validateInternalKey(req);

    // 3. /internal/* — 서비스 간 호출, 사용자 컨텍스트 없이 통과
    if (path.startsWith(INTERNAL_PATH_PREFIX)) {
      return next();
    }

    // 4. 사용자 컨텍스트 확립 — request.user에 설정
    const userId = this.extractAndValidateUserId(req);
    req.user = { userId };

    this.logger.log(`게이트웨이 컨텍스트 확립: userId=${userId}, path=${path}`);

    return next();
  }

  /**
   * 요청 경로를 mount-strip의 영향 없이 추출
   * - `req.originalUrl`은 Express가 raw URL을 보존 → forRoutes('*') 마운트에도 안전
   * - 쿼리스트링(`?ready=1`)은 prefix 매칭에 방해되므로 제거
   */
  private resolveRequestPath(req: GatewayRequest): string {
    const rawUrl = req.originalUrl ?? req.url ?? '/';
    const queryIdx = rawUrl.indexOf('?');
    return queryIdx === -1 ? rawUrl : rawUrl.slice(0, queryIdx);
  }

  /**
   * 경로가 프로브(헬스/메트릭/Swagger)인지 확인
   */
  private isProbe(path: string): boolean {
    return PROBE_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
  }

  /**
   * X-Internal-Key 헤더를 timingSafeEqual로 검증
   * @throws UnauthorizedException 키 없음 또는 불일치
   */
  private validateInternalKey(req: GatewayRequest): void {
    const providedKey = req.headers['x-internal-key'];
    const expectedKey = this.configService.getOrThrow<string>('INTERNAL_API_KEY');

    if (!providedKey || typeof providedKey !== 'string') {
      this.logger.warn(`X-Internal-Key 헤더 없음 — path: ${req.path}`);
      throw new UnauthorizedException('게이트웨이 인증 키가 필요합니다.');
    }

    if (!this.constantTimeEqual(providedKey, expectedKey)) {
      this.logger.warn(`X-Internal-Key 불일치 — path: ${req.path}`);
      throw new UnauthorizedException('유효하지 않은 게이트웨이 인증 키입니다.');
    }
  }

  /**
   * X-User-ID 헤더를 추출하고 UUID 형식을 검증
   * @throws UnauthorizedException 헤더 없음 또는 UUID 형식 오류
   */
  private extractAndValidateUserId(req: GatewayRequest): string {
    const userId = req.headers['x-user-id'];

    if (!userId || typeof userId !== 'string') {
      this.logger.warn(`X-User-ID 헤더 없음 — path: ${req.path}`);
      throw new UnauthorizedException('사용자 식별자 헤더가 필요합니다.');
    }

    if (!UUID_REGEX.test(userId)) {
      this.logger.warn(`X-User-ID UUID 형식 오류 — path: ${req.path}`);
      throw new UnauthorizedException('사용자 식별자 형식이 올바르지 않습니다 (UUID 필수).');
    }

    return userId;
  }

  /**
   * 타이밍 어택 방지 문자열 비교 (crypto.timingSafeEqual 래퍼)
   */
  private constantTimeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) {
      // 길이 다른 경우도 동일 시간 소비를 위해 더미 비교 수행
      timingSafeEqual(bufA, bufA);
      return false;
    }
    return timingSafeEqual(bufA, bufB);
  }
}
