/**
 * @file 도메인 상수 정의 (Single Source of Truth)
 * @domain common
 * @layer lib
 * @related DifficultyBadge, LangBadge, StatusBadge
 */

// ──────────────────────────────────────────────
// AlgoSu 도메인 상수 (Single Source of Truth)
// ──────────────────────────────────────────────

// ── Difficulty ──

export type Difficulty = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND' | 'RUBY';

export const DIFFICULTIES: readonly Difficulty[] = [
  'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND', 'RUBY',
] as const;

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  BRONZE: 'Bronze',
  SILVER: 'Silver',
  GOLD: 'Gold',
  PLATINUM: 'Platinum',
  DIAMOND: 'Diamond',
  RUBY: 'Ruby',
};

/** BOJ 원시 레벨(1~30) → 티어 내 등급(5~1) 변환. 이미 1~5면 그대로. */
export function toTierLevel(rawLevel: number | null | undefined): number | null {
  if (rawLevel == null || rawLevel <= 0) return null;
  if (rawLevel >= 1 && rawLevel <= 5) return rawLevel;
  return 5 - ((rawLevel - 1) % 5);
}

export const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  BRONZE: '#ad5600',
  SILVER: '#435f7a',
  GOLD: '#ec9a00',
  PLATINUM: '#27e2a4',
  DIAMOND: '#00b4fc',
  RUBY: '#FF0062',
};

// ── Language ──

export interface LanguageOption {
  readonly value: string;
  readonly label: string;
}

export const LANGUAGES: readonly LanguageOption[] = [
  { value: 'python', label: 'Python' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C++' },
  { value: 'c', label: 'C' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'kotlin', label: 'Kotlin' },
] as const;

export const LANGUAGE_VALUES = LANGUAGES.map((l) => l.value);

// ── Problem Status ──

export type ProblemStatus = 'ACTIVE' | 'CLOSED' | 'DRAFT';

export const PROBLEM_STATUSES: readonly ProblemStatus[] = [
  'ACTIVE', 'CLOSED', 'DRAFT',
] as const;

export const PROBLEM_STATUS_LABELS: Record<ProblemStatus, string> = {
  ACTIVE: '진행 중',
  CLOSED: '종료',
  DRAFT: '초안',
};

// ── Saga Step ──

export type SagaStep = 'DB_SAVED' | 'GITHUB_QUEUED' | 'AI_QUEUED' | 'DONE' | 'FAILED';

export interface SagaStepConfig {
  readonly label: string;
  readonly variant: 'success' | 'warning' | 'error' | 'info' | 'muted';
}

export const SAGA_STEP_CONFIG: Record<SagaStep, SagaStepConfig> = {
  DB_SAVED: { label: '저장됨', variant: 'muted' },
  GITHUB_QUEUED: { label: 'GitHub 대기', variant: 'info' },
  AI_QUEUED: { label: 'AI 분석 대기', variant: 'warning' },
  DONE: { label: '완료', variant: 'success' },
  FAILED: { label: '실패', variant: 'error' },
};
