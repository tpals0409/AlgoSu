/**
 * @file parseWeekKey 단위 테스트
 * @domain analytics
 * @layer test
 * @related parseWeekKey.ts
 */

import { parseWeekKey } from '../parseWeekKey';

describe('parseWeekKey', () => {
  beforeAll(() => {
    // 결정적 결과를 위해 현재 시각을 고정 (2026-04-24 가정)
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-24T00:00:00Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('정상 형식: "1월3주차" → 정렬 가능한 정수 반환', () => {
    expect(parseWeekKey('1월3주차')).toBe(20260103);
  });

  it('현재 월 기준 6개월 이내 같은 해: "4월2주차" → 2026년', () => {
    expect(parseWeekKey('4월2주차')).toBe(20260402);
  });

  it('현재 월보다 6개월 이상 미래: "12월1주차" → 전년도(2025)', () => {
    expect(parseWeekKey('12월1주차')).toBe(20251201);
  });

  it('비매칭 형식: "Week 3" → 0', () => {
    expect(parseWeekKey('Week 3')).toBe(0);
  });

  it('빈 문자열 → 0', () => {
    expect(parseWeekKey('')).toBe(0);
  });

  it('정렬 검증: 12월 < 1월 (연도 경계 보정)', () => {
    expect(parseWeekKey('12월4주차')).toBeLessThan(parseWeekKey('1월1주차'));
  });
});
