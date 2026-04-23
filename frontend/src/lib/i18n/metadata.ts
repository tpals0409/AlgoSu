/**
 * @file SEO 메타데이터 헬퍼 — locale hreflang alternates 생성
 * @domain i18n
 * @layer lib
 * @related app/[locale]/*, src/app/sitemap.ts, src/i18n/routing.ts
 *
 * Sprint 122 Phase E — D3 결정사항 반영:
 * - ko는 루트 경로(`/`), en은 접두사 경로(`/en`)
 * - x-default는 항상 ko(기본 언어)
 */

import type { Metadata } from 'next';

/**
 * 주어진 locale과 경로(path)에 대한 hreflang alternates 메타데이터를 생성한다.
 *
 * BASE_URL은 호출 시점의 NEXT_PUBLIC_BASE_URL 환경 변수를 읽으므로
 * 테스트·SSR 환경 모두에서 동적으로 반영된다.
 *
 * @param locale - 현재 페이지의 locale ('ko' | 'en')
 * @param path   - 루트 기준 경로 (예: '/', '/problems', '/dashboard')
 * @returns Next.js Metadata['alternates'] 형식의 객체
 *
 * @example
 * buildLocaleAlternates('ko', '/problems')
 * // {
 * //   canonical: 'https://algosu.kr/problems',
 * //   languages: {
 * //     ko: 'https://algosu.kr/problems',
 * //     en: 'https://algosu.kr/en/problems',
 * //     'x-default': 'https://algosu.kr/problems',
 * //   }
 * // }
 */
export function buildLocaleAlternates(
  locale: string,
  path: string,
): Metadata['alternates'] {
  /** 호출 시점에 평가 — 테스트에서 env override 가능 */
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://algosu.kr';

  const koUrl = `${baseUrl}${path}`;
  const enUrl = `${baseUrl}/en${path}`;

  return {
    canonical: locale === 'ko' ? koUrl : enUrl,
    languages: {
      ko: koUrl,
      en: enUrl,
      'x-default': koUrl,
    },
  };
}
