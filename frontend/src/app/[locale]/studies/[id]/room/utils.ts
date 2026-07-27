/**
 * @file 스터디룸 유틸리티 함수 및 타입
 * @domain study
 * @layer util
 * @related page.tsx, WeekSection.tsx, AnalysisView.tsx
 */

import type { Problem, Submission } from '@/lib/api';

// ─── TYPES ────────────────────────────────

export type DiffTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'ruby' | 'unrated';

/** 주차별 문제 그룹 */
export interface WeekGroup {
  label: string;
  active: boolean;
  problems: Problem[];
  /** 주차 최신순 정렬 키 — 주차 내 최신 마감 타임스탬프 */
  recency: number;
}

// ─── HELPERS ──────────────────────────────

export function toTier(diff: Problem['difficulty']): DiffTier {
  return diff.toLowerCase() as DiffTier;
}

export function getSagaStatus(
  step: Submission['sagaStep'],
  githubSyncStatus?: Submission['githubSyncStatus'],
): { label: string; variant: 'success' | 'warning' | 'error' | 'muted' } {
  // Issue #13: sagaStep=DONE이어도 GitHub 동기화가 실패하면 완료로 표기하지 않는다
  if (step === 'DONE' && (githubSyncStatus === 'FAILED' || githubSyncStatus === 'TOKEN_INVALID')) {
    return { label: 'GitHub 동기화 실패', variant: 'error' };
  }
  switch (step) {
    case 'DONE':
      return { label: '분석 완료', variant: 'success' };
    case 'AI_QUEUED':
      return { label: '분석 중', variant: 'warning' };
    case 'GITHUB_QUEUED':
      return { label: 'GitHub 동기화 중', variant: 'warning' };
    case 'FAILED':
      return { label: '실패', variant: 'error' };
    default:
      return { label: '대기', variant: 'muted' };
  }
}

/** 문제가 진행 중인지 (상태 ACTIVE + 마감 미도래) */
export function isProblemActive(p: Problem): boolean {
  return p.status === 'ACTIVE' && new Date(p.deadline) >= new Date();
}

/** 문제 마감 타임스탬프 (없거나 파싱 불가면 0) */
function deadlineTs(p: Problem): number {
  const ts = p.deadline ? new Date(p.deadline).getTime() : 0;
  return Number.isNaN(ts) ? 0 : ts;
}

/**
 * Problem[] → WeekGroup[] 변환.
 * - 주차 정렬: 활성 주차 우선 → 이후 최신순(주차 내 최신 마감 타임스탬프 내림차순).
 *   status가 ACTIVE 아님(CLOSED 등)이지만 마감일이 미래인 문제로 인해
 *   비활성 주차가 활성 주차 위로 오르는 것을 방지(#8: 종료 주차는 아래). 연도 경계 무관.
 * - 주차 내 정렬: 진행 중 문제 우선 → 이후 최신 마감순 (종료된 문제는 아래로).
 */
export function groupProblemsByWeek(problems: Problem[]): WeekGroup[] {
  const groupMap = new Map<string, Problem[]>();
  for (const problem of problems) {
    const key = problem.weekNumber || '미분류';
    const group = groupMap.get(key);
    if (group) group.push(problem);
    else groupMap.set(key, [problem]);
  }

  const groups: WeekGroup[] = [];
  for (const [label, probs] of groupMap) {
    const sorted = [...probs].sort((a, b) => {
      const aActive = isProblemActive(a);
      const bActive = isProblemActive(b);
      if (aActive !== bActive) return aActive ? -1 : 1;
      return deadlineTs(b) - deadlineTs(a);
    });
    groups.push({
      label,
      active: sorted.some(isProblemActive),
      problems: sorted,
      recency: Math.max(0, ...sorted.map(deadlineTs)),
    });
  }

  groups.sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return b.recency - a.recency;
  });

  return groups;
}

export const CATEGORY_LABELS: Record<string, string> = {
  efficiency: '효율성',
  readability: '가독성',
  correctness: '정확성',
  style: '코드 스타일',
  maintainability: '유지보수성',
};

export function barColor(score: number): string {
  if (score >= 80) return 'var(--success)';
  if (score >= 60) return 'var(--warning)';
  return 'var(--error)';
}

/** feedback JSON 파싱 — name/highlights 형태와 category/lines 형태 모두 지원 */
export function parseFeedbackCategories(feedback: string | null): { name: string; score: number; comment: string }[] {
  if (!feedback) return [];
  try {
    // Claude hallucination 대응: 숫자 뒤 불필요한 따옴표 제거
    let rawJson = feedback.replace(/:\s*(\d+)"(\s*[,}\]])/g, ': $1$2');
    try {
      JSON.parse(rawJson);
    } catch {
      // JSON 뒤에 추가 텍스트가 있을 수 있음 — 첫 번째 유효 JSON 객체 추출
      const start = rawJson.indexOf('{');
      if (start === -1) return [];
      let depth = 0, end = -1;
      for (let i = start; i < rawJson.length; i++) {
        if (rawJson[i] === '{') depth++;
        else if (rawJson[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
      }
      if (end === -1) return [];
      rawJson = rawJson.substring(start, end + 1);
    }
    const parsed = JSON.parse(rawJson);
    const cats = parsed.categories ?? parsed;
    if (!Array.isArray(cats)) return [];
    return cats.map((c: Record<string, unknown>) => ({
      name: (c.name ?? c.category ?? '') as string,
      score: (c.score ?? 0) as number,
      comment: (c.comment ?? '') as string,
    }));
  } catch {
    return [];
  }
}
