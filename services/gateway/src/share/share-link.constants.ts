/**
 * @file ShareLink 관련 상수 — 토큰 검증 정규식, 바이트 수
 * @domain share
 * @layer constant
 * @related share-link.guard.ts, share-link.service.ts
 */

/** 공유 링크 토큰 정규식 — 256bit hex (64자) */
export const SHARE_LINK_TOKEN_REGEX = /^[a-f0-9]{64}$/;

/** 공유 링크 토큰 바이트 수 */
export const SHARE_LINK_TOKEN_BYTES = 32;
