/**
 * @file 퀴즈 기록 → 분야별 최고 점수 집계 (순수 함수)
 * @domain quiz
 * @layer lib
 * @related src/lib/quiz/storage.ts, src/components/quiz/QuizStats.tsx
 *
 * Sprint 224: getAllBest()가 반환하는 `${category}::${difficulty}` 복합 키 맵을
 * 분야 단위로 접어 난이도 across 최고 점수를 산출한다.
 * 시작 화면의 "내 기록" 요약(QuizStats) 표시용 데이터를 만든다.
 */

import { QUIZ_CATEGORY_META } from '@/data/quiz/category-meta';
import type { QuizCategory } from '@/data/quiz/types';
import type { QuizBestRecord } from './storage';

/** 분야별 최고 점수 요약 항목. */
export interface QuizCategoryStat {
  /** CS 분야 */
  readonly category: QuizCategory;
  /** 해당 분야의 난이도 across 최고 정답률 (0~100) */
  readonly bestPercent: number;
}

/** 복합 키에서 분야 부분을 분리하는 구분자. */
const KEY_SEPARATOR = '::';

/**
 * 복합 키 맵을 분야별 최고 점수로 집계한다.
 * 같은 분야의 여러 난이도 기록 중 최고 정답률만 남기고, 점수 내림차순으로 정렬한다.
 * 알 수 없는(미등록) 분야 키는 무시한다.
 *
 * @param allBest `${category}::${difficulty}` → 최고 기록 맵
 * @returns 분야별 최고 점수 요약 (점수 내림차순)
 */
export function aggregateCategoryBests(
  allBest: Record<string, QuizBestRecord>,
): QuizCategoryStat[] {
  const maxByCategory = new Map<QuizCategory, number>();

  for (const [key, record] of Object.entries(allBest)) {
    const sepIdx = key.indexOf(KEY_SEPARATOR);
    if (sepIdx === -1) continue;
    const categoryStr = key.slice(0, sepIdx);
    // allBest는 미검증 localStorage에서 올 수 있다. `in`은 프로토타입 상속 키
    // (toString·__proto__ 등)까지 매칭하므로, 손상 키가 유효 분야로 통과해
    // 이후 getQuizCategoryMeta가 undefined를 역참조하는 것을 막기 위해 own-key만 인정한다.
    if (!Object.prototype.hasOwnProperty.call(QUIZ_CATEGORY_META, categoryStr)) continue;

    const category = categoryStr as QuizCategory;
    const prev = maxByCategory.get(category) ?? -1;
    if (record.scorePercent > prev) {
      maxByCategory.set(category, record.scorePercent);
    }
  }

  return Array.from(maxByCategory, ([category, bestPercent]) => ({ category, bestPercent })).sort(
    (a, b) => b.bestPercent - a.bestPercent,
  );
}
