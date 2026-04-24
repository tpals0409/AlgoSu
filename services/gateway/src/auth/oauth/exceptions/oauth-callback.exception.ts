/**
 * @file OAuth 콜백 에러 코드 정규화 예외 클래스 7종 (ADR-025)
 * @domain identity
 * @layer exception
 * @related oauth.controller.ts, oauth.service.ts, ADR-025
 *
 * 프론트엔드 ALLOWED_ERRORS 화이트리스트와 1:1 매핑되는 고정 ASCII 에러 코드를 정의한다.
 * controller catch 블록에서 instanceof OAuthCallbackException 검사 후
 * code 필드를 URL fragment에 전달하여 encodeURIComponent(한글) 패턴을 폐지한다.
 */

import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * OAuth 콜백 에러 코드 7종 — 프론트엔드 ALLOWED_ERRORS와 1:1 매핑
 * @see frontend/src/app/[locale]/(auth)/callback/page.tsx
 */
export type OAuthCallbackErrorCode =
  | 'access_denied'
  | 'missing_params'
  | 'invalid_state'
  | 'token_exchange'
  | 'profile_fetch'
  | 'account_conflict'
  | 'auth_failed';

/**
 * OAuth 콜백 예외 기반 클래스
 * controller catch 블록에서 instanceof 검사 후 code 필드를 redirect URL에 전달
 */
export class OAuthCallbackException extends HttpException {
  readonly code: OAuthCallbackErrorCode;

  constructor(
    code: OAuthCallbackErrorCode,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    super(`OAuth callback error: ${code}`, status);
    this.code = code;
  }
}

/** OAuth 제공자에서 사용자가 인증을 거부 */
export class OAuthAccessDeniedException extends OAuthCallbackException {
  constructor() {
    super('access_denied');
  }
}

/** code/state 파라미터 누락 */
export class OAuthMissingParamsException extends OAuthCallbackException {
  constructor() {
    super('missing_params');
  }
}

/** CSRF state 검증 실패 (만료 또는 불일치) */
export class OAuthInvalidStateException extends OAuthCallbackException {
  constructor() {
    super('invalid_state');
  }
}

/** OAuth 토큰 교환 실패 */
export class OAuthTokenExchangeException extends OAuthCallbackException {
  constructor() {
    super('token_exchange');
  }
}

/** OAuth 프로필 조회 실패 */
export class OAuthProfileFetchException extends OAuthCallbackException {
  constructor() {
    super('profile_fetch');
  }
}

/** 이메일 중복 등 계정 충돌 */
export class OAuthAccountConflictException extends OAuthCallbackException {
  constructor() {
    super('account_conflict', HttpStatus.CONFLICT);
  }
}

/** 기타 분류 불가 OAuth 에러 (default fallback) */
export class OAuthAuthFailedException extends OAuthCallbackException {
  constructor() {
    super('auth_failed', HttpStatus.INTERNAL_SERVER_ERROR);
  }
}
