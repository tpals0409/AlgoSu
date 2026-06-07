/**
 * @file quiz/index.ts 단위 테스트 — 조회 헬퍼·문항 무결성·'ALL' 필터
 * @domain quiz
 * @layer data
 * @related src/data/quiz/index.ts
 */
import {
  ALL_QUESTIONS,
  getQuestionsByCategory,
  getQuestionsByFilter,
  getRandomQuestions,
  QuizCategory,
  QUIZ_CATEGORIES,
} from '../index';

/** 기존 5분야 — 각 50문항. */
const ORIGINAL_CATEGORIES = [
  QuizCategory.DATA_STRUCTURE,
  QuizCategory.ALGORITHM,
  QuizCategory.NETWORK,
  QuizCategory.OS,
  QuizCategory.DATABASE,
] as const;

/** 신규 5분야 — 각 20문항. */
const NEW_CATEGORIES = [
  QuizCategory.COMPUTER_ARCHITECTURE,
  QuizCategory.DESIGN_PATTERN,
  QuizCategory.WEB,
  QuizCategory.SECURITY,
  QuizCategory.AI,
] as const;

/** 전 분야 10종. */
const ALL_CATEGORIES = [...ORIGINAL_CATEGORIES, ...NEW_CATEGORIES] as const;

describe('getQuestionsByCategory', () => {
  it('returns only questions of the requested category', () => {
    const result = getQuestionsByCategory(QuizCategory.DATA_STRUCTURE);
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((q) => q.category === QuizCategory.DATA_STRUCTURE)).toBe(true);
  });

  it('returns questions for every populated category', () => {
    for (const category of ALL_CATEGORIES) {
      const result = getQuestionsByCategory(category);
      expect(result.length).toBeGreaterThan(0);
      expect(result.every((q) => q.category === category)).toBe(true);
    }
  });
});

describe('getQuestionsByFilter', () => {
  it('returns the full category pool when difficulty is ALL', () => {
    expect(getQuestionsByFilter(QuizCategory.ALGORITHM, 'ALL')).toEqual(
      getQuestionsByCategory(QuizCategory.ALGORITHM),
    );
  });

  it('returns only questions matching the requested difficulty', () => {
    const result = getQuestionsByFilter(QuizCategory.ALGORITHM, 'EASY');
    expect(result.length).toBeGreaterThan(0);
    expect(
      result.every(
        (q) => q.category === QuizCategory.ALGORITHM && q.difficulty === 'EASY',
      ),
    ).toBe(true);
  });

  // ─── 'ALL' 분야 필터 신규 테스트 ──────────────────────────────────────────

  it("getQuestionsByFilter('ALL', 'ALL') returns the full ALL_QUESTIONS pool (350)", () => {
    const result = getQuestionsByFilter('ALL', 'ALL');
    expect(result).toHaveLength(ALL_QUESTIONS.length);
    expect(result).toHaveLength(350);
  });

  it("getQuestionsByFilter('ALL', 'HARD') returns all HARD questions across every category", () => {
    const result = getQuestionsByFilter('ALL', 'HARD');
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((q) => q.difficulty === 'HARD')).toBe(true);
    // 여러 분야에 걸쳐야 한다
    const categories = new Set(result.map((q) => q.category));
    expect(categories.size).toBeGreaterThan(1);
  });
});

describe('getRandomQuestions', () => {
  it('limits the result to count', () => {
    const result = getRandomQuestions(QuizCategory.ALGORITHM, 5);
    expect(result).toHaveLength(5);
  });

  it('returns the full pool when count exceeds available questions', () => {
    const pool = getQuestionsByCategory(QuizCategory.ALGORITHM);
    const result = getRandomQuestions(QuizCategory.ALGORITHM, pool.length + 100);
    expect(result).toHaveLength(pool.length);
  });

  it('returns an empty array for a non-positive count', () => {
    expect(getRandomQuestions(QuizCategory.ALGORITHM, 0)).toEqual([]);
    expect(getRandomQuestions(QuizCategory.ALGORITHM, -3)).toEqual([]);
  });

  it('is deterministic with an injected rng and does not mutate the pool', () => {
    const pool = getQuestionsByCategory(QuizCategory.ALGORITHM);
    const rng = () => 0;
    const first = getRandomQuestions(QuizCategory.ALGORITHM, 3, 'ALL', rng);
    const second = getRandomQuestions(QuizCategory.ALGORITHM, 3, 'ALL', rng);
    expect(first.map((q) => q.id)).toEqual(second.map((q) => q.id));
    expect(getQuestionsByCategory(QuizCategory.ALGORITHM)).toEqual(pool);
  });

  it('selects only questions belonging to the category', () => {
    const result = getRandomQuestions(QuizCategory.DATA_STRUCTURE, 4);
    expect(result.every((q) => q.category === QuizCategory.DATA_STRUCTURE)).toBe(true);
  });

  it('restricts the pool to the requested difficulty', () => {
    const result = getRandomQuestions(QuizCategory.DATA_STRUCTURE, 4, 'HARD');
    expect(result.length).toBeGreaterThan(0);
    expect(
      result.every(
        (q) => q.category === QuizCategory.DATA_STRUCTURE && q.difficulty === 'HARD',
      ),
    ).toBe(true);
  });

  it("getRandomQuestions('ALL', count, 'ALL', rng) returns count items from multiple categories", () => {
    // 결정적 rng: 항상 같은 결과
    const rng = () => 0.42;
    const result = getRandomQuestions('ALL', 10, 'ALL', rng);
    expect(result).toHaveLength(10);
    // 2개 이상 분야가 섞여야 한다
    const categories = new Set(result.map((q) => q.category));
    expect(categories.size).toBeGreaterThanOrEqual(2);
  });
});

describe('ALL_QUESTIONS integrity', () => {
  it('has unique ids', () => {
    const ids = ALL_QUESTIONS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has non-empty acceptedAnswers for every question', () => {
    expect(ALL_QUESTIONS.every((q) => q.acceptedAnswers.length > 0)).toBe(true);
  });

  it('has non-empty bilingual prompt and explanation', () => {
    for (const q of ALL_QUESTIONS) {
      expect(q.prompt.ko.length).toBeGreaterThan(0);
      expect(q.prompt.en.length).toBeGreaterThan(0);
      expect(q.explanation.ko.length).toBeGreaterThan(0);
      expect(q.explanation.en.length).toBeGreaterThan(0);
    }
  });

  it('provides 50 questions per original category', () => {
    for (const category of ORIGINAL_CATEGORIES) {
      expect(getQuestionsByCategory(category)).toHaveLength(50);
    }
  });

  it('provides 20 questions per new category', () => {
    for (const category of NEW_CATEGORIES) {
      expect(getQuestionsByCategory(category)).toHaveLength(20);
    }
  });

  it('has a total of 350 questions', () => {
    expect(ALL_QUESTIONS).toHaveLength(350);
  });

  it('lists every populated category in declaration order (all 10)', () => {
    expect(QUIZ_CATEGORIES).toEqual([...ALL_CATEGORIES]);
  });
});
