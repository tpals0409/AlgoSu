/**
 * @file httpOnly Cookie JWT 발급 유틸리티
 * @domain identity
 * @layer util
 * @related OAuthController, TokenRefreshInterceptor
 *
 * SSoT 원칙: Cookie maxAge는 JWT 토큰의 exp claim을 디코딩해서 동적으로 계산한다.
 * 이렇게 하면 JWT_EXPIRES_IN env 값이 변경되어도 Cookie 만료가 자동 동기화된다.
 */

import { Response } from 'express';
import * as jwt from 'jsonwebtoken';

/**
 * exp claim 디코딩 실패 시 사용하는 방어적 fallback 만료(ms) — 1시간.
 * 정상 경로에서는 절대 사용되지 않으며, 토큰 파싱에 실패했을 때만 적용된다.
 */
const FALLBACK_MAX_AGE_MS = 60 * 60 * 1000;

/**
 * JWT 토큰의 exp claim 기반으로 남은 만료 시간(ms)을 계산한다.
 * exp가 없거나 디코딩 실패 또는 이미 만료된 경우 null 반환.
 */
function computeMaxAgeMsFromJwt(token: string): number | null {
  try {
    const decoded = jwt.decode(token) as jwt.JwtPayload | null;
    if (!decoded?.exp) return null;
    const remainingMs = decoded.exp * 1000 - Date.now();
    return remainingMs > 0 ? remainingMs : null;
  } catch {
    return null;
  }
}

/**
 * JWT를 httpOnly Cookie로 설정.
 * maxAge는 토큰의 exp claim을 SSoT로 사용하며, 디코딩 실패 시 fallback 1시간.
 *
 * @param res Express Response 객체
 * @param token JWT 문자열
 * @param nodeEnv 현재 환경 (production 시 Secure 플래그 활성화)
 */
export function setTokenCookie(
  res: Response,
  token: string,
  nodeEnv: string,
): void {
  const isProduction = nodeEnv === 'production';

  const computedMaxAgeMs = computeMaxAgeMsFromJwt(token);
  const maxAge = computedMaxAgeMs ?? FALLBACK_MAX_AGE_MS;

  if (computedMaxAgeMs === null) {
    // 토큰 파싱 실패 — JSON structured log 태그로 출력 (GlobalExceptionFilter 바깥이라 console 사용)
    console.warn(
      JSON.stringify({
        level: 'warn',
        event: 'cookie_maxage_fallback',
        context: 'cookie.util',
        message: 'JWT exp claim 디코딩 실패 — fallback maxAge 적용',
        fallbackMs: FALLBACK_MAX_AGE_MS,
      }),
    );
  }

  res.cookie('token', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge,
  });
}
