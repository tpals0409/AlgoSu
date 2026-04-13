/**
 * @file       i18n.ts
 * @domain     blog
 * @layer      lib
 * @related    src/components/home-page.tsx, src/components/post-page.tsx
 *
 * i18n 인프라 — 블로그 UI 문자열의 ko/en 이중 언어 사전과 유틸리티.
 */

export type Locale = 'ko' | 'en';

const DICTIONARY = {
  ko: {
    siteTitle: 'AlgoSu Tech Blog',
    siteDescription:
      'AI 에이전트 12명과 함께 만드는 알고리즘 스터디 플랫폼의 아키텍처 결정과 기술 여정',
    noPosts: '아직 게시물이 없습니다.',
    blogHome: '블로그 홈',
    olderPost: '← 지난 글',
    newerPost: '새 글 →',
    navPostLabel: '포스트 네비게이션',
    themeSystem: '시스템 추적',
    themeLight: '라이트 모드',
    themeDark: '다크 모드',
    themeTogglePrefix: '현재:',
    themeToggleSuffix: ', 클릭하면',
    themeToggleAction: '로 전환',
  },
  en: {
    siteTitle: 'AlgoSu Tech Blog',
    siteDescription:
      'Architecture decisions and engineering journey of an algorithm study platform built with 12 AI agents',
    noPosts: 'No posts yet.',
    blogHome: 'Blog Home',
    olderPost: '← Older',
    newerPost: 'Newer →',
    navPostLabel: 'Post navigation',
    themeSystem: 'System',
    themeLight: 'Light mode',
    themeDark: 'Dark mode',
    themeTogglePrefix: 'Current:',
    themeToggleSuffix: ', click for',
    themeToggleAction: '',
  },
} as const;

export type DictKey = keyof (typeof DICTIONARY)['ko'];

/** Returns localized string for the given key. */
export function t(locale: Locale, key: DictKey): string {
  return DICTIONARY[locale][key];
}

/** Returns base path for locale-aware links. */
export function getBasePath(locale: Locale): string {
  return locale === 'en' ? '/en' : '';
}
