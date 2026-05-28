/**
 * @file getBaseUrl SSOT 헬퍼 단위 테스트
 * @domain common
 * @layer test
 * @related src/lib/site-url.ts
 */

import { getBaseUrl } from '../site-url';

/**
 * 환경 변수 격리: getBaseUrl은 호출 시점에 env를 읽으므로
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

describe('getBaseUrl', () => {
  it('NEXT_PUBLIC_BASE_URL 설정 시 그 값을 반환', () => {
    process.env.NEXT_PUBLIC_BASE_URL = 'https://example.com';
    expect(getBaseUrl()).toBe('https://example.com');
  });

  it('NEXT_PUBLIC_BASE_URL 미설정 시 폴백 https://algo-su.com 반환', () => {
    delete process.env.NEXT_PUBLIC_BASE_URL;
    expect(getBaseUrl()).toBe('https://algo-su.com');
  });

  it('빈 문자열 설정 시 nullish coalescing이 빈 문자열을 그대로 반환', () => {
    process.env.NEXT_PUBLIC_BASE_URL = '';
    expect(getBaseUrl()).toBe('');
  });
});
