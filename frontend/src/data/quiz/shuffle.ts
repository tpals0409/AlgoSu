/**
 * @file Fisher-Yates 셔플 유틸리티 (데이터 무관 순수 함수)
 * @domain quiz
 * @layer data
 * @related src/data/quiz/index.ts, src/data/quiz/all.ts
 */

/**
 * 배열을 Fisher-Yates 알고리즘으로 셔플한 새 배열을 반환한다 (원본 불변).
 *
 * @param items 셔플 대상 배열
 * @param rng 0 이상 1 미만 난수 생성기 (기본 Math.random, 테스트 주입 가능)
 * @returns 셔플된 새 배열
 */
export function shuffle<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
