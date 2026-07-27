/**
 * @file calcDDay 유틸 테스트 — 캘린더 일수 기준 D-day 계산 (오프바이원 회귀 방지)
 * @domain common
 * @layer lib
 * @related lib/utils/index.ts
 */
import { calcDDay } from '@/lib/utils';

/** 마감일 = 해당 일자 23:59:59 (DeadlineSection 저장 규칙과 동일) */
function deadlineOf(y: number, m: number, d: number): string {
  return new Date(y, m - 1, d, 23, 59, 59).toISOString();
}

describe('calcDDay', () => {
  const deadline = deadlineOf(2026, 7, 30);

  it('마감 당일이면 D-Day(days=0) — 시각 무관', () => {
    // 마감 당일 오전 → 남은 밀리초가 있어도 캘린더상 같은 날이므로 0
    expect(calcDDay(deadline, new Date(2026, 6, 30, 10, 0))).toEqual({
      days: 0,
      expired: false,
    });
    // 마감 당일 밤 23:00에도 여전히 D-Day
    expect(calcDDay(deadline, new Date(2026, 6, 30, 23, 0)).days).toBe(0);
  });

  it('하루 전이면 D-1 (기존 Math.ceil 방식의 D-2 오차 제거)', () => {
    expect(calcDDay(deadline, new Date(2026, 6, 29, 10, 0)).days).toBe(1);
  });

  it('사흘 전이면 D-3', () => {
    expect(calcDDay(deadline, new Date(2026, 6, 27, 15, 0)).days).toBe(3);
  });

  it('마감일 다음 날이면 만료(expired, days 음수)', () => {
    const res = calcDDay(deadline, new Date(2026, 6, 31, 0, 30));
    expect(res.expired).toBe(true);
    expect(res.days).toBe(-1);
  });

  it('Date 인스턴스 입력도 문자열과 동일하게 처리', () => {
    const asDate = new Date(2026, 6, 30, 23, 59, 59);
    expect(calcDDay(asDate, new Date(2026, 6, 28, 9, 0)).days).toBe(2);
  });
});
