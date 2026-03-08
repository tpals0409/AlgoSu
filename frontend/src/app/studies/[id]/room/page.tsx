/**
 * @file 스터디룸 — 주차별 문제 타임라인 + 제출 현황
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
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/contexts/AuthContext';
import { useStudy } from '@/contexts/StudyContext';
import {
  problemApi,
  submissionApi,
  studyApi,
  ApiError,
  type Problem,
  type Submission,
  type StudyStats,
} from '@/lib/api';
import { DiffBadge } from '@/components/ui/DiffBadge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton';
import { StudyNoteEditor } from '@/components/review/StudyNoteEditor';
import { getAvatarPresetKey, getAvatarSrc } from '@/lib/avatars';

// ─── TYPES ────────────────────────────────

type DiffTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'ruby' | 'unrated';

/** 주차별 문제 그룹 (API Problem[]에서 weekNumber 기준으로 변환) */
interface WeekGroup {
  /** 주차 라벨 (예: "3월1주차") */
  label: string;
  /** 해당 주차에 ACTIVE 문제가 하나라도 있으면 true */
  active: boolean;
  /** 해당 주차의 문제 목록 */
  problems: Problem[];
}

// ─── HELPERS ──────────────────────────────

/** Problem.difficulty 문자열을 DiffTier로 변환 */
function toTier(diff: Problem['difficulty']): DiffTier {
  return diff.toLowerCase() as DiffTier;
}

/** Submission.sagaStep을 상태 뱃지 정보로 변환 */
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

/**
 * Problem[] 배열을 weekNumber 기준으로 그룹핑하여 WeekGroup[]로 변환.
 * - weekNumber를 "월+주차" 형식 파싱하여 역순 정렬 (최신 주차가 먼저)
 * - 각 그룹의 active 여부는 ACTIVE 상태 문제 존재 여부로 결정
 */
function groupProblemsByWeek(problems: Problem[]): WeekGroup[] {
  const groupMap = new Map<string, Problem[]>();

  for (const problem of problems) {
    const key = problem.weekNumber || '미분류';
    const group = groupMap.get(key);
    if (group) {
      group.push(problem);
    } else {
      groupMap.set(key, [problem]);
    }
  }

  const groups: WeekGroup[] = [];
  for (const [label, probs] of groupMap) {
    groups.push({
      label,
      active: probs.some((p) => p.status === 'ACTIVE'),
      problems: probs,
    });
  }

  // 주차 라벨 역순 정렬 (최신 주차가 위로)
  groups.sort((a, b) => {
    // "3월2주차" → 월=3, 주=2 형태 파싱
    const parseWeek = (s: string): number => {
      const match = s.match(/(\d+)월(\d+)주차/);
      if (!match) return 0;
      return Number(match[1]) * 10 + Number(match[2]);
    };
    return parseWeek(b.label) - parseWeek(a.label);
  });

  return groups;
}

// ─── COMPONENT ────────────────────────────

export default function StudyRoomPage(): ReactElement {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { currentStudyId, setCurrentStudy } = useStudy();

  // ─── STATE ──────────────────────────────
  const [problems, setProblems] = useState<Problem[]>([]);
  const [selectedProblem, setSelectedProblem] = useState<Problem | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loadingProblems, setLoadingProblems] = useState(true);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notSubmitted, setNotSubmitted] = useState(false);
  const [nicknameMap, setNicknameMap] = useState<Record<string, string>>({});
  const [avatarMap, setAvatarMap] = useState<Record<string, string | null>>({});
  const [studyStats, setStudyStats] = useState<StudyStats | null>(null);

  // mount animation
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  // progress bar animation
  const [barsAnimated, setBarsAnimated] = useState(false);

  const fade = (delay = 0): CSSProperties => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'translateY(0)' : 'translateY(16px)',
    transition: `opacity .5s cubic-bezier(.16,1,.3,1) ${delay}s, transform .5s cubic-bezier(.16,1,.3,1) ${delay}s`,
  });

  const studyId = params.id;

  /** API Problem[]을 주차별 그룹으로 변환 (메모이제이션) */
  const weekGroups = useMemo(() => groupProblemsByWeek(problems), [problems]);

  /** 문제별 제출 수 맵 (problemId → 제출 수) — byWeek 등에서 직접 추출 불가하므로 solvedProblemIds 활용 */
  const solvedProblemSet = useMemo(
    () => new Set(studyStats?.solvedProblemIds ?? []),
    [studyStats],
  );

  // 스터디 ID 동기화
  useEffect(() => {
    if (studyId && studyId !== currentStudyId) {
      setCurrentStudy(studyId);
    }
  }, [studyId, currentStudyId, setCurrentStudy]);

  // ─── EFFECTS ────────────────────────────

  useEffect(() => {
    if (!isAuthenticated || authLoading || !currentStudyId) return;
    let cancelled = false;
    setLoadingProblems(true);
    setError(null);

    problemApi.findAll()
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
      studyApi.getMembers(currentStudyId).then((members) => {
        if (cancelled) return;
        const nMap: Record<string, string> = {};
        const aMap: Record<string, string | null> = {};
        for (const m of members) {
          if (m.nickname) nMap[m.user_id] = m.nickname;
          else if (m.username) nMap[m.user_id] = m.username;
          aMap[m.user_id] = m.avatar_url ?? null;
        }
        setNicknameMap(nMap);
        setAvatarMap(aMap);
      }).catch(() => {});

      // 스터디 통계 로드 (총 제출, 분석 완료 등)
      studyApi.getStats(currentStudyId).then((data) => {
        if (!cancelled) setStudyStats(data);
      }).catch(() => {});
    }

    return () => { cancelled = true; };
  }, [isAuthenticated, authLoading, currentStudyId]);

  const loadSubmissions = useCallback(async (problem: Problem): Promise<void> => {
    setLoadingSubmissions(true);
    setNotSubmitted(false);
    try {
      const data = await submissionApi.listByProblemForStudy(problem.id);
      const latestByUser = data.filter((sub, idx, arr) =>
        arr.findIndex((s) => s.userId === sub.userId) === idx,
      );
      setSubmissions(latestByUser);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setNotSubmitted(true);
        setSubmissions([]);
      } else {
        setError('제출 목록을 불러오지 못했습니다.');
        setSubmissions([]);
      }
    } finally {
      setLoadingSubmissions(false);
    }
  }, []);

  // ─── HANDLERS ───────────────────────────

  const handleSelectProblem = (problem: Problem): void => {
    setSelectedProblem(problem);
    void loadSubmissions(problem);
  };

  const handleBack = (): void => {
    setSelectedProblem(null);
    setSubmissions([]);
    setNotSubmitted(false);
  };

  const handleGoToReview = (submissionId: string): void => {
    router.push(`/reviews/${submissionId}`);
  };

  const stats = useMemo(() => {
    const totalProblems = problems.length;
    const totalSubmissions = studyStats?.totalSubmissions ?? 0;
    const totalAnalyzed = studyStats?.recentSubmissions
      ? studyStats.recentSubmissions.filter((s) => s.sagaStep === 'DONE').length
      : 0;
    return { totalProblems, totalSubmissions, totalAnalyzed };
  }, [problems.length, studyStats]);

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

  // 제출 목록 뷰 (문제 선택 시)
  if (selectedProblem) {
    return (
      <AppLayout>
        <SubmissionListView
          problem={selectedProblem}
          submissions={submissions}
          loading={loadingSubmissions}
          notSubmitted={notSubmitted}
          nicknameMap={nicknameMap}
          avatarMap={avatarMap}
          error={error}
          onBack={handleBack}
          onGoToReview={handleGoToReview}
        />
      </AppLayout>
    );
  }

  // ─── 메인 뷰: 스터디룸 ─────────────────

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* ── 헤더 ── */}
        <div style={fade(0)}>
          <h1 className="text-[22px] font-bold tracking-tight text-text">
            스터디룸
          </h1>
          <p className="mt-0.5 text-sm text-text-2">
            문제를 선택해 멤버별 제출 코드를 확인하세요.
          </p>
        </div>

        {/* ── 통계 카드 ── */}
        <div className="grid grid-cols-3 gap-3" style={fade(0.06)}>
          <StatCard
            icon={<BookOpen className="h-5 w-5" />}
            iconBg="var(--primary-soft)"
            iconColor="var(--primary)"
            value={stats.totalProblems}
            label="전체 문제"
          />
          <StatCard
            icon={<Users className="h-5 w-5" />}
            iconBg="var(--info-soft, rgba(59,130,206,0.12))"
            iconColor="var(--info, #3B82CE)"
            value={stats.totalSubmissions}
            label="총 제출"
          />
          <StatCard
            icon={<Sparkles className="h-5 w-5" />}
            iconBg="var(--success-soft)"
            iconColor="var(--success)"
            value={stats.totalAnalyzed}
            label="분석 완료"
          />
        </div>

        {/* ── 에러 ── */}
        {error && (
          <div className="flex items-center gap-2 rounded-card border border-error bg-error-soft px-4 py-3">
            <AlertCircle className="h-4 w-4 text-error" />
            <span className="text-xs text-error">{error}</span>
          </div>
        )}

        {/* ── 주차별 타임라인 ── */}
        <div style={fade(0.12)}>
          {loadingProblems ? (
            <div className="space-y-3">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
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
                  solvedProblemSet={solvedProblemSet}
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

function StatCard({
  icon,
  iconBg,
  iconColor,
  value,
  label,
}: {
  readonly icon: ReactNode;
  readonly iconBg: string;
  readonly iconColor: string;
  readonly value: number;
  readonly label: string;
}): ReactNode {
  return (
    <Card className="flex items-center gap-3 px-4 py-4">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{ backgroundColor: iconBg, color: iconColor }}
      >
        {icon}
      </div>
      <div>
        <p className="text-xl font-bold text-text">{value}</p>
        <p className="text-[11px] text-text-3">{label}</p>
      </div>
    </Card>
  );
}

// ─── WEEK SECTION ────────────────────────

/** 주차별 문제 그룹 섹션 */
function WeekSection({
  week,
  barsAnimated,
  solvedProblemSet,
  onSelect,
}: {
  readonly week: WeekGroup;
  readonly barsAnimated: boolean;
  readonly solvedProblemSet: Set<string>;
  readonly onSelect: (p: Problem) => void;
}): ReactNode {
  const totalProblems = week.problems.length;

  return (
    <div>
      {/* 주차 헤더 */}
      <div className="mb-3 flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold"
            style={{
              backgroundColor: week.active ? 'var(--primary-soft)' : 'var(--bg-alt)',
              color: week.active ? 'var(--primary)' : 'var(--text-3)',
            }}
          >
            {week.label}
            {week.active && (
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: 'var(--success)' }}
              />
            )}
          </span>
        </div>
        <div
          className="h-px flex-1"
          style={{ backgroundColor: 'var(--border)' }}
        />
        <span className="text-[11px] text-text-3">{totalProblems}문제</span>
      </div>

      {/* 문제 카드 */}
      <div className="space-y-3">
        {week.problems.map((p) => (
          <ProblemTimelineCard
            key={p.id}
            problem={p}
            barsAnimated={barsAnimated}
            isSolved={solvedProblemSet.has(p.id)}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

// ─── PROBLEM TIMELINE CARD ───────────────

/** 주차 내 개별 문제 카드 (API Problem 기반) */
function ProblemTimelineCard({
  problem,
  barsAnimated,
  isSolved,
  onSelect,
}: {
  readonly problem: Problem;
  readonly barsAnimated: boolean;
  readonly isSolved: boolean;
  readonly onSelect: (p: Problem) => void;
}): ReactNode {
  const tier = toTier(problem.difficulty);
  const isActive = problem.status === 'ACTIVE';
  const tags = problem.tags ?? [];

  // solvedProblemIds에 포함되면 최소 1명 제출 완료 — 정확한 인원 수는 개별 API 없이 알 수 없으므로
  // "제출됨" 여부만 표시 (isSolved면 100%, 아니면 0%)
  const progressPct = isSolved ? 100 : 0;
  const progressLabel = isSolved ? '제출 있음' : '미제출';

  return (
    <Card
      className="overflow-hidden p-0 cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-hover"
      onClick={() => onSelect(problem)}
    >
      <div className="flex">
        {/* 좌측 컬러 보더 */}
        <div
          className="w-1 shrink-0"
          style={{ backgroundColor: `var(--diff-${tier}-color)` }}
        />

        <div className="flex-1 px-5 py-4">
          {/* 뱃지 행 */}
          <div className="flex items-center gap-2 mb-2">
            <DiffBadge tier={tier} level={problem.level} />
            {isActive ? (
              <span
                className="inline-flex items-center gap-1 rounded-badge px-2 py-0.5 text-[11px] font-medium"
                style={{ color: 'var(--success)', backgroundColor: 'var(--success-soft)' }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: 'var(--success)' }} />
                진행 중
              </span>
            ) : (
              <span
                className="inline-flex items-center rounded-badge px-2 py-0.5 text-[11px] font-medium"
                style={{ color: 'var(--text-3)', backgroundColor: 'var(--bg-alt)' }}
              >
                종료
              </span>
            )}
          </div>

          {/* 제목 */}
          <h3 className="text-[15px] font-bold text-text mb-1.5">
            {problem.title}
          </h3>

          {/* 태그 */}
          {tags.length > 0 && (
            <div className="flex items-center gap-1.5 mb-3">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-badge px-2 py-0.5 text-[11px]"
                  style={{ backgroundColor: 'var(--bg-alt)', color: 'var(--text-3)' }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* 진행 바 — solvedProblemIds 기준으로 제출 여부 표시 */}
          <div className="flex items-center gap-2">
            <div
              className="h-2 flex-1 overflow-hidden rounded-full"
              style={{ backgroundColor: 'var(--bg-alt)' }}
            >
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: barsAnimated ? `${progressPct}%` : '0%',
                  backgroundColor: `var(--diff-${tier}-color)`,
                }}
              />
            </div>
            <span className="shrink-0 text-[10px] text-text-3">
              {progressLabel}
            </span>
          </div>
        </div>

        {/* 우측 화살표 */}
        <div className="flex items-center pr-4">
          <ChevronRight className="h-4 w-4 text-text-3" />
        </div>
      </div>
    </Card>
  );
}

// ─── SUBMISSION LIST VIEW ────────────────

function SubmissionListView({
  problem,
  submissions,
  loading,
  notSubmitted,
  nicknameMap,
  avatarMap,
  error,
  onBack,
  onGoToReview,
}: {
  readonly problem: Problem;
  readonly submissions: Submission[];
  readonly loading: boolean;
  readonly notSubmitted: boolean;
  readonly nicknameMap: Record<string, string>;
  readonly avatarMap: Record<string, string | null>;
  readonly error: string | null;
  readonly onBack: () => void;
  readonly onGoToReview: (id: string) => void;
}): ReactNode {
  return (
    <div className="mx-auto max-w-3xl py-4 animate-fade-in">
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-card border border-error bg-error-soft px-4 py-3">
          <AlertCircle className="h-4 w-4 text-error" />
          <span className="text-xs text-error">{error}</span>
        </div>
      )}

      <button
        type="button"
        onClick={onBack}
        className="mb-3 flex items-center gap-1 text-xs text-text-3 transition-colors hover:text-text"
      >
        <ChevronRight className="h-3.5 w-3.5 rotate-180" />
        문제 목록
      </button>

      <div className="mb-6 text-center">
        <h1 className="text-[22px] font-bold tracking-tight text-text">
          {problem.title}
        </h1>
        <div className="mt-2 flex items-center justify-center gap-2">
          <DiffBadge tier={toTier(problem.difficulty)} level={problem.level} />
          <StatusBadge label={problem.weekNumber} variant="info" />
        </div>
      </div>

      <div className="mb-5 overflow-hidden rounded-card border border-border bg-bg-card shadow-card">
        <div className="flex items-center gap-2 border-b border-border px-5 py-3">
          <Users className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-text">제출 목록</span>
          <span className="rounded-badge bg-primary-soft px-2 py-0.5 text-[10px] font-medium text-primary">
            {submissions.length}건
          </span>
        </div>

        {loading ? (
          <div className="space-y-3 p-5">
            <Skeleton height={48} />
            <Skeleton height={48} />
            <Skeleton height={48} />
          </div>
        ) : notSubmitted ? (
          <div className="py-10 text-center">
            <Code2 className="mx-auto mb-2 h-6 w-6 text-primary opacity-60" />
            <p className="text-sm font-medium text-text">문제를 먼저 제출해주세요</p>
            <p className="mt-1 text-xs text-text-3">제출 후 다른 스터디원의 풀이를 볼 수 있습니다</p>
          </div>
        ) : submissions.length === 0 ? (
          <div className="py-10 text-center">
            <Code2 className="mx-auto mb-2 h-6 w-6 text-text-3 opacity-40" />
            <p className="text-xs text-text-3">아직 제출이 없습니다</p>
          </div>
        ) : (
          submissions.map((sub, idx) => {
            const saga = getSagaStatus(sub.sagaStep);
            return (
              <div
                key={sub.id}
                role="button"
                tabIndex={0}
                onClick={() => onGoToReview(sub.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onGoToReview(sub.id);
                }}
                className={cn(
                  'flex cursor-pointer items-center justify-between px-5 py-3.5 transition-colors hover:bg-primary-soft',
                  idx < submissions.length - 1 && 'border-b border-border',
                )}
              >
                <div className="flex items-center gap-3">
                  <img
                    src={sub.userId && avatarMap[sub.userId]
                      ? getAvatarSrc(getAvatarPresetKey(avatarMap[sub.userId]))
                      : getAvatarSrc('default')}
                    alt=""
                    className="h-8 w-8 rounded-full object-cover"
                  />
                  <div>
                    <div className="text-[13px] font-medium text-text">
                      {(sub.userId && nicknameMap[sub.userId]) ? nicknameMap[sub.userId] : '익명'}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1 text-[11px] text-text-3">
                      <span
                    className="rounded-full px-2 py-0.5 text-[11px] font-medium uppercase"
                    style={{ backgroundColor: 'var(--bg-alt)', color: 'var(--text-2)' }}
                  >
                    {sub.language}
                  </span>
                      <span className="opacity-30">|</span>
                      {new Date(sub.createdAt).toLocaleDateString('ko-KR', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge label={saga.label} variant={saga.variant} />
                  <ChevronRight className="h-3.5 w-3.5 text-text-3" />
                </div>
              </div>
            );
          })
        )}
      </div>

      <StudyNoteEditor problemId={problem.id} />
    </div>
  );
}
