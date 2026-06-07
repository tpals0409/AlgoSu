/**
 * @file CS 퀴즈 문항 전체 eager 합산 — 테스트/서버 전용
 * @domain quiz
 * @layer data
 * @related src/data/quiz/types.ts, src/data/quiz/shuffle.ts, src/data/quiz/index.ts
 *
 * ⚠️  테스트/서버 전용 eager 합산.
 * 클라이언트 번들 lazy-load를 위해 배럴(index.ts)은 이 파일을 import하지 않는다.
 * 클라이언트 컴포넌트에서 직접 import 금지.
 */

import { AI_QUESTIONS } from './ai';
import { ALGORITHM_QUESTIONS } from './algorithm';
import { COMPUTER_ARCHITECTURE_QUESTIONS } from './computer-architecture';
import { DATABASE_QUESTIONS } from './database';
import { DATA_STRUCTURE_QUESTIONS } from './data-structure';
import { DESIGN_PATTERN_QUESTIONS } from './design-pattern';
import { NETWORK_QUESTIONS } from './network';
import { OS_QUESTIONS } from './os';
import { SECURITY_QUESTIONS } from './security';
import { WEB_QUESTIONS } from './web';
import { QuizCategory, type QuizDifficulty, type QuizQuestion } from './types';

/** 전 분야 문항을 합산한 전체 목록 (테스트/서버 전용 eager). */
export const ALL_QUESTIONS: readonly QuizQuestion[] = [
  ...DATA_STRUCTURE_QUESTIONS,
  ...ALGORITHM_QUESTIONS,
  ...NETWORK_QUESTIONS,
  ...OS_QUESTIONS,
  ...DATABASE_QUESTIONS,
  ...COMPUTER_ARCHITECTURE_QUESTIONS,
  ...DESIGN_PATTERN_QUESTIONS,
  ...WEB_QUESTIONS,
  ...SECURITY_QUESTIONS,
  ...AI_QUESTIONS,
];

/**
 * 주어진 카테고리에 속한 문항만 필터링해 반환한다 (동기).
 *
 * @param category 조회할 CS 분야
 * @returns 해당 카테고리 문항 배열 (없으면 빈 배열)
 */
export function getQuestionsByCategory(category: QuizCategory): QuizQuestion[] {
  return ALL_QUESTIONS.filter((question) => question.category === category);
}

/**
 * 카테고리로 거른 뒤, 난이도가 'ALL'이 아니면 난이도까지 필터링해 반환한다 (동기).
 * category가 'ALL'이면 전 분야 문항(ALL_QUESTIONS) 전체를 대상으로 한다.
 *
 * @param category 조회할 CS 분야 ('ALL'이면 전 분야)
 * @param difficulty 난이도 필터 ('ALL'이면 난이도 무관 전체)
 * @returns 조건을 만족하는 문항 배열 (없으면 빈 배열)
 */
export function getQuestionsByFilter(
  category: QuizCategory | 'ALL',
  difficulty: QuizDifficulty | 'ALL',
): QuizQuestion[] {
  const byCategory =
    category === 'ALL' ? [...ALL_QUESTIONS] : getQuestionsByCategory(category);
  if (difficulty === 'ALL') return byCategory;
  return byCategory.filter((question) => question.difficulty === difficulty);
}
