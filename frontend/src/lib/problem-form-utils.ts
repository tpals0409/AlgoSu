/**
 * @file 문제 생성/수정 폼 공통 유틸리티
 * @domain problem
 * @layer lib
 * @related ProblemCreatePage, ProblemEditPage, utils#getCurrentWeekLabel
 */

import { getCurrentWeekLabel as getCurrentWeekLabelShared } from '@/lib/utils';

// ─── TYPES ────────────────────────────────

export interface ProblemFormState {
  title: string;
  description: string;
  difficulty: string;
  deadline: string;
  allowedLanguages: string[];
  sourceUrl: string;
  /** 출처 플랫폼 -- 폼 초기값 빈 문자열 허용, 제출 시 'BOJ' | 'PROGRAMMERS'로 좁혀짐 */
  sourcePlatform: string;
}

export interface ProblemFormErrors {
  title?: string;
  deadline?: string;
}

// ─── CONSTANTS ────────────────────────────

/** 레이블 스타일 (text-text-2 = var(--text2), mb-[5px]) */
export const labelClass = 'block text-[11px] font-medium text-text-2 mb-[5px]';

/** Input 컴포넌트 기준 rounded-badge (6px) + currentColor 화살표 */
export const selectClass =
  'h-[40px] w-full px-3 pr-8 rounded-badge border border-border bg-input-bg text-text text-xs outline-none cursor-pointer transition-[border-color] duration-150 focus:border-primary disabled:cursor-not-allowed disabled:opacity-50 appearance-none' +
  " bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22M6%209l6%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_10px_center]";

/** textarea 공통 스타일 (rounded-badge 통일) */
export const textareaClass =
  'w-full px-3 py-2 rounded-badge border border-border bg-input-bg text-text text-xs outline-none transition-[border-color] duration-150 placeholder:text-text-3 focus:border-primary disabled:cursor-not-allowed disabled:opacity-50 resize-y leading-relaxed';

// ─── HELPERS ──────────────────────────────

/**
 * 현재 날짜 기준 "X월Y주차" 문자열 생성 (달력 기준).
 *
 * `lib/utils#getCurrentWeekLabel`을 재사용하여 DRY 원칙을 유지합니다.
 * 매월 1일이 속한 주가 1주차이며, 요일 오프셋을 반영합니다.
 *
 * @domain problem
 */
export function getCurrentWeekLabel(date: Date = new Date()): string {
  return getCurrentWeekLabelShared(date);
}

/**
 * 폼 유효성 검증
 * @domain problem
 */
export function validateProblemForm(form: ProblemFormState): ProblemFormErrors {
  const errors: ProblemFormErrors = {};
  if (!form.title.trim()) errors.title = 'validation.problem.titleRequired';
  if (!form.deadline) errors.deadline = 'validation.problem.deadlineRequired';
  return errors;
}
