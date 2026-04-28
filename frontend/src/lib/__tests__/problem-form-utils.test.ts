import {
  getCurrentWeekLabel,
  validateProblemForm,
  type ProblemFormState,
} from '@/lib/problem-form-utils';

describe('getCurrentWeekLabel', () => {
  it('1월 1일은 1월1주차를 반환한다', () => {
    expect(getCurrentWeekLabel(new Date(2025, 0, 1))).toBe('1월1주차');
  });

  it('3월 15일은 3월3주차를 반환한다', () => {
    expect(getCurrentWeekLabel(new Date(2025, 2, 15))).toBe('3월3주차');
  });

  it('인자 없이 호출하면 현재 날짜 기준 주차를 반환한다', () => {
    const result = getCurrentWeekLabel();
    expect(result).toMatch(/^\d+월\d+주차$/);
  });

  it('2026년 4월 20일(월)은 4월4주차를 반환한다 (Sprint 99-5: 달력 기준)', () => {
    expect(getCurrentWeekLabel(new Date(2026, 3, 20))).toBe('4월4주차');
  });
});

describe('validateProblemForm', () => {
  const validForm: ProblemFormState = {
    title: '테스트 문제',
    description: '설명',
    difficulty: 'GOLD',
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

  it('마감일이 비어있으면 에러를 반환한다', () => {
    const errors = validateProblemForm({ ...validForm, deadline: '' });
    expect(errors.deadline).toBeDefined();
  });

  it('여러 에러를 동시에 반환한다', () => {
    const errors = validateProblemForm({ ...validForm, title: '', deadline: '' });
    expect(errors.title).toBeDefined();
    expect(errors.deadline).toBeDefined();
  });
});
