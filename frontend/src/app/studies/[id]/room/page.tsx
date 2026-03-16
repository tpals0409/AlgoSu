/**
 * @file 스터디룸 — 주차별 문제 타임라인 + 제출 현황 + 분석 뷰
 * @domain study
 * @layer page
 * @related AppLayout, StudyContext, problemApi, submissionApi
 */

'use client';

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type ReactElement,
  type ReactNode,
  type CSSProperties,
} from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  BookOpen,
  Users,
  Sparkles,
  Code2,
  ChevronRight,
  ChevronDown,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  Copy,
  Check,
  Brain,
  BarChart3,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/Card';
import { ScoreGauge } from '@/components/ui/ScoreGauge';
import { CodeBlock } from '@/components/ui/CodeBlock';
import { useAuth } from '@/contexts/AuthContext';
import { useStudy } from '@/contexts/StudyContext';
import {
  problemApi,
  submissionApi,
  studyApi,
  ApiError,
  type Problem,
  type Submission,
  type AnalysisResult,
  type StudyStats,
  type StudyMember,
} from '@/lib/api';
import { DifficultyBadge } from '@/components/ui/DifficultyBadge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton';
import { StudyNoteEditor } from '@/components/review/StudyNoteEditor';
import { getAvatarPresetKey, getAvatarSrc } from '@/lib/avatars';

// ─── TYPES ────────────────────────────────

type DiffTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'ruby' | 'unrated';

/** 주차별 문제 그룹 */
interface WeekGroup {
  label: string;
  active: boolean;
  problems: Problem[];
}

// ─── HELPERS ──────────────────────────────

function toTier(diff: Problem['difficulty']): DiffTier {
  return diff.toLowerCase() as DiffTier;
}

function getSagaStatus(
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
function groupProblemsByWeek(problems: Problem[]): WeekGroup[] {
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
      active: probs.some((p) => p.status === 'ACTIVE'),
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

const CATEGORY_LABELS: Record<string, string> = {
  efficiency: '효율성',
  readability: '가독성',
  correctness: '정확성',
  style: '코드 스타일',
  maintainability: '유지보수성',
};

function barColor(score: number): string {
  if (score >= 80) return 'var(--success)';
  if (score >= 60) return 'var(--warning)';
  return 'var(--error)';
}

/** feedback JSON 파싱 — name/highlights 형태와 category/lines 형태 모두 지원 */
function parseFeedbackCategories(feedback: string | null): { name: string; score: number; comment: string }[] {
  if (!feedback) return [];
  try {
    let rawJson = feedback;
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

// ─── COMPONENT ────────────────────────────

export default function StudyRoomPage(): ReactElement {
  const params = useParams<{ id: string }>();
  void useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { currentStudyId, setCurrentStudy } = useStudy();

  // ─── STATE ──────────────────────────────
  const [problems, setProblems] = useState<Problem[]>([]);
  const [selectedProblem, setSelectedProblem] = useState<Problem | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loadingProblems, setLoadingProblems] = useState(true);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notSubmitted, setNotSubmitted] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [nicknameMap, setNicknameMap] = useState<Record<string, string>>({});
  const [avatarMap, setAvatarMap] = useState<Record<string, string | null>>({});
  const [members, setMembers] = useState<StudyMember[]>([]);
  const [studyStats, setStudyStats] = useState<StudyStats | null>(null);

  // mount animation
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  const [barsAnimated, setBarsAnimated] = useState(false);

  const fade = (delay = 0): CSSProperties => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'translateY(0)' : 'translateY(16px)',
    transition: `opacity .5s cubic-bezier(.16,1,.3,1) ${delay}s, transform .5s cubic-bezier(.16,1,.3,1) ${delay}s`,
  });

  const studyId = params.id;

  const weekGroups = useMemo(() => groupProblemsByWeek(problems), [problems]);

  /** 문제별 제출 수 + 분석 완료 수 맵 */
  const submissionCountByProblem = useMemo(() => {
    const map = new Map<string, { count: number; analyzedCount: number }>();
    for (const entry of studyStats?.submitterCountByProblem ?? []) {
      map.set(entry.problemId, { count: entry.count, analyzedCount: entry.analyzedCount });
    }
    return map;
  }, [studyStats]);

  const totalMembers = members.length;

  // 스터디 ID 동기화
  useEffect(() => {
    if (studyId && studyId !== currentStudyId) {
      setCurrentStudy(studyId);
    }
  }, [studyId, currentStudyId, setCurrentStudy]);

  const abortControllerRef = useRef<AbortController | null>(null);

  // ─── EFFECTS ────────────────────────────

  useEffect(() => {
    if (!isAuthenticated || authLoading || !currentStudyId) return;
    let cancelled = false;
    setLoadingProblems(true);
    setError(null);

    problemApi.findAllProblems()
      .then((data) => {
        if (cancelled) return;
        setProblems(data);
        setTimeout(() => setBarsAnimated(true), 400);
        const qsProblemId = searchParams.get('problemId');
        if (qsProblemId) {
          const target = data.find((p) => p.id === qsProblemId);
          if (target) {
            setSelectedProblem(target);
            void loadSubmissions(target);
          }
        }
      })
      .catch(() => {
        if (!cancelled) setError('문제 목록을 불러오지 못했습니다.');
      })
      .finally(() => {
        if (!cancelled) setLoadingProblems(false);
      });

    if (currentStudyId) {
      studyApi.getMembers(currentStudyId).then((memberData) => {
        if (cancelled) return;
        setMembers(memberData);
        const nMap: Record<string, string> = {};
        const aMap: Record<string, string | null> = {};
        for (const m of memberData) {
          if (m.nickname) nMap[m.user_id] = m.nickname;
          else if (m.username) nMap[m.user_id] = m.username;
          aMap[m.user_id] = m.avatar_url ?? null;
        }
        setNicknameMap(nMap);
        setAvatarMap(aMap);
      }).catch(() => {});

      studyApi.getStats(currentStudyId).then((data) => {
        if (!cancelled) setStudyStats(data);
      }).catch(() => {});
    }

    return () => { cancelled = true; abortControllerRef.current?.abort(); };
  }, [isAuthenticated, authLoading, currentStudyId]);

  const loadSubmissions = useCallback(async (problem: Problem, signal?: AbortSignal): Promise<void> => {
    setLoadingSubmissions(true);
    setNotSubmitted(false);
    setAccessDenied(false);
    try {
      const data = await submissionApi.listByProblemForStudy(problem.id);
      if (signal?.aborted) return;
      const latestByUser = data.filter((sub, idx, arr) =>
        arr.findIndex((s) => s.userId === sub.userId) === idx,
      );
      setSubmissions(latestByUser);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (signal?.aborted) return;
      if (err instanceof ApiError && err.status === 403) {
        const msg = (err.message ?? '').toLowerCase();
        if (msg.includes('not submitted') || msg.includes('제출')) {
          setNotSubmitted(true);
        } else {
          setAccessDenied(true);
        }
        setSubmissions([]);
      } else {
        setError('제출 목록을 불러오지 못했습니다.');
        setSubmissions([]);
      }
    } finally {
      if (!signal?.aborted) setLoadingSubmissions(false);
    }
  }, []);

  const loadAnalysis = useCallback(async (sub: Submission): Promise<void> => {
    setLoadingAnalysis(true);
    try {
      const [analysisData, fullSub] = await Promise.all([
        submissionApi.getAnalysis(sub.id),
        submissionApi.findById(sub.id),
      ]);
      setAnalysis(analysisData);
      // code가 없으면 fullSub에서 가져옴
      if (!sub.code && fullSub.code) {
        setSelectedSubmission({ ...sub, code: fullSub.code });
      }
    } catch {
      setAnalysis(null);
    } finally {
      setLoadingAnalysis(false);
    }
  }, []);

  // ─── BROWSER HISTORY 연동 ────────────────
  // 뷰 전환 시 pushState → 브라우저 뒤로가기로도 앱 내 뷰 복귀
  useEffect(() => {
    const onPopState = (e: PopStateEvent): void => {
      const state = e.state as { view?: string } | null;
      if (!state?.view || state.view === 'main') {
        setSelectedProblem(null);
        setSelectedSubmission(null);
        setSubmissions([]);
        setNotSubmitted(false);
        setAnalysis(null);
      } else if (state.view === 'submission') {
        setSelectedSubmission(null);
        setAnalysis(null);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // ─── HANDLERS ───────────────────────────

  const handleSelectProblem = (problem: Problem): void => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setSelectedProblem(problem);
    setSelectedSubmission(null);
    setAnalysis(null);
    window.history.pushState({ view: 'submission' }, '');
    void loadSubmissions(problem, controller.signal);
  };

  const handleBack = (): void => {
    setSelectedProblem(null);
    setSelectedSubmission(null);
    setSubmissions([]);
    setNotSubmitted(false);
    setAnalysis(null);
    setMounted(false);
    setTimeout(() => setMounted(true), 50);
    window.history.back();
  };

  const handleSelectSubmission = (sub: Submission): void => {
    setSelectedSubmission(sub);
    window.history.pushState({ view: 'analysis' }, '');
    void loadAnalysis(sub);
  };

  const handleSubmissionBack = (): void => {
    setSelectedSubmission(null);
    setAnalysis(null);
    window.history.back();
  };

  const stats = useMemo(() => ({
    totalProblems: problems.length,
    totalSubmissions: studyStats?.uniqueSubmissions ?? 0,
    totalAnalyzed: studyStats?.uniqueAnalyzed ?? 0,
  }), [problems, studyStats]);

  // ─── RENDER ─────────────────────────────

  if (authLoading) {
    return (
      <AppLayout>
        <div className="space-y-4 py-8">
          <Skeleton height={32} width="40%" />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </AppLayout>
    );
  }

  // 3단계: 분석 결과 뷰
  if (selectedProblem && selectedSubmission) {
    return (
      <AppLayout>
        <AnalysisView
          problem={selectedProblem}
          submission={selectedSubmission}
          analysis={analysis}
          loading={loadingAnalysis}
          nicknameMap={nicknameMap}
          avatarMap={avatarMap}
          onBack={handleSubmissionBack}
        />
      </AppLayout>
    );
  }

  // 2단계: 제출 현황 뷰
  if (selectedProblem) {
    const problemStats = submissionCountByProblem.get(selectedProblem.id);
    const submittedCount = problemStats?.count ?? 0;
    const analyzedCount = problemStats?.analyzedCount ?? 0;

    return (
      <AppLayout>
        <SubmissionView
          problem={selectedProblem}
          submissions={submissions}
          loading={loadingSubmissions}
          notSubmitted={notSubmitted}
          accessDenied={accessDenied}
          nicknameMap={nicknameMap}
          avatarMap={avatarMap}
          error={error}
          totalMembers={totalMembers}
          submittedCount={submittedCount}
          analyzedCount={analyzedCount}
          onBack={handleBack}
          onSelectSubmission={handleSelectSubmission}
        />
      </AppLayout>
    );
  }

  // 1단계: 메인 뷰 — 스터디룸
  return (
    <AppLayout>
      <div className="space-y-6">
        <div style={fade(0)}>
          <h1 className="text-[22px] font-bold tracking-tight text-text">스터디룸</h1>
          <p className="mt-0.5 text-sm text-text-2">문제를 선택해 멤버별 제출 코드를 확인하세요.</p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" style={fade(0.06)}>
          <StatCard icon={<BookOpen className="h-5 w-5" />} iconBg="var(--primary-soft)" iconColor="var(--primary)" value={stats.totalProblems} label="전체 문제" />
          <StatCard icon={<Users className="h-5 w-5" />} iconBg="var(--info-soft, rgba(59,130,206,0.12))" iconColor="var(--info, #3B82CE)" value={stats.totalSubmissions} label="총 제출" />
          <StatCard icon={<Sparkles className="h-5 w-5" />} iconBg="var(--success-soft)" iconColor="var(--success)" value={stats.totalAnalyzed} label="분석 완료" />
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-card border border-error bg-error-soft px-4 py-3">
            <AlertCircle className="h-4 w-4 text-error" />
            <span className="text-xs text-error">{error}</span>
          </div>
        )}

        <div style={fade(0.12)}>
          {loadingProblems ? (
            <div className="space-y-3"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>
          ) : problems.length === 0 ? (
            <div className="rounded-card border border-border bg-bg-card py-16 text-center shadow-card">
              <Code2 className="mx-auto mb-3 h-8 w-8 text-text-3 opacity-40" />
              <p className="text-sm text-text-3">등록된 문제가 없습니다</p>
            </div>
          ) : (
            <div className="space-y-6">
              {weekGroups.map((week) => (
                <WeekSection
                  key={week.label}
                  week={week}
                  barsAnimated={barsAnimated}
                  submissionCountByProblem={submissionCountByProblem}
                  totalMembers={totalMembers}
                  onSelect={handleSelectProblem}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

// ─── STAT CARD ───────────────────────────

function StatCard({ icon, iconBg, iconColor, value, label }: {
  readonly icon: ReactNode; readonly iconBg: string; readonly iconColor: string;
  readonly value: number; readonly label: string;
}): ReactNode {
  return (
    <Card className="flex items-center gap-3 px-4 py-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: iconBg, color: iconColor }}>{icon}</div>
      <div>
        <p className="text-xl font-bold text-text">{value}</p>
        <p className="text-[11px] text-text-3">{label}</p>
      </div>
    </Card>
  );
}

// ─── WEEK SECTION ────────────────────────

function WeekSection({ week, barsAnimated, submissionCountByProblem, totalMembers, onSelect }: {
  readonly week: WeekGroup; readonly barsAnimated: boolean;
  readonly submissionCountByProblem: Map<string, { count: number; analyzedCount: number }>;
  readonly totalMembers: number;
  readonly onSelect: (p: Problem) => void;
}): ReactNode {
  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold"
          style={{
            backgroundColor: week.active ? 'var(--primary-soft)' : 'var(--bg-alt)',
            color: week.active ? 'var(--primary)' : 'var(--text-3)',
          }}
        >
          {week.label}
          {week.active && <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: 'var(--success)' }} />}
        </span>
        <div className="h-px flex-1" style={{ backgroundColor: 'var(--border)' }} />
        <span className="text-[11px] text-text-3">{week.problems.length}문제</span>
      </div>
      <div className="space-y-3">
        {week.problems.map((p) => (
          <ProblemTimelineCard
            key={p.id}
            problem={p}
            barsAnimated={barsAnimated}
            submittedCount={submissionCountByProblem.get(p.id)?.count ?? 0}
            totalMembers={totalMembers}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

// ─── PROBLEM TIMELINE CARD ───────────────

function ProblemTimelineCard({ problem, barsAnimated, submittedCount, totalMembers, onSelect }: {
  readonly problem: Problem; readonly barsAnimated: boolean;
  readonly submittedCount: number; readonly totalMembers: number;
  readonly onSelect: (p: Problem) => void;
}): ReactNode {
  const tier = toTier(problem.difficulty);
  const isActive = problem.status === 'ACTIVE';
  const tags = problem.tags ?? [];
  const pct = totalMembers > 0 ? (submittedCount / totalMembers) * 100 : 0;

  return (
    <Card className="overflow-hidden p-0 cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-hover" onClick={() => onSelect(problem)}>
      <div className="flex">
        <div className="w-1 shrink-0" style={{ backgroundColor: `var(--diff-${tier}-color)` }} />
        <div className="flex-1 px-3 py-3 sm:px-5 sm:py-4">
          <div className="flex items-center gap-2 mb-2">
            <DifficultyBadge difficulty={problem.difficulty} level={problem.level} />
            {isActive ? (
              <span className="inline-flex items-center gap-1 rounded-badge px-2 py-0.5 text-[11px] font-medium" style={{ color: 'var(--success)', backgroundColor: 'var(--success-soft)' }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: 'var(--success)' }} />진행 중
              </span>
            ) : (
              <span className="inline-flex items-center rounded-badge px-2 py-0.5 text-[11px] font-medium" style={{ color: 'var(--text-3)', backgroundColor: 'var(--bg-alt)' }}>종료</span>
            )}
          </div>
          <h3 className="text-[15px] font-bold text-text mb-1.5">{problem.title}</h3>
          {tags.length > 0 && (
            <div className="flex items-center gap-1.5 mb-3">
              {tags.map((tag) => (
                <span key={tag} className="rounded-badge px-2 py-0.5 text-[11px]" style={{ backgroundColor: 'var(--bg-alt)', color: 'var(--text-3)' }}>{tag}</span>
              ))}
            </div>
          )}
          <div className="h-2 w-full overflow-hidden rounded-full" style={{ backgroundColor: 'var(--bg-alt)' }}>
            <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: barsAnimated ? `${pct}%` : '0%', backgroundColor: `var(--diff-${tier}-color)` }} />
          </div>
          <div className="mt-2 flex items-center justify-end gap-3 text-[11px] text-text-3">
            <span>{submittedCount} / {totalMembers}명</span>
          </div>
        </div>
        <div className="flex items-center pr-4"><ChevronRight className="h-4 w-4 text-text-3" /></div>
      </div>
    </Card>
  );
}

// ─── SUBMISSION VIEW (2단계) ─────────────

function SubmissionView({ problem, submissions, loading, notSubmitted, accessDenied, nicknameMap, avatarMap, error, totalMembers, submittedCount, analyzedCount, onBack, onSelectSubmission }: {
  readonly problem: Problem; readonly submissions: Submission[]; readonly loading: boolean;
  readonly notSubmitted: boolean; readonly accessDenied: boolean; readonly nicknameMap: Record<string, string>;
  readonly avatarMap: Record<string, string | null>; readonly error: string | null;
  readonly totalMembers: number; readonly submittedCount: number; readonly analyzedCount: number;
  readonly onBack: () => void; readonly onSelectSubmission: (sub: Submission) => void;
}): ReactNode {
  const [viewMounted, setViewMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setViewMounted(true), 50); return () => clearTimeout(t); }, []);
  const vfade = (delay = 0): CSSProperties => ({
    opacity: viewMounted ? 1 : 0, transform: viewMounted ? 'translateY(0)' : 'translateY(16px)',
    transition: `opacity .5s cubic-bezier(.16,1,.3,1) ${delay}s, transform .5s cubic-bezier(.16,1,.3,1) ${delay}s`,
  });

  const tier = toTier(problem.difficulty);
  const pct = totalMembers > 0 ? (submittedCount / totalMembers) * 100 : 0;

  return (
    <div className="space-y-5">
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-card border border-error bg-error-soft px-4 py-3">
          <AlertCircle className="h-4 w-4 text-error" /><span className="text-xs text-error">{error}</span>
        </div>
      )}

      {/* 헤더 */}
      <div className="flex items-center gap-3" style={vfade(0)}>
        <button type="button" onClick={onBack} className="flex items-center justify-center shrink-0 h-9 w-9 rounded-full transition-colors hover:bg-bg-alt">
          <ArrowLeft className="h-5 w-5" style={{ color: 'var(--text)' }} />
        </button>
        <div>
          <h1 className="text-lg sm:text-[22px] font-bold tracking-tight text-text">{problem.title}</h1>
          <p className="mt-0.5 text-xs sm:text-sm text-text-3">{problem.weekNumber} · 멤버별 제출 현황</p>
        </div>
      </div>

      {/* 진행 바 */}
      <div className="h-2 w-full overflow-hidden rounded-full" style={{ backgroundColor: 'var(--bg-alt)' }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: `var(--diff-${tier}-color)` }} />
      </div>

      {/* 정보 카드 */}
      <Card className="p-0 overflow-hidden" style={vfade(0.06)}>
        <div className="px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div className="flex flex-wrap items-center gap-2">
              <DifficultyBadge difficulty={problem.difficulty} level={problem.level} />
              {(problem.tags ?? []).map((tag) => (
                <span key={tag} className="rounded-badge px-2 py-0.5 text-[11px]" style={{ backgroundColor: 'var(--bg-alt)', color: 'var(--text-3)' }}>{tag}</span>
              ))}
            </div>
            {problem.sourceUrl && (
              <a href={problem.sourceUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[12px] font-medium text-primary transition-colors hover:underline">
                문제 보기<ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="flex items-center justify-center gap-1.5"><Users className="h-4 w-4 text-text-3" /><span className="text-lg font-bold text-text">{totalMembers}</span></div>
              <p className="text-[11px] text-text-3">전체 멤버</p>
            </div>
            <div>
              <div className="flex items-center justify-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-text-3" /><span className="text-lg font-bold text-text">{submittedCount}</span></div>
              <p className="text-[11px] text-text-3">제출 완료</p>
            </div>
            <div>
              <div className="flex items-center justify-center gap-1.5"><Sparkles className="h-4 w-4" style={{ color: 'var(--success)' }} /><span className="text-lg font-bold" style={{ color: 'var(--success)' }}>{analyzedCount}</span></div>
              <p className="text-[11px] text-text-3">분석 완료</p>
            </div>
          </div>
        </div>
      </Card>

      {/* 로딩 / 미제출 / 제출 목록 */}
      {loading ? (
        <div className="space-y-3"><SkeletonCard /><SkeletonCard /></div>
      ) : accessDenied ? (
        <Card><CardContent className="py-10 text-center">
          <ShieldAlert className="mx-auto mb-2 h-6 w-6 text-error opacity-60" />
          <p className="text-sm font-medium text-text">이 스터디에 접근 권한이 없습니다</p>
          <p className="mt-1 text-xs text-text-3">스터디 멤버만 제출 내역을 볼 수 있습니다</p>
        </CardContent></Card>
      ) : notSubmitted ? (
        <Card><CardContent className="py-10 text-center">
          <Code2 className="mx-auto mb-2 h-6 w-6 text-primary opacity-60" />
          <p className="text-sm font-medium text-text">문제를 먼저 제출해주세요</p>
          <p className="mt-1 text-xs text-text-3">제출 후 다른 스터디원의 풀이를 볼 수 있습니다</p>
        </CardContent></Card>
      ) : submissions.length === 0 ? (
        <Card><CardContent className="py-10 text-center">
          <Code2 className="mx-auto mb-2 h-6 w-6 text-text-3 opacity-40" />
          <p className="text-xs text-text-3">아직 제출이 없습니다</p>
        </CardContent></Card>
      ) : (
        <>
          <p className="text-sm font-medium text-text-2" style={vfade(0.1)}>제출 완료 · {submissions.length}명</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" style={vfade(0.14)}>
            {submissions.map((sub) => {
              const saga = getSagaStatus(sub.sagaStep);
              const name = (sub.userId && nicknameMap[sub.userId]) ? nicknameMap[sub.userId] : '익명';
              const avatarUrl = sub.userId ? avatarMap[sub.userId] : null;

              return (
                <Card key={sub.id} className="p-4 cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-hover" onClick={() => onSelectSubmission(sub)}>
                  <div className="flex items-center gap-3">
                    <img
                      src={avatarUrl ? getAvatarSrc(getAvatarPresetKey(avatarUrl)) : getAvatarSrc('default')}
                      alt="" className="h-10 w-10 shrink-0 rounded-full object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold text-text">{name}</span>
                        <span className="rounded-full px-2 py-0.5 text-[11px] font-medium uppercase" style={{ backgroundColor: 'var(--bg-alt)', color: 'var(--text-2)' }}>{sub.language}</span>
                      </div>
                      <p className="text-[11px] text-text-3">
                        {new Date(sub.createdAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-text-3" />
                  </div>
                  <div className="mt-3">
                    <span className="flex items-center gap-1 text-[12px] font-medium" style={{ color: saga.variant === 'success' ? 'var(--success)' : saga.variant === 'warning' ? 'var(--warning)' : 'var(--text-3)' }}>
                      <Sparkles className="h-3.5 w-3.5" />{saga.label}
                      {sub.aiScore != null && <span className="ml-1 font-bold">{sub.aiScore}점</span>}
                    </span>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* 스터디 노트 */}
      <StudyNoteEditor problemId={problem.id} />
    </div>
  );
}

// ─── ANALYSIS VIEW (3단계) ───────────────

function AnalysisView({ problem, submission, analysis, loading, nicknameMap, avatarMap, onBack }: {
  readonly problem: Problem; readonly submission: Submission;
  readonly analysis: AnalysisResult | null; readonly loading: boolean;
  readonly nicknameMap: Record<string, string>; readonly avatarMap: Record<string, string | null>;
  readonly onBack: () => void;
}): ReactNode {
  const [copied, setCopied] = useState(false);
  const [showOptimized, setShowOptimized] = useState(false);
  const [analysisBarsAnimated, setAnalysisBarsAnimated] = useState(false);
  const [viewMounted, setViewMounted] = useState(false);

  useEffect(() => { const t = setTimeout(() => setViewMounted(true), 50); return () => clearTimeout(t); }, []);
  useEffect(() => { if (!analysis) return; const t = setTimeout(() => setAnalysisBarsAnimated(true), 400); return () => clearTimeout(t); }, [analysis]);

  const vfade = (delay = 0): CSSProperties => ({
    opacity: viewMounted ? 1 : 0, transform: viewMounted ? 'translateY(0)' : 'translateY(16px)',
    transition: `opacity .5s cubic-bezier(.16,1,.3,1) ${delay}s, transform .5s cubic-bezier(.16,1,.3,1) ${delay}s`,
  });

  const handleCopy = async (text: string): Promise<void> => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
  };

  const name = (submission.userId && nicknameMap[submission.userId]) ? nicknameMap[submission.userId] : '익명';
  const avatarUrl = submission.userId ? avatarMap[submission.userId] : null;
  const saga = getSagaStatus(submission.sagaStep);
  const langMap: Record<string, string> = { python: 'python', java: 'java', cpp: 'cpp', javascript: 'javascript', c: 'c' };
  const langKey = langMap[submission.language.toLowerCase()] ?? 'text';

  const categories = parseFeedbackCategories(analysis?.feedback ?? null);
  const totalScore = analysis?.score ?? submission.aiScore ?? 0;

  // 로딩 또는 분석 미완료
  if (loading || !analysis || analysis.analysisStatus !== 'completed') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3" style={vfade(0)}>
          <button type="button" onClick={onBack} className="flex items-center justify-center shrink-0 h-9 w-9 rounded-full transition-colors hover:bg-bg-alt">
            <ArrowLeft className="h-5 w-5" style={{ color: 'var(--text)' }} />
          </button>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-text">{name}의 제출</h1>
            <p className="text-sm text-text-3">{problem.title}</p>
          </div>
        </div>
        <Card><CardContent className="flex flex-col items-center justify-center py-16 gap-4">
          {loading ? <Skeleton height={48} width="60%" /> : (
            <>
              <Sparkles className="h-8 w-8 text-warning" />
              <div className="text-center">
                <p className="text-sm font-medium text-text">
                  {saga.variant === 'warning' ? 'AI 분석 중...' : analysis?.analysisStatus === 'failed' ? '분석 실패' : '분석 대기 중'}
                </p>
                <p className="mt-1 text-[11px] text-text-3">
                  {saga.variant === 'warning' ? '분석이 완료되면 결과가 표시됩니다.' : '아직 분석이 완료되지 않았습니다.'}
                </p>
              </div>
            </>
          )}
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="space-y-3" style={vfade(0)}>
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack} className="flex items-center justify-center shrink-0 h-9 w-9 rounded-full transition-colors hover:bg-bg-alt">
            <ArrowLeft className="h-5 w-5" style={{ color: 'var(--text)' }} />
          </button>
          <img src={avatarUrl ? getAvatarSrc(getAvatarPresetKey(avatarUrl)) : getAvatarSrc('default')} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
          <div>
            <h1 className="text-xl font-bold tracking-tight text-text">{name}</h1>
            <p className="text-sm text-text-3">{problem.title}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <DifficultyBadge difficulty={problem.difficulty} level={problem.level} />
          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase" style={{ backgroundColor: 'var(--bg-alt)', color: 'var(--text-2)' }}>{submission.language}</span>
          <StatusBadge label={saga.label} variant={saga.variant} />
          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ backgroundColor: 'var(--success-soft)', color: 'var(--success)' }}>{totalScore}점</span>
          {(problem.tags ?? []).map((tag) => (
            <span key={tag} className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium" style={{ backgroundColor: 'var(--bg-alt)', color: 'var(--text-3)' }}>{tag}</span>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[12px] text-text-3">{new Date(submission.createdAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
          {problem.sourceUrl && (
            <a href={problem.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline">
              문제 보기<ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>

      {/* 2-Column Layout */}
      <div className="flex flex-col lg:flex-row gap-4 items-stretch" style={vfade(0.1)}>
        {/* 코드 뷰어 */}
        <div className="w-full lg:w-1/2 min-w-0 flex flex-col">
          <Card className="p-0 overflow-hidden flex-1 flex flex-col">
            <div className="flex items-center justify-between px-5 h-12 shrink-0 border-b" style={{ borderColor: 'var(--border)' }}>
              <span className="text-[13px] font-semibold text-text flex items-center gap-1.5">
                <span style={{ color: 'var(--primary)' }}>&lt;/&gt;</span>{submission.language}
              </span>
              <button onClick={() => void handleCopy(submission.code ?? '')} className="flex items-center gap-1.5 px-2.5 py-1 rounded-badge text-[11px] font-medium transition-colors hover:bg-bg-alt" style={{ color: 'var(--text-3)' }}>
                {copied ? <Check className="h-3 w-3" style={{ color: 'var(--success)' }} /> : <Copy className="h-3 w-3" />}
                {copied ? '복사됨' : '복사'}
              </button>
            </div>
            <div className="overflow-auto">
              <CodeBlock code={submission.code ?? '// 코드를 불러올 수 없습니다'} language={langKey} />
            </div>
          </Card>
        </div>

        {/* AI 분석 결과 */}
        <div className="w-full lg:w-1/2 flex flex-col">
          <Card className="p-0 overflow-hidden flex-1 flex flex-col">
            <div className="flex items-center justify-between px-5 h-12 shrink-0 border-b" style={{ borderColor: 'var(--border)' }}>
              <span className="flex items-center gap-2 text-[13px] font-semibold text-text">
                <Brain className="h-4 w-4" style={{ color: 'var(--primary)' }} />AI 분석 결과
              </span>
            </div>
            <div className="px-3 py-4 sm:px-5 sm:py-5 space-y-5">
              <div className="flex justify-center">
                <ScoreGauge score={totalScore} size={160} label="/ 100" />
              </div>

              {categories.length > 0 && (
                <div className="space-y-1">
                  <p className="flex items-center gap-1.5 text-[13px] font-medium text-text pb-1" style={{ borderBottom: '1px solid var(--border)' }}>
                    <BarChart3 className="h-3.5 w-3.5" style={{ color: 'var(--primary)' }} />항목별 평가
                  </p>
                  {categories.map((cat) => {
                    const color = barColor(cat.score);
                    const label = CATEGORY_LABELS[cat.name] ?? cat.name;
                    return (
                      <div key={cat.name} className="py-2.5">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[13px] font-semibold text-text">{label}</span>
                          <span className="text-[13px] font-bold" style={{ color }}>{cat.score}</span>
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border)' }}>
                          <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: analysisBarsAnimated ? `${cat.score}%` : '0%', backgroundColor: color }} />
                        </div>
                        <p className="mt-1.5 text-[11px] leading-relaxed text-text-3">{cat.comment}</p>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* AI 개선 코드 */}
              {analysis.optimizedCode && (
                <div style={{ borderTop: '1px solid var(--border)' }}>
                  <button type="button" onClick={() => setShowOptimized(!showOptimized)} className="flex items-center justify-between w-full px-0 py-2.5 text-[13px] font-medium text-text transition-colors hover:text-primary">
                    <span className="flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" style={{ color: 'var(--primary)' }} />AI 개선 코드</span>
                    <ChevronDown className="h-4 w-4 text-text-3 transition-transform" style={{ transform: showOptimized ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                  </button>
                  {showOptimized && (
                    <div className="rounded-card overflow-hidden mb-1" style={{ border: '1px solid var(--border)' }}>
                      <CodeBlock code={analysis.optimizedCode} language={langKey} />
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
