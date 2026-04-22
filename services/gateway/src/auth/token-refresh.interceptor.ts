/**
 * @file 토큰 자동 갱신 인터셉터 — 만료 임계값 이내 요청 시 새 쿠키 발급 (sliding session)
 * @domain identity
 * @layer middleware
 * @related JwtMiddleware, OAuthService, SessionPolicyService, cookie.util
 *
 * JWT 만료 임계값 이내 감지 시 응답에 새 토큰 쿠키를 자동 발급한다.
 * 임계값은 SessionPolicyService에서 주입 — env `SESSION_REFRESH_THRESHOLD` 로 제어.
 *
 * [보안] 사용자 식별자는 반드시 쿠키 JWT payload(sub)에서 추출한다.
 * 클라이언트가 보낸 x-user-id 헤더는 신뢰하지 않는다.
 * 공개 라우트(JwtMiddleware 제외)에서도 임의 헤더로 타인 JWT를 발급받는 스푸핑 방지.
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

/** 쿠키 JWT에서 추출한 갱신 판단 데이터 */
interface TokenInfo {
  remainingMs: number;
  userId: string;
}

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

    // JWT payload에서 만료 정보와 userId 추출 — 클라이언트 헤더(x-user-id) 미사용
    const tokenInfo = this.decodeToken(token);
    if (!tokenInfo) {
      return next.handle();
    }

    const thresholdMs = this.sessionPolicy.getRefreshThresholdMs();
    if (tokenInfo.remainingMs > thresholdMs) {
      return next.handle();
    }

    // 만료 임박 — 응답 후 새 토큰 쿠키 발급
    const { userId } = tokenInfo;

    return next.handle().pipe(
      tap(() => {
        void this.refreshAndSetCookie(userId, res);
      }),
    );
  }

  /**
   * 쿠키 JWT payload 디코딩 — exp·sub 추출.
   * 서명 검증은 JwtMiddleware 담당이며, userId는 반드시 토큰 자체에서 추출하여 스푸핑 방지.
   * @param token httpOnly 쿠키에서 읽은 JWT 원문
   * @returns 만료까지 남은 ms와 userId. 디코딩 실패·exp/sub 부재 시 null.
   */
  private decodeToken(token: string): TokenInfo | null {
    try {
      const decoded = jwt.decode(token) as jwt.JwtPayload | null;
      if (!decoded?.exp) return null;

      const remainingMs = decoded.exp * 1000 - Date.now();
      const userId = decoded.sub ?? (decoded['userId'] as string | undefined);
      if (!userId) return null;

      return { remainingMs, userId };
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
        setTokenCookie(res, newToken, nodeEnv, this.logger);
        this.logger.log(`토큰 자동 갱신: userId=${userId}`);
      }
    } catch (err) {
      this.logger.error(`토큰 자동 갱신 실패: ${(err as Error).message}`);
    }
  }
}
