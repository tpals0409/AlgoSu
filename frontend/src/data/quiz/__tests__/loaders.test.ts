/**
 * @file CATEGORY_LOADERS 완전성 + 분야 분리 단위 테스트
 * @domain quiz
 * @layer data
 * @related src/data/quiz/loaders.ts, src/data/quiz/types.ts
 *
 * 각 로더가 ① 올바른 분야 문항만 반환하고 ② 결과가 비어있지 않음을 검증한다.
 * QuizCategory 전 값에 대응하는 로더 키 완전성도 함께 보장한다.
 */
import { CATEGORY_LOADERS } from '../loaders';
import { QuizCategory } from '../types';

const ALL_CATEGORIES = Object.values(QuizCategory) as QuizCategory[];

// ─── CATEGORY_LOADERS 키 완전성 ──────────────────────────────────────────────

describe('CATEGORY_LOADERS completeness', () => {
  it('has a loader for every QuizCategory value', () => {
    const loaderKeys = Object.keys(CATEGORY_LOADERS).sort();
    const enumKeys = ALL_CATEGORIES.map((c) => String(c)).sort();
    expect(loaderKeys).toEqual(enumKeys);
  });

  it('has exactly 10 loaders (one per category)', () => {
    expect(Object.keys(CATEGORY_LOADERS)).toHaveLength(10);
  });
});

// ─── 각 로더 결과 검증 ───────────────────────────────────────────────────────

describe.each(ALL_CATEGORIES)('CATEGORY_LOADERS[%s]', (category) => {
  it('returns a non-empty array', async () => {
    const questions = await CATEGORY_LOADERS[category]();
    expect(questions.length).toBeGreaterThan(0);
  });

  it('contains only questions of the matching category', async () => {
    const questions = await CATEGORY_LOADERS[category]();
    const allMatch = questions.every((q) => q.category === category);
    expect(allMatch).toBe(true);
  });

  it('does not contain questions from other categories', async () => {
    const questions = await CATEGORY_LOADERS[category]();
    const otherCategories = ALL_CATEGORIES.filter((c) => c !== category);
    for (const other of otherCategories) {
      const hasOther = questions.some((q) => q.category === other);
      expect(hasOther).toBe(false);
    }
  });
});
