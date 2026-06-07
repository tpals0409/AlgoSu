/**
 * @file ALL_QUESTIONS 데이터 무결성 테스트 — 총 350문항·id 유니크·bilingual·분야별 카운트·난이도 분포
 * @domain quiz
 * @layer data
 * @related src/data/quiz/index.ts, src/data/quiz/types.ts
 */
import {
  ALL_QUESTIONS,
  getQuestionsByCategory,
  getQuestionsByFilter,
  QuizCategory,
} from '../index';
import { type QuizDifficulty } from '../types';

const VALID_DIFFICULTIES: readonly QuizDifficulty[] = ['EASY', 'MEDIUM', 'HARD'];
const VALID_CATEGORIES = new Set(Object.values(QuizCategory));

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

describe('ALL_QUESTIONS data integrity', () => {
  it('has exactly 350 questions in total', () => {
    expect(ALL_QUESTIONS).toHaveLength(350);
  });

  it('all ids are globally unique', () => {
    const ids = ALL_QUESTIONS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all prompt.ko and prompt.en are non-empty', () => {
    for (const q of ALL_QUESTIONS) {
      expect(q.prompt.ko.trim().length).toBeGreaterThan(0);
      expect(q.prompt.en.trim().length).toBeGreaterThan(0);
    }
  });

  it('all explanation.ko and explanation.en are non-empty', () => {
    for (const q of ALL_QUESTIONS) {
      expect(q.explanation.ko.trim().length).toBeGreaterThan(0);
      expect(q.explanation.en.trim().length).toBeGreaterThan(0);
    }
  });

  it('all acceptedAnswers are non-empty arrays with non-empty elements', () => {
    for (const q of ALL_QUESTIONS) {
      expect(q.acceptedAnswers.length).toBeGreaterThan(0);
      for (const answer of q.acceptedAnswers) {
        expect(answer.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("all difficulty values are 'EASY' | 'MEDIUM' | 'HARD'", () => {
    for (const q of ALL_QUESTIONS) {
      expect(VALID_DIFFICULTIES).toContain(q.difficulty);
    }
  });

  it('all category values are valid QuizCategory enum values', () => {
    for (const q of ALL_QUESTIONS) {
      expect(VALID_CATEGORIES.has(q.category)).toBe(true);
    }
  });

  // ─── 분야별 카운트 ──────────────────────────────────────────────────────────

  it('original 5 categories have exactly 50 questions each', () => {
    for (const category of ORIGINAL_CATEGORIES) {
      const questions = getQuestionsByCategory(category);
      expect(questions).toHaveLength(50);
    }
  });

  it('new 5 categories have exactly 20 questions each', () => {
    for (const category of NEW_CATEGORIES) {
      const questions = getQuestionsByCategory(category);
      expect(questions).toHaveLength(20);
    }
  });

  // ─── 난이도 분포 ────────────────────────────────────────────────────────────

  it('each original category has at least 17 HARD questions', () => {
    for (const category of ORIGINAL_CATEGORIES) {
      const hardCount = getQuestionsByFilter(category, 'HARD').length;
      expect(hardCount).toBeGreaterThanOrEqual(17);
    }
  });

  it('each new category has at least 6 HARD questions', () => {
    for (const category of NEW_CATEGORIES) {
      const hardCount = getQuestionsByFilter(category, 'HARD').length;
      expect(hardCount).toBeGreaterThanOrEqual(6);
    }
  });

  it('every category has at least 1 HARD question', () => {
    for (const category of Object.values(QuizCategory)) {
      const hardCount = getQuestionsByFilter(category, 'HARD').length;
      expect(hardCount).toBeGreaterThanOrEqual(1);
    }
  });
});
