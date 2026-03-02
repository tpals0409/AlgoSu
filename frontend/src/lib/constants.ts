// ──────────────────────────────────────────────
// AlgoSu 도메인 상수 (Single Source of Truth)
// ──────────────────────────────────────────────

// ── Difficulty ──

export type Difficulty = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND';

export const DIFFICULTIES: readonly Difficulty[] = [
  'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND',
] as const;

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  BRONZE: '브론즈',
  SILVER: '실버',
  GOLD: '골드',
  PLATINUM: '플래티넘',
  DIAMOND: '다이아',
};

export const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  BRONZE: '#ad5600',
  SILVER: '#435f7a',
  GOLD: '#ec9a00',
  PLATINUM: '#27e2a4',
  DIAMOND: '#00b4fc',
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
