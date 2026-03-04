import { formatDateTime, formatDate, formatShortDateTime } from '@/lib/date';

describe('formatDateTime', () => {
  it('Date 객체를 "YYYY.MM.DD HH:mm" 형식으로 반환한다', () => {
    const d = new Date(2026, 2, 1, 14, 30); // 2026-03-01 14:30
    expect(formatDateTime(d)).toBe('2026.03.01 14:30');
  });

  it('ISO 문자열을 처리한다', () => {
    // UTC 기준 문자열이므로 로컬 타임존에 따라 결과가 달라질 수 있음
    const d = new Date(2026, 0, 15, 9, 5);
    expect(formatDateTime(d)).toBe('2026.01.15 09:05');
  });

  it('한 자리 월/일/시/분을 0으로 패딩한다', () => {
    const d = new Date(2025, 0, 1, 1, 2); // 2025-01-01 01:02
    expect(formatDateTime(d)).toBe('2025.01.01 01:02');
  });

  it('문자열 타입도 처리한다', () => {
    const d = new Date(2026, 2, 1, 14, 30);
    expect(formatDateTime(d.toISOString())).toBe(formatDateTime(d));
  });
});

describe('formatDate', () => {
  it('Date 객체를 "YYYY.MM.DD" 형식으로 반환한다', () => {
    const d = new Date(2026, 2, 1);
    expect(formatDate(d)).toBe('2026.03.01');
  });

  it('문자열 타입도 처리한다', () => {
    const d = new Date(2026, 11, 25);
    expect(formatDate(d.toISOString())).toBe(formatDate(d));
  });

  it('한 자리 월/일을 0으로 패딩한다', () => {
    const d = new Date(2025, 0, 5);
    expect(formatDate(d)).toBe('2025.01.05');
  });
});

describe('formatShortDateTime', () => {
  it('"MM.DD HH:mm" 형식으로 반환한다', () => {
    const d = new Date(2026, 2, 1, 14, 30);
    expect(formatShortDateTime(d)).toBe('03.01 14:30');
  });

  it('문자열 타입도 처리한다', () => {
    const d = new Date(2026, 2, 1, 14, 30);
    expect(formatShortDateTime(d.toISOString())).toBe(formatShortDateTime(d));
  });

  it('자정을 올바르게 처리한다', () => {
    const d = new Date(2026, 5, 15, 0, 0);
    expect(formatShortDateTime(d)).toBe('06.15 00:00');
  });
});
