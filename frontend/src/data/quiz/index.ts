/**
 * @file CS 퀴즈 공개 배럴 — lazy-load 아키텍처 진입점
 * @domain quiz
 * @layer data
 * @related src/data/quiz/types.ts, src/data/quiz/category-meta.ts,
 *          src/data/quiz/loaders.ts, src/data/quiz/counts.ts,
 *          src/data/quiz/question-counts.ts, src/data/quiz/all.ts
 *
 * ⚠️ lazy-load 아키텍처:
 *   - 문항 데이터(각 분야 .ts)는 이 파일에서 정적 import하지 않는다.
 *   - getRandomQuestions()는 async로 CATEGORY_LOADERS를 통해 동적 import한다.
 *   - 테스트·서버에서 동기 eager 합산이 필요하면 all.ts를 직접 import할 것.
 *   - all.ts / 분야 데이터 파일을 여기서 정적 import하면 lazy-load 무력화됨.
 */

// ── 타입 및 enum 재 export ───────────────────────────────────────────
export { QuizCategory } from './types';
export type { QuizDifficulty, LocalizedText, QuizQuestion } from './types';

// ── 분야 메타 재 export ─────────────────────────────────────────────
export { QUIZ_CATEGORY_META, getQuizCategoryMeta } from './category-meta';
export type { QuizCategoryMeta } from './category-meta';

// ── 동적 로더 재 export ─────────────────────────────────────────────
export { CATEGORY_LOADERS } from './loaders';

// ── 동기 카운트 헬퍼 재 export ─────────────────────────────────────
export { getAvailableCount } from './counts';

// ── 로컬 의존성 (내부 사용 전용) ────────────────────────────────────
import { QuizCategory } from './types';
import type { QuizDifficulty, QuizQuestion } from './types';
import { QUESTION_COUNTS } from './question-counts';
import { CATEGORY_LOADERS } from './loaders';
import { shuffle } from './shuffle';

// ── 정적 상수 ───────────────────────────────────────────────────────

/** 난이도 필터 옵션 — 'ALL'(전체) + 3단계 난이도. */
export const QUIZ_DIFFICULTIES = ['ALL', 'EASY', 'MEDIUM', 'HARD'] as const;

/**
 * 실제 문항이 존재하는 카테고리 목록 (canonical 순서).
 * question-counts.ts에서 파생되므로 데이터 파일을 직접 import하지 않는다.
 */
export const QUIZ_CATEGORIES: readonly QuizCategory[] = Object.keys(
  QUESTION_COUNTS,
) as QuizCategory[];

// ── async 문항 조회 ─────────────────────────────────────────────────

/**
 * 카테고리·난이도 조건에서 무작위로 최대 `count`개 문항을 동적 로드해 반환한다.
 * 가용 문항이 `count`보다 적으면 전체(셔플본)를 반환한다.
 *
 * @param category 조회할 CS 분야 ('ALL'이면 전 분야를 병렬 로드)
 * @param count 뽑을 문항 수
 * @param difficulty 난이도 필터 ('ALL'이면 난이도 무관, 기본 'ALL')
 * @param rng 난수 생성기 (기본 Math.random, 테스트 결정성용 주입 가능)
 * @param onProgress 청크 로드 진행 콜백 — 분야 청크가 하나씩 해결될 때마다
 *   (loaded, total)로 호출된다. 시작 시 (0, total)을 1회 호출한다(선택).
 * @returns 무작위 문항 배열 (최대 count개)
 */
export async function getRandomQuestions(
  category: QuizCategory | 'ALL',
  count: number,
  difficulty: QuizDifficulty | 'ALL' = 'ALL',
  rng: () => number = Math.random,
  onProgress?: (loaded: number, total: number) => void,
): Promise<QuizQuestion[]> {
  const categories =
    category === 'ALL'
      ? (Object.keys(QUESTION_COUNTS) as QuizCategory[])
      : [category];
  const total = categories.length;
  let loaded = 0;
  onProgress?.(0, total);
  const chunks = await Promise.all(
    categories.map((c) =>
      CATEGORY_LOADERS[c]().then((chunk) => {
        loaded += 1;
        onProgress?.(loaded, total);
        return chunk;
      }),
    ),
  );
  let pool = chunks.flat();
  if (difficulty !== 'ALL') pool = pool.filter((q) => q.difficulty === difficulty);
  return shuffle(pool, rng).slice(0, Math.max(0, count));
}

/**
 * 분야 청크를 fire-and-forget로 미리 동적 import해 번들러 캐시를 워밍한다.
 * 결과는 버리고 에러는 swallow한다(실제 로드 실패는 start()의 getRandomQuestions에서 표면화).
 * Start 버튼 hover/focus 등 선제 트리거에서 호출해 클릭 시 체감 로딩을 줄인다.
 *
 * @param category 워밍할 CS 분야 ('ALL'이면 전 분야 청크를 워밍)
 */
export function prefetchQuestions(category: QuizCategory | 'ALL'): void {
  const categories =
    category === 'ALL'
      ? (Object.keys(QUESTION_COUNTS) as QuizCategory[])
      : [category];
  categories.forEach((c) => {
    void CATEGORY_LOADERS[c]().catch(() => {});
  });
}
