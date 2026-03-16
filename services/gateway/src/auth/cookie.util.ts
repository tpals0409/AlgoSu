/**
 * @file httpOnly Cookie JWT 발급 유틸리티
 * @domain identity
 * @layer util
 * @related OAuthController, TokenRefreshInterceptor
 */

import { Response } from 'express';

/**
 * 시간 문자열('1h', '30m', '7d', '3600s', '3600')을 초 단위로 변환
 * JWT expiresIn과 동일한 포맷을 지원하여 SSoT를 보장한다.
 * @param value 시간 문자열 또는 숫자(초)
 * @returns 초 단위 정수
 */
export function parseTimeToSeconds(value: string | number): number {
  if (typeof value === 'number') return Math.floor(value);

  const match = value.match(/^(\d+)(s|m|h|d)?$/);
  if (!match) throw new Error(`지원하지 않는 시간 형식: ${value}`);

  const amount = parseInt(match[1], 10);
  const unit = match[2] ?? 's';

  switch (unit) {
    case 's': return amount;
    case 'm': return amount * 60;
    case 'h': return amount * 3600;
    case 'd': return amount * 86400;
    default:  return amount;
  }
}

/**
 * JWT를 httpOnly Cookie로 설정
 * @param res Express Response 객체
 * @param token JWT 문자열
 * @param nodeEnv 현재 환경 (production 시 Secure 플래그 활성화)
 * @param jwtExpiresIn JWT 만료 시간 문자열 (SSoT — 쿠키 maxAge를 이 값에서 파생)
 */
export function setTokenCookie(
  res: Response,
  token: string,
  nodeEnv: string,
  jwtExpiresIn: string = '1h',
): void {
  const isProduction = nodeEnv === 'production';
  const maxAgeSeconds = parseTimeToSeconds(jwtExpiresIn);

  res.cookie('token', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeSeconds * 1000, // ms 단위
  });
}
