/**
 * @file 서비스 공개 기본 URL SSOT
 * @domain common
 * @layer lib
 * @related src/app/sitemap.ts, src/app/robots.ts, src/app/[locale]/layout.tsx, src/lib/i18n/metadata.ts
 *
 * Sprint 213: NEXT_PUBLIC_BASE_URL 폴백 리터럴(`https://algo-su.com`)을
 * 단일 헬퍼로 중앙화(SSOT). 도메인 변경 시 한 곳만 수정하면 모든 호출처에 반영된다.
 */

/** 서비스 공개 기본 URL 폴백 — 이 상수가 폴백 리터럴이 정의되는 유일한 SSOT */
const DEFAULT_BASE_URL = 'https://algo-su.com';

/**
 * 서비스 공개 기본 URL을 반환한다.
 *
 * 호출 시점에 `process.env.NEXT_PUBLIC_BASE_URL`을 평가하므로
 * SSR·테스트 환경에서 env override가 동적으로 반영된다
 * (모듈 로드 시점에 캐싱하지 않음 — 각 호출처의 평가 시점을 보존).
 *
 * `?? `(nullish coalescing)를 사용하므로 빈 문자열(`''`)은 falsy로 보지 않고
 * 그대로 반환되며, env 미설정(undefined)·null일 때만 폴백 `https://algo-su.com`을 반환한다.
 *
 * @returns NEXT_PUBLIC_BASE_URL 값, 미설정 시 폴백 `https://algo-su.com`
 */
export function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_BASE_URL ?? DEFAULT_BASE_URL;
}
