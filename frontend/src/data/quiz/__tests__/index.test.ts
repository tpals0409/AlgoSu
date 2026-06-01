/**
 * @file quiz/index.ts 단위 테스트 — 조회 헬퍼·문항 무결성
 * @domain quiz
 * @layer data
 * @related src/data/quiz/index.ts
 */
import {
  ALL_QUESTIONS,
  getQuestionsByCategory,
  getRandomQuestions,
  QuizCategory,
  QUIZ_CATEGORIES,
} from '../index';

describe('getQuestionsByCategory', () => {
  it('returns only questions of the requested category', () => {
    const result = getQuestionsByCategory(QuizCategory.DATA_STRUCTURE);
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((q) => q.category === QuizCategory.DATA_STRUCTURE)).toBe(true);
  });

  it('returns an empty array for a category with no questions', () => {
    expect(getQuestionsByCategory(QuizCategory.OS)).toEqual([]);
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
    const first = getRandomQuestions(QuizCategory.ALGORITHM, 3, rng);
    const second = getRandomQuestions(QuizCategory.ALGORITHM, 3, rng);
    expect(first.map((q) => q.id)).toEqual(second.map((q) => q.id));
    expect(getQuestionsByCategory(QuizCategory.ALGORITHM)).toEqual(pool);
  });

  it('selects only questions belonging to the category', () => {
    const result = getRandomQuestions(QuizCategory.DATA_STRUCTURE, 4);
    expect(result.every((q) => q.category === QuizCategory.DATA_STRUCTURE)).toBe(true);
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

  it('provides 12 questions per PoC category', () => {
    expect(getQuestionsByCategory(QuizCategory.DATA_STRUCTURE)).toHaveLength(12);
    expect(getQuestionsByCategory(QuizCategory.ALGORITHM)).toHaveLength(12);
  });

  it('lists only categories that actually have questions', () => {
    expect(QUIZ_CATEGORIES).toEqual([
      QuizCategory.DATA_STRUCTURE,
      QuizCategory.ALGORITHM,
    ]);
  });
});
