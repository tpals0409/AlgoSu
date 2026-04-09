/**
 * @file 토큰 자동 갱신 인터셉터 — 만료 임계값 이내 요청 시 새 쿠키 발급 (sliding session)
 * @domain identity
 * @layer middleware
 * @related JwtMiddleware, OAuthService, SessionPolicyService, cookie.util
 *
 * JWT 만료 임계값 이내 감지 시 응답에 새 토큰 쿠키를 자동 발급한다.
 * 임계값은 SessionPolicyService에서 주입 — env `SESSION_REFRESH_THRESHOLD` 로 제어.
 * JwtMiddleware 이후 실행되므로 req.headers['x-user-id']가 보장된다.
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable, tap } from 'rxjs';
import { Request, Response } from 'express';
import * as jwt from 'jsonwebtoken';
import { setTokenCookie } from './cookie.util';
import { OAuthService } from './oauth/oauth.service';
import { SessionPolicyService } from './session-policy/session-policy.service';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';

@Injectable()
export class TokenRefreshInterceptor implements NestInterceptor {
  constructor(
    private readonly configService: ConfigService,
    private readonly oauthService: OAuthService,
    private readonly sessionPolicy: SessionPolicyService,
    private readonly logger: StructuredLoggerService,
  ) {
    this.logger.setContext(TokenRefreshInterceptor.name);
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();

    const token = req.cookies?.['token'] as string | undefined;
    if (!token) {
      return next.handle();
    }

    const remainingMs = this.getRemainingMs(token);
    const thresholdMs = this.sessionPolicy.getRefreshThresholdMs();
    if (remainingMs === null || remainingMs > thresholdMs) {
      return next.handle();
    }

    // 만료 임박 — 응답 후 새 토큰 쿠키 발급
    const userId = req.headers['x-user-id'] as string | undefined;
    if (!userId) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(() => {
        void this.refreshAndSetCookie(userId, res);
      }),
    );
  }

  /**
   * JWT exp까지 남은 시간(ms) 반환. 디코딩 실패 또는 exp 부재 시 null.
   */
  private getRemainingMs(token: string): number | null {
    try {
      // 서명 검증 없이 payload만 디코딩 (JwtMiddleware에서 이미 검증됨)
      const decoded = jwt.decode(token) as jwt.JwtPayload | null;
      if (!decoded?.exp) return null;
      return decoded.exp * 1000 - Date.now();
    } catch {
      return null;
    }
  }

  /**
   * 새 JWT 발급 후 쿠키 설정 (비동기 — 응답 차단 방지)
   */
  private async refreshAndSetCookie(userId: string, res: Response): Promise<void> {
    try {
      const user = await this.oauthService.findUserById(userId);
      if (!user) return;

      // OAuthService.issueJwt는 private이므로 공개 메서드를 통해 토큰 재발급
      const newToken = this.oauthService.issueAccessToken(user);
      const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');

      // 응답이 이미 전송되지 않았으면 쿠키 설정
      if (!res.headersSent) {
        setTokenCookie(res, newToken, nodeEnv);
        this.logger.log(`토큰 자동 갱신: userId=${userId}`);
      }
    } catch (err) {
      this.logger.error(`토큰 자동 갱신 실패: ${(err as Error).message}`);
    }
  }
}
