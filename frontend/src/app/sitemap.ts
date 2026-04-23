/**
 * @file Next.js 사이트맵 — hreflang alternates 포함
 * @domain i18n
 * @layer app
 * @related src/lib/i18n/metadata.ts, src/app/robots.ts
 *
 * Sprint 122 Phase E: 각 URL에 alternates.languages(ko/en) 추가.
 * ko는 루트 경로, en은 /en 접두사 경로 (D2 URL prefix as-needed 결정).
 */

import type { MetadataRoute } from 'next';

/** 서비스 공개 기본 URL */
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://algosu.kr';

/**
 * 페이지 정의 목록.
 * path: 루트 기준 경로, changeFrequency: 변경 빈도, priority: 우선순위(0~1)
 */
interface PageEntry {
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
  priority: number;
}

const PAGES: PageEntry[] = [
  { path: '/', changeFrequency: 'daily', priority: 1 },
  { path: '/guest', changeFrequency: 'monthly', priority: 0.9 },
  { path: '/dashboard', changeFrequency: 'daily', priority: 0.8 },
  { path: '/problems', changeFrequency: 'daily', priority: 0.8 },
  { path: '/studies', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/analytics', changeFrequency: 'weekly', priority: 0.6 },
  { path: '/profile', changeFrequency: 'monthly', priority: 0.5 },
];

/**
 * 사이트맵 생성 함수.
 * 각 페이지에 ko/en hreflang alternates를 포함한다.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return PAGES.map(({ path, changeFrequency, priority }) => ({
    url: `${BASE_URL}${path}`,
    lastModified,
    changeFrequency,
    priority,
    alternates: {
      languages: {
        ko: `${BASE_URL}${path}`,
        en: `${BASE_URL}/en${path}`,
      },
    },
  }));
}
