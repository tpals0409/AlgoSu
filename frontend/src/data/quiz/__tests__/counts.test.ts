/**
 * @file QUESTION_COUNTS 정확성 + getAvailableCount 단위 테스트 — 이중 가드②
 * @domain quiz
 * @layer data
 * @related src/data/quiz/question-counts.ts, src/data/quiz/counts.ts, src/data/quiz/all.ts
 *
 * 이중 가드②: auto-generated QUESTION_COUNTS(question-counts.ts)가
 * ALL_QUESTIONS 실데이터와 분야×난이도 전 조합에서 완전히 일치함을 검증한다.
 * gen-quiz-counts.mjs의 regex 취약성을 실데이터 집계로 무력화하며,
 * 향후 문항 추가·수정 시 카운트 재생성 누락을 즉시 감지한다.
 */
import { ALL_QUESTIONS } from '../all';
import { QUESTION_COUNTS } from '../question-counts';
import { getAvailableCount } from '../counts';
import { QuizCategory } from '../types';
import type { QuizDifficulty } from '../types';

const DIFFICULTIES: readonly QuizDifficulty[] = ['EASY', 'MEDIUM', 'HARD'];

// ─── QUESTION_COUNTS vs ALL_QUESTIONS 실데이터 완전 일치 ────────────────────────

describe('QUESTION_COUNTS vs ALL_QUESTIONS (이중 가드②)', () => {
  const ALL_CATEGORIES = Object.values(QuizCategory) as QuizCategory[];

  it('covers every QuizCategory — no missing or extra key in QUESTION_COUNTS', () => {
    const countKeys = Object.keys(QUESTION_COUNTS).sort();
    const enumKeys = ALL_CATEGORIES.map((c) => String(c)).sort();
    expect(countKeys).toEqual(enumKeys);
  });

  describe.each(ALL_CATEGORIES)('category %s', (category) => {
    describe.each(DIFFICULTIES)('difficulty %s', (difficulty) => {
      it(`QUESTION_COUNTS matches real ALL_QUESTIONS count`, () => {
        const actual = ALL_QUESTIONS.filter(
          (q) => q.category === category && q.difficulty === difficulty,
        ).length;
        expect(QUESTION_COUNTS[category][difficulty]).toBe(actual);
      });
    });

    it('EASY + MEDIUM + HARD equals total questions for category', () => {
      const total = ALL_QUESTIONS.filter((q) => q.category === category).length;
      const { EASY, MEDIUM, HARD } = QUESTION_COUNTS[category];
      expect(EASY + MEDIUM + HARD).toBe(total);
    });
  });
});

// ─── getAvailableCount 단위 테스트 ──────────────────────────────────────────────

describe('getAvailableCount', () => {
  // 단일 분야 + 단일 난이도
  it('returns exact count for a single category + single difficulty', () => {
    expect(getAvailableCount(QuizCategory.DATA_STRUCTURE, 'EASY')).toBe(
      QUESTION_COUNTS[QuizCategory.DATA_STRUCTURE].EASY,
    );
    expect(getAvailableCount(QuizCategory.AI, 'HARD')).toBe(
      QUESTION_COUNTS[QuizCategory.AI].HARD,
    );
    expect(getAvailableCount(QuizCategory.ALGORITHM, 'MEDIUM')).toBe(
      QUESTION_COUNTS[QuizCategory.ALGORITHM].MEDIUM,
    );
  });

  // 단일 분야 + 'ALL' 난이도
  it("returns sum of all difficulties for single category + 'ALL'", () => {
    const ds = QUESTION_COUNTS[QuizCategory.DATA_STRUCTURE];
    expect(getAvailableCount(QuizCategory.DATA_STRUCTURE, 'ALL')).toBe(
      ds.EASY + ds.MEDIUM + ds.HARD,
    );
    // 기존 5분야는 50문항 (16+17+17)
    expect(getAvailableCount(QuizCategory.ALGORITHM, 'ALL')).toBe(50);

    const arch = QUESTION_COUNTS[QuizCategory.COMPUTER_ARCHITECTURE];
    expect(getAvailableCount(QuizCategory.COMPUTER_ARCHITECTURE, 'ALL')).toBe(
      arch.EASY + arch.MEDIUM + arch.HARD,
    );
    // 신규 5분야는 20문항 (7+7+6)
    expect(getAvailableCount(QuizCategory.AI, 'ALL')).toBe(20);
  });

  // 'ALL' 분야 + 단일 난이도
  it("returns sum across all categories for 'ALL' category + single difficulty", () => {
    const easySum = Object.values(QUESTION_COUNTS).reduce(
      (acc, counts) => acc + counts.EASY,
      0,
    );
    expect(getAvailableCount('ALL', 'EASY')).toBe(easySum);

    const hardSum = Object.values(QUESTION_COUNTS).reduce(
      (acc, counts) => acc + counts.HARD,
      0,
    );
    expect(getAvailableCount('ALL', 'HARD')).toBe(hardSum);
  });

  // 'ALL' + 'ALL' — 총 350
  it("returns 350 (total) for 'ALL' category + 'ALL' difficulty", () => {
    expect(getAvailableCount('ALL', 'ALL')).toBe(350);
  });

  // QUESTION_COUNTS 파생값과 완전 일치
  it('matches QUESTION_COUNTS-derived values for every category+difficulty combo', () => {
    const ALL_CATEGORIES = Object.values(QuizCategory) as QuizCategory[];
    for (const category of ALL_CATEGORIES) {
      for (const difficulty of DIFFICULTIES) {
        expect(getAvailableCount(category, difficulty)).toBe(
          QUESTION_COUNTS[category][difficulty],
        );
      }
    }
  });
});
