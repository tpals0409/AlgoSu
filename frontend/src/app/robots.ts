/**
 * @file robots.txt 생성 — 크롤러 접근 제어 + sitemap 링크
 * @domain i18n
 * @layer app
 * @related src/app/sitemap.ts
 *
 * Sprint 122 Phase E: NEXT_PUBLIC_BASE_URL 통일 (NEXT_PUBLIC_API_BASE_URL 대체).
 */

import type { MetadataRoute } from 'next';

/** 서비스 공개 기본 URL */
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://algosu.kr';

/**
 * robots.txt 생성 함수.
 * - 모든 크롤러에 루트 경로 허용
 * - API·인증 경로는 색인 제외
 * - sitemap.xml 위치 명시
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/auth/', '/callback'],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
