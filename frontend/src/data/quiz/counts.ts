/**
 * @file 분야별 가용 문항 수 동기 헬퍼
 * @domain quiz
 * @layer data
 * @related src/data/quiz/question-counts.ts, src/data/quiz/types.ts, src/data/quiz/index.ts
 */

import { QUESTION_COUNTS } from './question-counts';
import { QuizCategory, type QuizDifficulty } from './types';

/**
 * 주어진 분야·난이도 조합의 가용 문항 수를 반환한다.
 * category가 'ALL'이면 전 분야 합산, difficulty가 'ALL'이면 전 난이도 합산.
 *
 * @param category 조회할 CS 분야 ('ALL'이면 전 분야 합산)
 * @param difficulty 난이도 ('ALL'이면 EASY+MEDIUM+HARD 합산)
 * @returns 가용 문항 수
 */
export function getAvailableCount(
  category: QuizCategory | 'ALL',
  difficulty: QuizDifficulty | 'ALL',
): number {
  const categories =
    category === 'ALL'
      ? (Object.keys(QUESTION_COUNTS) as QuizCategory[])
      : [category];

  return categories.reduce((total, cat) => {
    const counts = QUESTION_COUNTS[cat];
    if (difficulty === 'ALL') {
      return total + counts.EASY + counts.MEDIUM + counts.HARD;
    }
    return total + counts[difficulty];
  }, 0);
}
