/**
 * @file URL 검증·정규화 유틸리티
 * @domain common
 * @layer lib
 * @related SubmissionView.tsx, AnalysisView.tsx
 *
 * 사용자 입력·DB 저장 URL을 href에 바인딩하기 전에
 * javascript: / data: 등 위험 프로토콜을 차단하여 저장형 XSS를 방지합니다.
 */

/** 허용 프로토콜 목록 */
const SAFE_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * URL 문자열이 안전한 프로토콜(http/https)인지 검증합니다.
 *
 * - `javascript:`, `data:`, `vbscript:` 등 위험 스킴을 차단합니다.
 * - 파싱 불가능한 문자열도 안전하지 않은 것으로 간주합니다.
 *
 * @param url 검증 대상 URL 문자열
 * @returns http/https 프로토콜이면 `true`, 그 외 `false`
 */
export function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return SAFE_PROTOCOLS.has(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * 안전한 URL이면 원본을 반환하고, 위험하면 `undefined`를 반환합니다.
 *
 * 조건부 렌더링과 함께 사용하여 위험 URL일 때 링크 자체를 숨깁니다.
 *
 * @example
 * ```tsx
 * const safe = sanitizeUrl(problem.sourceUrl);
 * {safe && <a href={safe}>문제 보기</a>}
 * ```
 *
 * @param url 정규화 대상 URL 문자열 (nullable)
 * @returns 안전한 URL 문자열 또는 `undefined`
 */
export function sanitizeUrl(url: string | undefined | null): string | undefined {
  if (!url) return undefined;
  return isSafeUrl(url) ? url : undefined;
}
