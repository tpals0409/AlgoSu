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
}

// ─── HELPERS ──────────────────────────────

export function toTier(diff: Problem['difficulty']): DiffTier {
  return diff.toLowerCase() as DiffTier;
}

export function getSagaStatus(
  step: Submission['sagaStep'],
): { label: string; variant: 'success' | 'warning' | 'error' | 'muted' } {
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

/** Problem[] → WeekGroup[] 변환 (최신 주차 먼저) */
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
    groups.push({
      label,
      active: probs.some((p) => p.status === 'ACTIVE' && new Date(p.deadline) >= new Date()),
      problems: probs,
    });
  }

  groups.sort((a, b) => {
    const parseWeek = (s: string): number => {
      const match = s.match(/(\d+)월(\d+)주차/);
      if (!match) return 0;
      return Number(match[1]) * 10 + Number(match[2]);
    };
    return parseWeek(b.label) - parseWeek(a.label);
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
