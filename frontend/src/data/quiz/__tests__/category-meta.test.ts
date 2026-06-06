/**
 * @file category-meta 매핑 테스트 — 전 분야 아이콘·색상 토큰 존재 보장
 * @domain quiz
 * @layer data
 * @related src/data/quiz/category-meta.ts
 */
import { QUIZ_CATEGORY_META, getQuizCategoryMeta } from '../category-meta';
import { QuizCategory } from '../types';

describe('category-meta', () => {
  it('maps every QuizCategory enum value to icon + color tokens', () => {
    for (const category of Object.values(QuizCategory)) {
      const meta = QUIZ_CATEGORY_META[category];
      expect(meta).toBeDefined();
      // lucide 아이콘은 forwardRef 객체 — 정의 여부만 확인
      expect(meta.icon).toBeTruthy();
      expect(meta.colorVar).toMatch(/^var\(--quiz-cat-[a-z-]+-color\)$/);
      expect(meta.bgVar).toMatch(/^var\(--quiz-cat-[a-z-]+-bg\)$/);
    }
  });

  it('getQuizCategoryMeta returns the same reference as the map entry', () => {
    expect(getQuizCategoryMeta(QuizCategory.DATABASE)).toBe(
      QUIZ_CATEGORY_META[QuizCategory.DATABASE],
    );
  });

  it('assigns a distinct color token to each category', () => {
    const colorVars = Object.values(QUIZ_CATEGORY_META).map((meta) => meta.colorVar);
    expect(new Set(colorVars).size).toBe(colorVars.length);
  });
});
