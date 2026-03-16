/**
 * @file httpOnly Cookie JWT 발급 유틸리티
 * @domain identity
 * @layer util
 * @related OAuthController, TokenRefreshInterceptor
 */

import { Response } from 'express';

/** JWT 쿠키 만료 시간 (초) — 1시간 */
const COOKIE_MAX_AGE_SECONDS = 60 * 60;

/**
 * JWT를 httpOnly Cookie로 설정
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

  res.cookie('token', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE_SECONDS * 1000, // ms 단위
  });
}
