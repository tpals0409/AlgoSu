/**
 * @file 분야별 문항 동적 로더 맵 (lazy-load 진입점)
 * @domain quiz
 * @layer data
 * @related src/data/quiz/types.ts, src/data/quiz/index.ts
 *
 * 각 로더는 해당 분야 파일을 동적 import하므로, 클라이언트 번들에서
 * 초기 로드 시점에 문항 데이터가 포함되지 않는다.
 * ⚠️ 절대 top-level에서 데이터 파일을 정적 import하지 말 것 — thunk 안에서만 import() 사용.
 */

import { QuizCategory, type QuizQuestion } from './types';

/**
 * QuizCategory 각 분야의 문항을 동적 import해 반환하는 로더 맵.
 * 소비처는 `await CATEGORY_LOADERS[category]()` 형태로 호출한다.
 */
export const CATEGORY_LOADERS: Record<QuizCategory, () => Promise<readonly QuizQuestion[]>> = {
  [QuizCategory.DATA_STRUCTURE]: () =>
    import('./data-structure').then((m) => m.DATA_STRUCTURE_QUESTIONS),
  [QuizCategory.ALGORITHM]: () =>
    import('./algorithm').then((m) => m.ALGORITHM_QUESTIONS),
  [QuizCategory.NETWORK]: () =>
    import('./network').then((m) => m.NETWORK_QUESTIONS),
  [QuizCategory.OS]: () =>
    import('./os').then((m) => m.OS_QUESTIONS),
  [QuizCategory.DATABASE]: () =>
    import('./database').then((m) => m.DATABASE_QUESTIONS),
  [QuizCategory.COMPUTER_ARCHITECTURE]: () =>
    import('./computer-architecture').then((m) => m.COMPUTER_ARCHITECTURE_QUESTIONS),
  [QuizCategory.DESIGN_PATTERN]: () =>
    import('./design-pattern').then((m) => m.DESIGN_PATTERN_QUESTIONS),
  [QuizCategory.WEB]: () =>
    import('./web').then((m) => m.WEB_QUESTIONS),
  [QuizCategory.SECURITY]: () =>
    import('./security').then((m) => m.SECURITY_QUESTIONS),
  [QuizCategory.AI]: () =>
    import('./ai').then((m) => m.AI_QUESTIONS),
};
