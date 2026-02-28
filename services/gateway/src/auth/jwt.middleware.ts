import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';

/**
 * JWT 검증 미들웨어
 *
 * 보안 요구사항:
 * - HS256 알고리즘 명시 고정 (algorithms 배열에 'none' 포함 불가)
 * - exp 클레임 자동 검증 (jsonwebtoken 기본 동작, ignoreExpiration 미설정)
 * - exp 없는 토큰 명시적 거부
 * - 검증 성공 시 X-User-ID 헤더 주입
 * - X-Study-ID: 클라이언트 헤더에서 읽기 → UUID 형식 검증 → 내부 전달
 * - 로그에 JWT 원문 절대 출력 금지
 */
@Injectable()
export class JwtMiddleware implements NestMiddleware {
  private readonly logger = new Logger(JwtMiddleware.name);
  private readonly ALLOWED_ALGORITHMS: jwt.Algorithm[] = ['HS256'];
  private readonly UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  constructor(private readonly configService: ConfigService) {}

  use(req: Request, _res: Response, next: NextFunction): void {
    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Authorization 헤더가 없거나 형식이 올바르지 않습니다.');
    }

    const token = authHeader.slice(7);
    const secret = this.configService.getOrThrow<string>('JWT_SECRET');

    let payload: jwt.JwtPayload;

    try {
      const decoded = jwt.verify(token, secret, {
        algorithms: this.ALLOWED_ALGORITHMS, // 'none' 알고리즘 명시적 배제
        complete: false,
        // ignoreExpiration 미설정 → false (기본값) → exp 자동 검증
      });

      if (typeof decoded === 'string' || !decoded) {
        throw new UnauthorizedException('JWT 페이로드가 올바르지 않습니다.');
      }

      payload = decoded as jwt.JwtPayload;
    } catch (error: unknown) {
      // 로그에 토큰 원문 절대 포함 금지
      if (error instanceof jwt.TokenExpiredError) {
        this.logger.warn('JWT 만료');
        throw new UnauthorizedException('토큰이 만료되었습니다.');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        this.logger.warn(`JWT 검증 실패: ${error.message}`);
        throw new UnauthorizedException('유효하지 않은 토큰입니다.');
      }
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error('JWT 미들웨어 예상치 못한 오류');
      throw new UnauthorizedException('인증 처리 중 오류가 발생했습니다.');
    }

    // exp 클레임 존재 여부 추가 확인 (만료 기한 없는 토큰 거부)
    if (!payload['exp']) {
      this.logger.warn('exp 클레임이 없는 토큰 거부');
      throw new UnauthorizedException('토큰에 만료 시간(exp)이 없습니다.');
    }

    const userId = payload['sub'] ?? payload['userId'];

    if (!userId || typeof userId !== 'string') {
      throw new UnauthorizedException('토큰에 사용자 ID가 없습니다.');
    }

    // 검증 성공 — 내부 서비스 전달용 헤더 주입
    req.headers['x-user-id'] = userId;

    // X-Study-ID: 클라이언트 헤더에서 읽기 → UUID 형식 검증 → 내부 전달
    const studyId = req.headers['x-study-id'];
    if (studyId && typeof studyId === 'string') {
      if (!this.UUID_REGEX.test(studyId)) {
        throw new UnauthorizedException('X-Study-ID 형식이 올바르지 않습니다 (UUID 필수).');
      }
      req.headers['x-study-id'] = studyId;
    }

    // 원본 Authorization 헤더 제거 (내부 서비스로 JWT 전달 차단)
    delete req.headers['authorization'];

    this.logger.log(`JWT 검증 성공: userId=${userId}`);
    next();
  }
}
