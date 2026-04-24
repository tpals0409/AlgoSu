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

export type Difficulty = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND' | 'RUBY' | 'UNCLASSIFIED';

export const DIFFICULTIES: readonly Difficulty[] = [
  'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND', 'RUBY', 'UNCLASSIFIED',
] as const;

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  BRONZE: 'Bronze',
  SILVER: 'Silver',
  GOLD: 'Gold',
  PLATINUM: 'Platinum',
  DIAMOND: 'Diamond',
  RUBY: 'Ruby',
  UNCLASSIFIED: 'Unclassified',
};

/**
 * BOJ 원시 레벨(1~30) → 티어 내 등급(5~1) 변환. 예: 1→5(Bronze5), 12→4(Gold4), 30→1(Ruby1)
 * @warning BOJ 전용 (1~30 레벨 범위). 프로그래머스에서는 사용하지 않는다.
 */
export function toTierLevel(rawLevel: number | null | undefined): number | null {
  if (rawLevel == null || rawLevel <= 0) return null;
  return 5 - ((rawLevel - 1) % 5);
}

export const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  BRONZE: '#ad5600',
  SILVER: '#435f7a',
  GOLD: '#ec9a00',
  PLATINUM: '#27e2a4',
  DIAMOND: '#00b4fc',
  RUBY: '#FF0062',
  UNCLASSIFIED: '#8B8B95',
};

/** 난이도별 도트 색상 — CSS 변수(--diff-*-color) 기반 inline style */
export const DIFF_DOT_STYLE: Record<string, { backgroundColor: string }> = {
  bronze:       { backgroundColor: 'var(--diff-bronze-color)' },
  silver:       { backgroundColor: 'var(--diff-silver-color)' },
  gold:         { backgroundColor: 'var(--diff-gold-color)' },
  platinum:     { backgroundColor: 'var(--diff-platinum-color)' },
  diamond:      { backgroundColor: 'var(--diff-diamond-color)' },
  ruby:         { backgroundColor: 'var(--diff-ruby-color)' },
  unclassified: { backgroundColor: 'var(--diff-unclassified-color)' },
};

/** 난이도별 뱃지 배경 — CSS 변수(--diff-*-bg, --diff-*-color) 기반 inline style */
export const DIFF_BADGE_STYLE: Record<string, { backgroundColor: string; color: string }> = {
  bronze:       { backgroundColor: 'var(--diff-bronze-bg)',        color: 'var(--diff-bronze-color)' },
  silver:       { backgroundColor: 'var(--diff-silver-bg)',        color: 'var(--diff-silver-color)' },
  gold:         { backgroundColor: 'var(--diff-gold-bg)',          color: 'var(--diff-gold-color)' },
  platinum:     { backgroundColor: 'var(--diff-platinum-bg)',      color: 'var(--diff-platinum-color)' },
  diamond:      { backgroundColor: 'var(--diff-diamond-bg)',       color: 'var(--diff-diamond-color)' },
  ruby:         { backgroundColor: 'var(--diff-ruby-bg)',          color: 'var(--diff-ruby-color)' },
  unclassified: { backgroundColor: 'var(--diff-unclassified-bg)', color: 'var(--diff-unclassified-color)' },
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
  /** Sprint 108: SQL 고득점 Kit 제출 지원 */
  { value: 'sql', label: 'SQL' },
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

// ── Source Platform ──

export type SourcePlatform = 'BOJ' | 'PROGRAMMERS';

/** 플랫폼 약어 라벨 — UI 뱃지(w-10) 오버플로 방지 */
export const PLATFORM_SHORT_LABELS: Record<string, string> = {
  BOJ: 'BOJ',
  PROGRAMMERS: 'PG',
};

/** 프로그래머스 레벨(0~5) 라벨 맵 */
export const PROGRAMMERS_LEVEL_LABELS: Record<number, string> = {
  0: 'Lv.0',
  1: 'Lv.1',
  2: 'Lv.2',
  3: 'Lv.3',
  4: 'Lv.4',
  5: 'Lv.5',
};
