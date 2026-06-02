/**
 * @file CS 퀴즈 문항 집계 및 조회 헬퍼 (공개 진입점)
 * @domain quiz
 * @layer data
 * @related src/data/quiz/types.ts, src/data/quiz/data-structure.ts, src/data/quiz/algorithm.ts, src/data/quiz/network.ts, src/data/quiz/os.ts, src/data/quiz/database.ts
 */
import { ALGORITHM_QUESTIONS } from './algorithm';
import { DATABASE_QUESTIONS } from './database';
import { DATA_STRUCTURE_QUESTIONS } from './data-structure';
import { NETWORK_QUESTIONS } from './network';
import { OS_QUESTIONS } from './os';
import { QuizCategory, type QuizQuestion } from './types';

export { QuizCategory } from './types';
export type { QuizDifficulty, LocalizedText, QuizQuestion } from './types';

/** 전 분야 문항을 합산한 전체 목록. */
export const ALL_QUESTIONS: readonly QuizQuestion[] = [
  ...DATA_STRUCTURE_QUESTIONS,
  ...ALGORITHM_QUESTIONS,
  ...NETWORK_QUESTIONS,
  ...OS_QUESTIONS,
  ...DATABASE_QUESTIONS,
];

/** 실제 문항이 존재하는 카테고리 목록 (중복 제거, 등장 순서 유지). */
export const QUIZ_CATEGORIES: readonly QuizCategory[] = Array.from(
  new Set(ALL_QUESTIONS.map((question) => question.category)),
);

/**
 * 주어진 카테고리에 속한 문항만 필터링해 반환한다.
 *
 * @param category 조회할 CS 분야
 * @returns 해당 카테고리 문항 배열 (없으면 빈 배열)
 */
export function getQuestionsByCategory(category: QuizCategory): QuizQuestion[] {
  return ALL_QUESTIONS.filter((question) => question.category === category);
}

/**
 * 배열을 Fisher-Yates 알고리즘으로 셔플한 새 배열을 반환한다 (원본 불변).
 *
 * @param items 셔플 대상 배열
 * @param rng 0 이상 1 미만 난수 생성기 (기본 Math.random, 테스트 주입 가능)
 * @returns 셔플된 새 배열
 */
function shuffle<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * 카테고리에서 무작위로 최대 `count`개 문항을 뽑아 반환한다.
 * 가용 문항이 `count`보다 적으면 전체(셔플본)를 반환한다.
 *
 * @param category 조회할 CS 분야
 * @param count 뽑을 문항 수
 * @param rng 난수 생성기 (기본 Math.random, 테스트 결정성용 주입 가능)
 * @returns 무작위 문항 배열 (최대 count개)
 */
export function getRandomQuestions(
  category: QuizCategory,
  count: number,
  rng: () => number = Math.random,
): QuizQuestion[] {
  const pool = getQuestionsByCategory(category);
  return shuffle(pool, rng).slice(0, Math.max(0, count));
}
