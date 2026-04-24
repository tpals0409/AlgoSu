/**
 * @file 스터디룸 — 주차별 문제 타임라인 + 제출 현황 + 분석 뷰 (i18n 적용)
 * @domain study
 * @layer page
 * @related AppLayout, StudyContext, problemApi, submissionApi, StatCard, WeekSection, SubmissionView, AnalysisView, messages/studies.json
 */

'use client';

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type ReactElement,
  type CSSProperties,
} from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  BookOpen,
  Users,
  Sparkles,
  Code2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
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
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton';
import { getAvatarPresetKey, getAvatarSrc } from '@/lib/avatars';
import Image from 'next/image';

import { groupProblemsByWeek } from './utils';
import { StatCard } from './StatCard';
import { WeekSection } from './WeekSection';
import { SubmissionView } from './SubmissionView';
import { AnalysisView } from './AnalysisView';

// ─── COMPONENT ────────────────────────────

export default function StudyRoomPage(): ReactElement {
  const t = useTranslations('studies');
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { currentStudyId, setCurrentStudy, studies: contextStudies } = useStudy();
  const currentStudyData = currentStudyId
    ? contextStudies.find((s) => s.id === currentStudyId)
    : null;

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
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [notSubmitted, setNotSubmitted] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [nicknameMap, setNicknameMap] = useState<Record<string, string>>({});
  const [avatarMap, setAvatarMap] = useState<Record<string, string | null>>({});
  const [members, setMembers] = useState<StudyMember[]>([]);
  const [studyStats, setStudyStats] = useState<StudyStats | null>(null);

  // mount animation
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const tm = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(tm);
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
        if (!cancelled) setError(t('room.error.loadProblemsFailed'));
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
  }, [isAuthenticated, authLoading, currentStudyId, t]);

  const loadSubmissions = useCallback(async (problem: Problem, signal?: AbortSignal): Promise<void> => {
    setLoadingSubmissions(true);
    setNotSubmitted(false);
    setAccessDenied(false);
    setSubmissionError(null);
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
        setSubmissionError(t('room.error.loadSubmissionsFailed'));
        setSubmissions([]);
      }
    } finally {
      if (!signal?.aborted) setLoadingSubmissions(false);
    }
  }, [t]);

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
          error={submissionError}
          totalMembers={totalMembers}
          submittedCount={submittedCount}
          analyzedCount={analyzedCount}
          onBack={handleBack}
          onSelectSubmission={handleSelectSubmission}
          onRetry={() => void loadSubmissions(selectedProblem)}
        />
      </AppLayout>
    );
  }

  // 1단계: 메인 뷰 — 스터디룸
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3" style={fade(0)}>
          {currentStudyData?.avatar_url && (
            <Image
              src={getAvatarSrc(getAvatarPresetKey(currentStudyData.avatar_url))}
              alt={currentStudyData.name ?? ''}
              width={40}
              height={40}
              className="h-10 w-10 shrink-0 rounded-xl"
            />
          )}
          <div>
            <h1 className="text-[22px] font-bold tracking-tight text-text">{t('room.heading')}</h1>
            <p className="mt-0.5 text-sm text-text-2">{t('room.description')}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" style={fade(0.06)}>
          <StatCard icon={<BookOpen className="h-5 w-5" />} iconBg="var(--primary-soft)" iconColor="var(--primary)" value={stats.totalProblems} label={t('room.stats.totalProblems')} />
          <StatCard icon={<Users className="h-5 w-5" />} iconBg="var(--info-soft, rgba(59,130,206,0.12))" iconColor="var(--info, #3B82CE)" value={stats.totalSubmissions} label={t('room.stats.totalSubmissions')} />
          <StatCard icon={<Sparkles className="h-5 w-5" />} iconBg="var(--success-soft)" iconColor="var(--success)" value={stats.totalAnalyzed} label={t('room.stats.totalAnalyzed')} />
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-card border border-error bg-error-soft px-4 py-3">
            <AlertCircle className="h-4 w-4 shrink-0 text-error" />
            <span className="flex-1 text-xs text-error">{error}</span>
            <button
              type="button"
              onClick={() => { setError(null); setLoadingProblems(true); problemApi.findAll().then(setProblems).catch(() => setError(t('room.error.loadProblemsFailed'))).finally(() => setLoadingProblems(false)); }}
              className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-error transition-colors hover:bg-error/10"
            >
              <RefreshCw className="h-3 w-3" aria-hidden />
              {t('room.retry')}
            </button>
          </div>
        )}

        <div style={fade(0.12)}>
          {loadingProblems ? (
            <div className="space-y-3"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>
          ) : problems.length === 0 ? (
            <div className="rounded-card border border-border bg-bg-card py-16 text-center shadow-card">
              <Code2 className="mx-auto mb-3 h-8 w-8 text-text-3 opacity-40" />
              <p className="text-sm text-text-3">{t('room.emptyProblems')}</p>
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
