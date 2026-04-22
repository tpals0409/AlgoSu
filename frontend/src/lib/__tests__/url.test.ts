/**
 * @file URL 검증·정규화 유틸리티 테스트
 * @domain common
 * @layer test
 * @related url.ts
 */

import { isSafeUrl, sanitizeUrl } from '../url';

describe('isSafeUrl', () => {
  it.each([
    ['https://leetcode.com/problems/two-sum/', true],
    ['http://example.com', true],
    ['https://school.programmers.co.kr/learn/courses/30/lessons/1845', true],
    ['HTTPS://EXAMPLE.COM', true],
  ])('허용: %s → %s', (url, expected) => {
    expect(isSafeUrl(url)).toBe(expected);
  });

  it.each([
    ['javascript:alert(1)', false],
    ['javascript:void(0)', false],
    ['JAVASCRIPT:alert(1)', false],
    ['data:text/html,<script>alert(1)</script>', false],
    ['vbscript:msgbox("xss")', false],
    ['', false],
    ['not-a-url', false],
    ['ftp://files.example.com', false],
  ])('차단: %s → %s', (url, expected) => {
    expect(isSafeUrl(url)).toBe(expected);
  });
});

describe('sanitizeUrl', () => {
  it('안전한 URL이면 원본을 반환한다', () => {
    expect(sanitizeUrl('https://boj.kr/1000')).toBe('https://boj.kr/1000');
  });

  it('위험한 URL이면 undefined를 반환한다', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBeUndefined();
  });

  it('null이면 undefined를 반환한다', () => {
    expect(sanitizeUrl(null)).toBeUndefined();
  });

  it('undefined이면 undefined를 반환한다', () => {
    expect(sanitizeUrl(undefined)).toBeUndefined();
  });

  it('빈 문자열이면 undefined를 반환한다', () => {
    expect(sanitizeUrl('')).toBeUndefined();
  });
});
