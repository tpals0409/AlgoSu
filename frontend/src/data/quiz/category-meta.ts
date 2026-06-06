/**
 * @file 퀴즈 분야별 시각 메타 (lucide 아이콘 + accent 색상 토큰) SSOT
 * @domain quiz
 * @layer data
 * @related src/data/quiz/types.ts, src/data/quiz/index.ts, src/components/quiz/QuizStart.tsx, src/components/quiz/QuizPlay.tsx
 */
import { Boxes, GitBranch, Network, Cpu, Database, type LucideIcon } from 'lucide-react';
import { QuizCategory } from './types';

/**
 * 분야별 시각 메타.
 * 색상은 globals.css의 `--quiz-cat-*` CSS 변수를 참조하는 `var(...)` 문자열로 둔다
 * (`--diff-*`/`--lang-*` 선례 — 하드코딩 hex 금지, 라이트/다크 자동 전환).
 */
export interface QuizCategoryMeta {
  /** 분야 대표 lucide 아이콘 (소비처에서 반드시 aria-hidden 처리) */
  readonly icon: LucideIcon;
  /** accent 텍스트/테두리 색 — `var(--quiz-cat-*-color)` */
  readonly colorVar: string;
  /** accent soft 배경 색 — `var(--quiz-cat-*-bg)` */
  readonly bgVar: string;
}

/** 분야 enum → 시각 메타 매핑 (전 분야 망라). */
export const QUIZ_CATEGORY_META: Record<QuizCategory, QuizCategoryMeta> = {
  [QuizCategory.DATA_STRUCTURE]: {
    icon: Boxes,
    colorVar: 'var(--quiz-cat-data-structure-color)',
    bgVar: 'var(--quiz-cat-data-structure-bg)',
  },
  [QuizCategory.ALGORITHM]: {
    icon: GitBranch,
    colorVar: 'var(--quiz-cat-algorithm-color)',
    bgVar: 'var(--quiz-cat-algorithm-bg)',
  },
  [QuizCategory.NETWORK]: {
    icon: Network,
    colorVar: 'var(--quiz-cat-network-color)',
    bgVar: 'var(--quiz-cat-network-bg)',
  },
  [QuizCategory.OS]: {
    icon: Cpu,
    colorVar: 'var(--quiz-cat-os-color)',
    bgVar: 'var(--quiz-cat-os-bg)',
  },
  [QuizCategory.DATABASE]: {
    icon: Database,
    colorVar: 'var(--quiz-cat-database-color)',
    bgVar: 'var(--quiz-cat-database-bg)',
  },
};

/**
 * 분야의 시각 메타(아이콘·색상 토큰)를 반환한다.
 *
 * @param category CS 분야
 * @returns 해당 분야의 아이콘과 색상 변수 메타
 */
export function getQuizCategoryMeta(category: QuizCategory): QuizCategoryMeta {
  return QUIZ_CATEGORY_META[category];
}
