/**
 * @file buildLocaleAlternates 헬퍼 단위 테스트
 * @domain i18n
 * @layer test
 * @related src/lib/i18n/metadata.ts
 */

import { buildLocaleAlternates } from '../metadata';

/**
 * 환경 변수 격리: buildLocaleAlternates는 호출 시점에 env를 읽으므로
 * 각 테스트 후 원복만 하면 충분하다 (모듈 리셋 불필요).
 */
const ORIGINAL_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL;

afterEach(() => {
  if (ORIGINAL_BASE_URL === undefined) {
    delete process.env.NEXT_PUBLIC_BASE_URL;
  } else {
    process.env.NEXT_PUBLIC_BASE_URL = ORIGINAL_BASE_URL;
  }
});

describe('buildLocaleAlternates', () => {
  describe('BASE_URL 기본값 (환경 변수 미설정)', () => {
    beforeEach(() => {
      delete process.env.NEXT_PUBLIC_BASE_URL;
    });

    it('ko locale 기본 경로("/")에서 canonical은 루트 URL', () => {
      const result = buildLocaleAlternates('ko', '/');
      expect(result?.canonical).toBe('https://algosu.kr/');
    });

    it('x-default는 항상 ko URL', () => {
      const result = buildLocaleAlternates('en', '/problems');
      expect((result?.languages as Record<string, string>)?.['x-default']).toBe(
        'https://algosu.kr/problems',
      );
    });
  });

  describe('ko locale canonical 전환', () => {
    it('ko locale의 canonical은 접두사 없는 koUrl', () => {
      process.env.NEXT_PUBLIC_BASE_URL = 'https://example.com';
      const result = buildLocaleAlternates('ko', '/dashboard');
      expect(result?.canonical).toBe('https://example.com/dashboard');
    });

    it('ko languages 객체에 ko/en/x-default 모두 포함', () => {
      process.env.NEXT_PUBLIC_BASE_URL = 'https://example.com';
      const result = buildLocaleAlternates('ko', '/dashboard');
      const langs = result?.languages as Record<string, string>;
      expect(langs.ko).toBe('https://example.com/dashboard');
      expect(langs.en).toBe('https://example.com/en/dashboard');
      expect(langs['x-default']).toBe('https://example.com/dashboard');
    });
  });

  describe('en locale canonical 전환', () => {
    it('en locale의 canonical은 /en 접두사 포함 enUrl', () => {
      process.env.NEXT_PUBLIC_BASE_URL = 'https://example.com';
      const result = buildLocaleAlternates('en', '/problems');
      expect(result?.canonical).toBe('https://example.com/en/problems');
    });

    it('en locale에서도 x-default는 ko URL 유지', () => {
      process.env.NEXT_PUBLIC_BASE_URL = 'https://example.com';
      const result = buildLocaleAlternates('en', '/problems');
      const langs = result?.languages as Record<string, string>;
      expect(langs['x-default']).toBe('https://example.com/problems');
    });
  });
});
