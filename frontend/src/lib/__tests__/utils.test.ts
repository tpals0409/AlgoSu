import { cn, getCurrentWeekLabel } from '@/lib/utils';

describe('cn', () => {
  it('단일 클래스를 반환한다', () => {
    expect(cn('px-4')).toBe('px-4');
  });

  it('여러 클래스를 병합한다', () => {
    expect(cn('px-4', 'py-2')).toBe('px-4 py-2');
  });

  it('충돌하는 Tailwind 클래스를 후자 우선으로 병합한다', () => {
    expect(cn('px-4', 'px-8')).toBe('px-8');
  });

  it('falsy 값을 무시한다', () => {
    expect(cn('px-4', undefined, null, false, 'py-2')).toBe('px-4 py-2');
  });

  it('조건부 클래스를 처리한다', () => {
    const isActive = true;
    expect(cn('base', isActive && 'active')).toBe('base active');
  });

  it('인자 없이 호출하면 빈 문자열을 반환한다', () => {
    expect(cn()).toBe('');
  });
});

describe('getCurrentWeekLabel', () => {
  it('1월 1일은 1월1주차를 반환한다', () => {
    expect(getCurrentWeekLabel(new Date(2025, 0, 1))).toBe('1월1주차');
  });

  it('1월 8일은 1월2주차를 반환한다', () => {
    expect(getCurrentWeekLabel(new Date(2025, 0, 8))).toBe('1월2주차');
  });

  it('12월 31일은 12월5주차를 반환한다', () => {
    expect(getCurrentWeekLabel(new Date(2025, 11, 31))).toBe('12월5주차');
  });

  it('인자 없이 호출하면 현재 날짜 기준으로 반환한다', () => {
    const result = getCurrentWeekLabel();
    // "X월Y주차" 형식인지 확인
    expect(result).toMatch(/^\d+월\d+주차$/);
  });

  it('6월 15일은 6월3주차를 반환한다', () => {
    expect(getCurrentWeekLabel(new Date(2025, 5, 15))).toBe('6월3주차');
  });
});
