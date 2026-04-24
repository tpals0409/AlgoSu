/**
 * @file locale-path 유틸리티 테스트
 * @domain i18n
 * @layer test
 * @related locale-path.ts, i18n/routing.ts
 */

import { extractLocalePrefix, stripLocalePrefix } from '../locale-path';

// ── extractLocalePrefix (순수 함수 — getLocalePrefix/withLocalePrefix의 핵심 로직) ──

describe('extractLocalePrefix', () => {
  it('ko(기본 locale) 경로에서 빈 문자열 반환', () => {
    expect(extractLocalePrefix('/dashboard')).toBe('');
  });

  it('루트 경로(/)에서 빈 문자열 반환', () => {
    expect(extractLocalePrefix('/')).toBe('');
  });

  it('/en 정확 매칭 시 /en 반환', () => {
    expect(extractLocalePrefix('/en')).toBe('/en');
  });

  it('/en/dashboard 경로에서 /en 반환', () => {
    expect(extractLocalePrefix('/en/dashboard')).toBe('/en');
  });

  it('/enterprise 등 false positive 방지 — 빈 문자열 반환', () => {
    expect(extractLocalePrefix('/enterprise')).toBe('');
  });

  it('/en/login 경로에서 /en 반환', () => {
    expect(extractLocalePrefix('/en/login')).toBe('/en');
  });

  it('/en/callback 경로에서 /en 반환', () => {
    expect(extractLocalePrefix('/en/callback')).toBe('/en');
  });

  it('/ko 경로에서 빈 문자열 반환 (기본 locale은 prefix 생략)', () => {
    expect(extractLocalePrefix('/ko')).toBe('');
  });
});

// ── stripLocalePrefix ──

describe('stripLocalePrefix', () => {
  it('ko 경로: /dashboard → /dashboard (변화 없음)', () => {
    expect(stripLocalePrefix('/dashboard')).toBe('/dashboard');
  });

  it('루트 경로: / → / (변화 없음)', () => {
    expect(stripLocalePrefix('/')).toBe('/');
  });

  it('/en 정확 매칭 → /', () => {
    expect(stripLocalePrefix('/en')).toBe('/');
  });

  it('/en/dashboard → /dashboard', () => {
    expect(stripLocalePrefix('/en/dashboard')).toBe('/dashboard');
  });

  it('/en/login → /login', () => {
    expect(stripLocalePrefix('/en/login')).toBe('/login');
  });

  it('/en/callback → /callback', () => {
    expect(stripLocalePrefix('/en/callback')).toBe('/callback');
  });

  it('/enterprise → /enterprise (false positive 방지)', () => {
    expect(stripLocalePrefix('/enterprise')).toBe('/enterprise');
  });

  it('/login → /login (기본 locale 경로 변화 없음)', () => {
    expect(stripLocalePrefix('/login')).toBe('/login');
  });
});

// ── 통합 시나리오: extractLocalePrefix + stripLocalePrefix 조합 ──

describe('locale-path 통합 시나리오', () => {
  it('/en 사용자의 401 redirect: strip → 경로 판별 → prefix 적용', () => {
    const pathname = '/en/studies';
    const stripped = stripLocalePrefix(pathname);
    expect(stripped).toBe('/studies');
    // /login도 /callback도 /도 아니므로 redirect 대상
    expect(stripped.startsWith('/login')).toBe(false);
    expect(stripped.startsWith('/callback')).toBe(false);
    expect(stripped).not.toBe('/');
    // prefix 적용
    const prefix = extractLocalePrefix(pathname);
    expect(`${prefix}/login?expired=true`).toBe('/en/login?expired=true');
  });

  it('/en/login 경로에서 redirect 방지', () => {
    const stripped = stripLocalePrefix('/en/login');
    expect(stripped.startsWith('/login')).toBe(true);
  });

  it('/en/callback 경로에서 redirect 방지', () => {
    const stripped = stripLocalePrefix('/en/callback');
    expect(stripped.startsWith('/callback')).toBe(true);
  });

  it('/en 루트 경로에서 redirect 방지', () => {
    const stripped = stripLocalePrefix('/en');
    expect(stripped).toBe('/');
  });

  it('ko 사용자(기본 locale)는 prefix 없음', () => {
    const pathname = '/studies';
    const prefix = extractLocalePrefix(pathname);
    expect(`${prefix}/login?expired=true`).toBe('/login?expired=true');
  });
});
