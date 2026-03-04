import {
  getCurrentWeekLabel,
  getWeekOptions,
  getWeekDates,
  matchDeadlineToWeekDate,
  validateProblemForm,
  DAY_NAMES,
  type ProblemFormState,
} from '@/lib/problem-form-utils';

describe('DAY_NAMES', () => {
  it('7개 요일을 포함한다', () => {
    expect(DAY_NAMES).toHaveLength(7);
    expect(DAY_NAMES[0]).toBe('일');
    expect(DAY_NAMES[6]).toBe('토');
  });
});

describe('getCurrentWeekLabel', () => {
  it('1월 1일은 1월1주차를 반환한다', () => {
    expect(getCurrentWeekLabel(new Date(2025, 0, 1))).toBe('1월1주차');
  });

  it('3월 15일은 3월3주차를 반환한다', () => {
    expect(getCurrentWeekLabel(new Date(2025, 2, 15))).toBe('3월3주차');
  });
});

describe('getWeekOptions', () => {
  it('현재 월의 주차 + 다음 달 1주차를 반환한다', () => {
    const options = getWeekOptions();
    expect(options.length).toBeGreaterThanOrEqual(5); // 최소 4주 + 다음달 1주차
    expect(options[options.length - 1]).toMatch(/^\d+월1주차$/);
  });

  it('모든 항목이 "X월Y주차" 형식이다', () => {
    const options = getWeekOptions();
    for (const opt of options) {
      expect(opt).toMatch(/^\d+월\d+주차$/);
    }
  });
});

describe('getWeekDates', () => {
  it('올바른 주차 라벨로 날짜 목록을 반환한다', () => {
    const dates = getWeekDates('3월1주차');
    expect(dates.length).toBeGreaterThanOrEqual(1);
    expect(dates.length).toBeLessThanOrEqual(7);
    for (const d of dates) {
      expect(d.label).toMatch(/^\d+월 \d+일 \([일월화수목금토]\)$/);
      expect(d.value).toBeTruthy();
    }
  });

  it('잘못된 형식은 빈 배열을 반환한다', () => {
    expect(getWeekDates('invalid')).toEqual([]);
    expect(getWeekDates('')).toEqual([]);
  });

  it('1주차는 1~7일 범위이다', () => {
    const dates = getWeekDates('1월1주차');
    for (const d of dates) {
      const day = new Date(d.value).getDate();
      expect(day).toBeGreaterThanOrEqual(1);
      expect(day).toBeLessThanOrEqual(7);
    }
  });
});

describe('matchDeadlineToWeekDate', () => {
  it('같은 날짜의 value를 반환한다', () => {
    const dates = getWeekDates('3월1주차');
    if (dates.length > 0) {
      const matched = matchDeadlineToWeekDate(dates[0].value, '3월1주차');
      expect(matched).toBe(dates[0].value);
    }
  });

  it('매칭되지 않으면 빈 문자열을 반환한다', () => {
    const result = matchDeadlineToWeekDate('2025-06-15T00:00:00.000Z', '1월1주차');
    expect(result).toBe('');
  });
});

describe('validateProblemForm', () => {
  const validForm: ProblemFormState = {
    title: '테스트 문제',
    description: '설명',
    difficulty: 'GOLD',
    weekNumber: '3월1주차',
    deadline: '2026-03-07T23:59:59.000Z',
    allowedLanguages: ['python'],
    sourceUrl: '',
    sourcePlatform: '',
  };

  it('유효한 폼은 에러가 없다', () => {
    const errors = validateProblemForm(validForm);
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it('제목이 비어있으면 에러를 반환한다', () => {
    const errors = validateProblemForm({ ...validForm, title: '' });
    expect(errors.title).toBeDefined();
  });

  it('제목이 공백만 있으면 에러를 반환한다', () => {
    const errors = validateProblemForm({ ...validForm, title: '   ' });
    expect(errors.title).toBeDefined();
  });

  it('주차가 비어있으면 에러를 반환한다', () => {
    const errors = validateProblemForm({ ...validForm, weekNumber: '' });
    expect(errors.weekNumber).toBeDefined();
  });

  it('마감일이 비어있으면 에러를 반환한다', () => {
    const errors = validateProblemForm({ ...validForm, deadline: '' });
    expect(errors.deadline).toBeDefined();
  });

  it('여러 에러를 동시에 반환한다', () => {
    const errors = validateProblemForm({ ...validForm, title: '', weekNumber: '', deadline: '' });
    expect(errors.title).toBeDefined();
    expect(errors.weekNumber).toBeDefined();
    expect(errors.deadline).toBeDefined();
  });
});
