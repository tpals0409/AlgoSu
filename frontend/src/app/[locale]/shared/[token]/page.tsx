/**
 * @file 게스트 스터디룸 — 공유 링크 기반 읽기 전용 뷰 (i18n 적용)
 * @domain share
 * @layer page
 * @related GuestContext.tsx, anonymize.ts, publicApi, messages/sharing.json
 *
 * 보안: 쓰기 UI 일체 숨김, 익명화 적용
 * UI: 스터디룸(study-room) 디자인 시스템 착안
 */
'use client';

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
  type CSSProperties,
} from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import {
  Brain, Users, AlertCircle, ArrowLeft,
  ChevronRight, FileText, CheckCircle2, Sparkles, Copy, Check,
  Clock, Zap, ChevronDown, BarChart3, Sun, Moon,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useTranslations, useLocale } from 'next-intl';
import { cn } from '@/lib/utils';
import { GuestProvider, useGuest } from '@/contexts/GuestContext';
import { publicApi, type Problem, type Submission, type AnalysisResult } from '@/lib/api';
import { parseFeedback } from '@/lib/feedback';
import { getAnonymousName, shouldShowRealName } from '@/lib/anonymize';
import { getAvatarSrc } from '@/lib/avatars';
import { Card } from '@/components/ui/Card';
import { ScoreGauge } from '@/components/ui/ScoreGauge';
import { CodeBlock } from '@/components/ui/CodeBlock';
import {
  DIFF_BADGE_STYLE,
  PROBLEM_STATUS_LABELS,
} from '@/lib/constants';
import { DifficultyBadge } from '@/components/ui/DifficultyBadge';

/* ───────────────── 피드백 파싱 (공통 모듈에서 import) ───────────────── */

function barColor(score: number): string {
  if (score >= 80) return 'var(--success)';
  if (score >= 60) return 'var(--warning)';
  return 'var(--error)';
}

/* ───────────────── 페이지 진입점 ───────────────── */

export default function SharedStudyPage(): ReactNode {
  const params = useParams();
  const token = params?.token as string;
  const t = useTranslations('sharing');

  if (!token) {
    return <ErrorView message={t('error.invalidLink')} />;
  }

  return (
    <GuestProvider token={token}>
      <SharedStudyContent />
    </GuestProvider>
  );
}

/* ───────────────── 메인 콘텐츠 ───────────────── */

function SharedStudyContent(): ReactNode {
  const t = useTranslations('sharing');
  const { studyData, createdByUserId, token, loading, error } = useGuest();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [allSubmissions, setAllSubmissions] = useState<Submission[]>([]);
  const [selectedProblem, setSelectedProblem] = useState<Problem | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [subLoading, setSubLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  /* 문제 + 전체 제출 동시 로드 */
  useEffect(() => {
    if (!token || loading || error) return;
    Promise.all([
      publicApi.getSharedProblems(token).catch(() => [] as Problem[]),
      publicApi.getSharedSubmissions(token).catch(() => [] as Submission[]),
    ]).then(([p, s]) => {
      setProblems(p);
      setAllSubmissions(s);
    });
  }, [token, loading, error]);

  /* 문제별 제출 필터 — 유저당 최신 1건만 (스터디룸 동일 로직) */
  const filteredSubmissions = useMemo(() => {
    if (!selectedProblem) return [];
    const byProblem = allSubmissions.filter((s) => s.problemId === selectedProblem.id);
    // allSubmissions는 createdAt DESC → 첫 등장이 최신 (유저당 1건)
    return byProblem.filter((sub, idx, arr) =>
      arr.findIndex((s) => (s.userId ?? '') === (sub.userId ?? '')) === idx,
    );
  }, [allSubmissions, selectedProblem]);

  /* 주차별 그룹핑 */
  const weekGroups = useMemo(() => {
    const groups = new Map<string, Problem[]>();
    for (const p of problems) {
      const week = p.weekNumber ?? '기타';
      const list = groups.get(week) ?? [];
      list.push(p);
      groups.set(week, list);
    }
    return groups;
  }, [problems]);

  /* 문제별 제출 인원 수 맵 (유저당 1건 — 중복 제거) */
  const submissionCountMap = useMemo(() => {
    const userSets = new Map<string, Set<string>>();
    for (const s of allSubmissions) {
      const uid = s.userId ?? 'unknown';
      if (!userSets.has(s.problemId)) userSets.set(s.problemId, new Set());
      userSets.get(s.problemId)!.add(uid);
    }
    const map = new Map<string, number>();
    for (const [pid, users] of userSets) {
      map.set(pid, users.size);
    }
    return map;
  }, [allSubmissions]);

  /* 전체 고유 제출 수 (problemId+userId 기준 dedup) */
  const uniqueSubmissionCount = useMemo(() => {
    const seen = new Set<string>();
    for (const s of allSubmissions) {
      seen.add(`${s.problemId}:${s.userId ?? 'unknown'}`);
    }
    return seen.size;
  }, [allSubmissions]);

  const handleSelectProblem = useCallback((problem: Problem) => {
    setSelectedProblem(problem);
    setSelectedSubmission(null);
    setAnalysis(null);
    setSubLoading(false);
  }, []);

  const handleSelectSubmission = useCallback((sub: Submission) => {
    setSelectedSubmission(sub);
    setAnalysis(null);
    setSubLoading(true);
    publicApi.getSharedAnalysis(token, sub.id)
      .then(setAnalysis)
      .catch(() => setAnalysis(null))
      .finally(() => setSubLoading(false));
  }, [token]);

  const handleBack = useCallback(() => {
    if (selectedSubmission) {
      setSelectedSubmission(null);
      setAnalysis(null);
    } else if (selectedProblem) {
      setSelectedProblem(null);
    }
  }, [selectedProblem, selectedSubmission]);

  /** 스터디룸 스타일 fade-in 애니메이션 */
  const fade = (delay = 0): CSSProperties => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'translateY(0)' : 'translateY(16px)',
    transition: `opacity .5s cubic-bezier(.16,1,.3,1) ${delay}s, transform .5s cubic-bezier(.16,1,.3,1) ${delay}s`,
  });

  if (loading) return <GuestShell><LoadingView /></GuestShell>;
  if (error) return <GuestShell><ErrorView message={error} /></GuestShell>;
  if (!studyData) return <GuestShell><ErrorView message={t('error.loadFailed')} /></GuestShell>;

  /* ── 3단계 뷰: 분석 → 제출 → 문제 목록 ── */

  if (selectedProblem && selectedSubmission) {
    return (
      <GuestShell>
        <AnalysisView
          submission={selectedSubmission}
          analysis={analysis}
          loading={subLoading}
          onBack={handleBack}
          createdByUserId={createdByUserId}
          token={token}
          members={studyData.members}
        />
      </GuestShell>
    );
  }

  if (selectedProblem) {
    return (
      <GuestShell>
        <SubmissionListView
          problem={selectedProblem}
          submissions={filteredSubmissions}
          onSelect={handleSelectSubmission}
          onBack={handleBack}
          createdByUserId={createdByUserId}
          token={token}
          members={studyData.members}
          memberCount={studyData.memberCount}
        />
      </GuestShell>
    );
  }

  /* ── 메인 뷰: 스터디 헤더 + 스탯 + 주차별 문제 ── */
  return (
    <GuestShell>
      <div className="space-y-6">
        {/* 스터디 헤더 — fade: 동적 애니메이션, Tailwind 전환 불가 */}
        <div style={fade(0)}>
          <h1 className="text-[22px] font-bold tracking-tight text-[var(--text)]">
            {studyData.studyName}
          </h1>
          <p className="mt-0.5 text-sm text-[var(--text-2)]">
            {t('header.sharedDescription')}
          </p>
        </div>

        {/* 스탯 카드 — fade: 동적 애니메이션, Tailwind 전환 불가 */}
        <div className="grid grid-cols-3 gap-3" style={fade(0.1)}>
          <SharedStatCard icon={<Users size={18} />} value={studyData.memberCount} label={t('stats.members')} bg="var(--primary-soft)" fg="var(--primary)" />
          <SharedStatCard icon={<FileText size={18} />} value={problems.length} label={t('stats.problems')} bg="var(--info-soft)" fg="var(--info)" />
          <SharedStatCard icon={<CheckCircle2 size={18} />} value={uniqueSubmissionCount} label={t('stats.submissions')} bg="var(--success-soft)" fg="var(--success)" />
        </div>

        {/* 주차별 문제 목록 */}
        {problems.length === 0 ? (
          <Card className="p-8 text-center text-[var(--text-3)]">
            {t('problemList.empty')}
          </Card>
        ) : (
          Array.from(weekGroups.entries()).map(([week, weekProblems], wi) => (
            // fade: 동적 애니메이션, Tailwind 전환 불가
            <div key={week} className="space-y-3" style={fade(0.15 + wi * 0.05)}>
              {/* 주차 뱃지 */}
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold bg-[var(--primary-soft)] text-[var(--primary)]"
                >
                  {week}
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
                </span>
              </div>

              {/* 문제 카드들 */}
              {weekProblems.map((p) => {
                const tier = (p.difficulty?.toLowerCase() ?? 'bronze') as string;
                const stripeColor = p.difficulty ? (DIFF_BADGE_STYLE[tier]?.color ?? 'var(--text-3)') : 'var(--text-3)';
                const subCount = submissionCountMap.get(p.id) ?? 0;
                const pct = studyData.memberCount > 0 ? Math.min(100, Math.round((subCount / studyData.memberCount) * 100)) : 0;

                return (
                  <button
                    key={p.id}
                    type="button"
                    className="flex w-full items-stretch overflow-hidden rounded-card border border-[var(--border)] bg-[var(--bg-card)] text-left transition-all hover:-translate-y-0.5 hover:shadow-sm"
                    onClick={() => handleSelectProblem(p)}
                  >
                    {/* 좌측 난이도 색상 스트라이프 */}
                    <div className="w-1 shrink-0" style={{ backgroundColor: stripeColor }} />

                    <div className="flex flex-1 items-center gap-3 p-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          {/* 난이도 뱃지 (플랫폼 인지) */}
                          <DifficultyBadge
                            difficulty={p.difficulty ?? null}
                            level={p.level}
                            sourcePlatform={p.sourcePlatform}
                          />
                          {/* 상태 뱃지 */}
                          {p.status && (
                            <span
                              className={cn(
                                'rounded-full px-2 py-0.5 text-[11px] font-medium',
                                p.status === 'ACTIVE'
                                  ? 'text-[var(--success)] bg-[var(--success-soft)]'
                                  : 'text-[var(--text-3)] bg-[var(--bg-alt)]',
                              )}
                            >
                              {PROBLEM_STATUS_LABELS[p.status as keyof typeof PROBLEM_STATUS_LABELS] ?? p.status}
                            </span>
                          )}
                        </div>

                        {/* 문제 제목 */}
                        <p className="mt-1.5 text-[15px] font-bold text-[var(--text)]">
                          {p.title}
                        </p>

                        {/* 진행 바 + 제출 수 */}
                        <div className="mt-2 flex items-center gap-2">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--bg-alt)]">
                            {/* width/backgroundColor: 동적 애니메이션, Tailwind 전환 불가 */}
                            <div
                              className="h-full rounded-full transition-all duration-700 ease-out"
                              style={{ width: mounted ? `${pct}%` : '0%', backgroundColor: stripeColor }}
                            />
                          </div>
                          <span className="shrink-0 text-[11px] font-medium text-[var(--text-3)]">
                            {t('problemList.submittedCount', { count: subCount })}
                          </span>
                        </div>
                      </div>

                      <ChevronRight size={16} className="text-[var(--text-3)]" />
                    </div>
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>
    </GuestShell>
  );
}

/* ───────────────── 제출 목록 뷰 ───────────────── */

function SubmissionListView({ problem, submissions, onSelect, onBack, createdByUserId, token, members, memberCount }: {
  readonly problem: Problem;
  readonly submissions: Submission[];
  readonly onSelect: (s: Submission) => void;
  readonly onBack: () => void;
  readonly createdByUserId: string | null;
  readonly token: string;
  readonly members: Array<{ userId: string; nickname: string; role: string }>;
  readonly memberCount: number;
}): ReactNode {
  const t = useTranslations('sharing');
  const locale = useLocale();

  /* 고유 유저 수 */
  const uniqueSubmitters = new Set(submissions.map((s) => s.userId)).size;
  const analyzedCount = submissions.filter((s) => s.aiScore != null).length;

  return (
    <div className="space-y-5">
      {/* 뒤로 가기 */}
      <button
        type="button"
        onClick={onBack}
        className="flex h-9 w-9 items-center justify-center rounded-full transition-colors text-[var(--text-3)]"
      >
        <ArrowLeft size={20} />
      </button>

      {/* 문제 헤더 */}
      <div>
        <div className="flex items-center gap-2">
          <DifficultyBadge
            difficulty={problem.difficulty ?? null}
            level={problem.level}
            sourcePlatform={problem.sourcePlatform}
          />
          {problem.weekNumber && (
            <span className="text-[11px] font-medium text-[var(--text-3)]">
              {problem.weekNumber}
            </span>
          )}
        </div>
        <h2 className="mt-1 text-lg font-bold text-[var(--text)]">{problem.title}</h2>
      </div>

      {/* 스탯 */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <Card className="p-3">
          <div className="flex items-center justify-center gap-1.5">
            <Users className="h-4 w-4 text-[var(--text-3)]" />
            <span className="text-lg font-bold text-[var(--text)]">{memberCount}</span>
          </div>
          <p className="text-[11px] text-[var(--text-3)]">{t('submissionList.totalMembers')}</p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center justify-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-[var(--success)]" />
            <span className="text-lg font-bold text-[var(--text)]">{uniqueSubmitters}</span>
          </div>
          <p className="text-[11px] text-[var(--text-3)]">{t('submissionList.submitted')}</p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center justify-center gap-1.5">
            <Brain className="h-4 w-4 text-[var(--primary)]" />
            <span className="text-lg font-bold text-[var(--text)]">{analyzedCount}</span>
          </div>
          <p className="text-[11px] text-[var(--text-3)]">{t('submissionList.analyzed')}</p>
        </Card>
      </div>

      {/* 제출 카드 그리드 */}
      {submissions.length === 0 ? (
        <Card className="p-8 text-center text-[var(--text-3)]">
          {t('submissionList.empty')}
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {submissions.map((sub) => {
            const memberName = getMemberDisplayName(sub.userId, createdByUserId, token, members, t);
            const isOwner = !!(sub.userId && createdByUserId && shouldShowRealName(sub.userId, createdByUserId));
            return (
              <Card
                key={sub.id}
                className={cn(
                  'cursor-pointer p-4 transition-all hover:-translate-y-0.5 hover:shadow-sm',
                  isOwner && 'border-[var(--primary)]',
                )}
                /* animation: 동적 값, Tailwind 전환 불가 */
                style={isOwner ? { animation: 'glow-pulse 3s ease-in-out infinite' } : undefined}
                onClick={() => onSelect(sub)}
              >
                <div className="flex items-center gap-3">
                  {/* 아바타 */}
                  <img
                    src={getAvatarSrc('default')}
                    alt={t('submissionList.avatarAlt', { name: memberName })}
                    className="h-10 w-10 shrink-0 rounded-full object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold text-[var(--text)]">{memberName}</span>
                      {isOwner && (
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-bold bg-[var(--primary-soft)] text-[var(--primary)]">
                          {t('submissionList.mySubmission')}
                        </span>
                      )}
                      <span className="rounded-full px-2 py-0.5 text-[11px] font-medium uppercase bg-[var(--bg-alt)] text-[var(--text-2)]">
                        {sub.language}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      {sub.aiScore != null && (
                        <span className="flex items-center gap-1 text-[11px] font-medium text-[var(--primary)]">
                          <Sparkles size={12} />
                          {t('submissionList.scoreUnit', { score: sub.aiScore })}
                        </span>
                      )}
                      <span className="text-[11px] text-[var(--text-3)]">
                        {new Date(sub.createdAt).toLocaleDateString(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-[var(--text-3)]" />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ───────────────── 분석 뷰 (기존 분석 페이지 동일) ───────────────── */

function AnalysisView({ submission, analysis, loading: analysisLoading, onBack, createdByUserId, token, members }: {
  readonly submission: Submission;
  readonly analysis: AnalysisResult | null;
  readonly loading: boolean;
  readonly onBack: () => void;
  readonly createdByUserId: string | null;
  readonly token: string;
  readonly members: Array<{ userId: string; nickname: string; role: string }>;
}): ReactNode {
  const t = useTranslations('sharing');
  const locale = useLocale();
  const memberName = getMemberDisplayName(submission.userId, createdByUserId, token, members, t);
  const code = submission.code || (analysis as AnalysisResult & { code?: string } | null)?.code;
  const parsed = analysis ? parseFeedback(analysis.feedback, analysis.score, analysis.optimizedCode) : null;
  const [copied, setCopied] = useState(false);
  const [showOptimized, setShowOptimized] = useState(false);
  const [barsAnimated, setBarsAnimated] = useState(false);

  useEffect(() => {
    if (!parsed || parsed.categories.length === 0) return;
    const timer = setTimeout(() => setBarsAnimated(true), 400);
    return () => clearTimeout(timer);
  }, [parsed?.categories.length]);

  const handleCopy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* 복사 실패 무시 */ }
  }, []);

  return (
    <div className="space-y-4">
      {/* ─── HEADER ─────────────────────────── */}
      <div className="space-y-3">
        {/* 뒤로 + 제목 */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex h-9 w-9 items-center justify-center shrink-0 rounded-full transition-colors hover:bg-bg-alt"
          >
            <ArrowLeft className="h-5 w-5 text-[var(--text)]" />
          </button>
          <h1 className="text-lg sm:text-xl font-bold tracking-tight truncate text-[var(--text)]">
            {memberName}
          </h1>
        </div>

        {/* 뱃지 행 */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* 언어 뱃지 */}
          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase bg-[var(--primary-soft)] text-[var(--primary)]">
            {submission.language}
          </span>
          {/* 상태 뱃지 */}
          {analysis?.analysisStatus === 'completed' && (
            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium bg-[var(--success-soft)] text-[var(--success)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" aria-hidden />
              {t('analysis.completed')}
            </span>
          )}
          {/* 점수 뱃지 */}
          {parsed && (
            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-[var(--success-soft)] text-[var(--success)]">
              {t('analysis.scoreUnit', { score: parsed.totalScore })}
            </span>
          )}
        </div>

        {/* 시간 */}
        <span className="text-[11px] sm:text-[12px] text-[var(--text-3)]">
          {new Date(submission.createdAt).toLocaleDateString(locale, { month: 'long', day: 'numeric' })}{' '}
          {new Date(submission.createdAt).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })}
        </span>
      </div>

      {/* ─── LOADING / STATUS ───────────────── */}
      {analysisLoading || !analysis ? (
        <LoadingView />
      ) : analysis.analysisStatus !== 'completed' ? (
        <Card className="p-8 text-center text-[var(--text-3)]">
          {t('analysis.notCompleted', { status: analysis.analysisStatus })}
        </Card>
      ) : parsed && (
        /* ─── COMPLETED: 2-Column Layout ────── */
        <div className="flex flex-col lg:flex-row gap-4 items-stretch">

          {/* ── LEFT: Code Viewer ──────────── */}
          <div className="w-full lg:w-1/2 min-w-0 flex flex-col">
            <Card className="p-0 overflow-hidden flex-1 flex flex-col">
              {/* 코드 헤더 */}
              <div className="flex items-center justify-between px-5 h-12 shrink-0 border-b border-[var(--border)]">
                <span className="text-[13px] font-semibold flex items-center gap-1.5 text-[var(--text)]">
                  <span className="text-[var(--primary)]">&lt;/&gt;</span>
                  {submission.language}
                </span>
                {code && (
                  <button
                    onClick={() => void handleCopy(code)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-badge text-[11px] font-medium transition-colors hover:bg-bg-alt text-[var(--text-3)]"
                  >
                    {copied ? <Check className="h-3 w-3 text-[var(--success)]" /> : <Copy className="h-3 w-3" />}
                    {copied ? t('analysis.copied') : t('analysis.copy')}
                  </button>
                )}
              </div>

              {/* 코드 블록 */}
              <div className="overflow-auto">
                {code ? (
                  <CodeBlock
                    code={code}
                    language={submission.language ?? 'text'}
                  />
                ) : (
                  <div className="p-4 text-xs text-[var(--text-3)] bg-[var(--code-bg)]">
                    {t('analysis.codeUnavailable')}
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* ── RIGHT: AI 분석 결과 사이드바 ── */}
          <div className="w-full lg:w-1/2 flex flex-col">
            <Card className="p-0 overflow-hidden flex-1 flex flex-col">
              {/* 카드 헤더 */}
              <div className="flex items-center justify-between px-5 h-12 shrink-0 border-b border-[var(--border)]">
                <span className="flex items-center gap-2 text-[13px] font-semibold text-[var(--text)]">
                  <Brain className="h-4 w-4 text-[var(--primary)]" aria-hidden />
                  {t('analysis.aiResult')}
                </span>
              </div>

              <div className="px-3 sm:px-5 py-4 sm:py-5 space-y-5">
                {/* 원형 점수 게이지 */}
                <div className="flex justify-center">
                  <ScoreGauge score={parsed.totalScore} size={160} label="/ 100" />
                </div>

                {/* 복잡도 뱃지 */}
                {(parsed.timeComplexity || parsed.spaceComplexity) && (
                  <div className="flex items-center justify-center gap-3">
                    {parsed.timeComplexity && (
                      <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium bg-[var(--info-soft)] text-[var(--info)]">
                        <Clock className="h-3.5 w-3.5" aria-hidden />
                        {t('analysis.timeComplexity', { complexity: parsed.timeComplexity })}
                      </span>
                    )}
                    {parsed.spaceComplexity && (
                      <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium bg-[var(--primary-soft)] text-[var(--primary)]">
                        <Zap className="h-3.5 w-3.5" aria-hidden />
                        {t('analysis.spaceComplexity', { complexity: parsed.spaceComplexity })}
                      </span>
                    )}
                  </div>
                )}

                {/* AI 총평 텍스트 */}
                {parsed.summary && (
                  <div className="rounded-card px-4 py-3 text-[12px] leading-relaxed bg-[var(--primary-soft)] text-[var(--text-2)] border-l-[3px] border-l-[var(--primary)]">
                    {parsed.summary}
                  </div>
                )}

                {/* 항목별 평가 */}
                {parsed.categories.length > 0 && (
                  <div className="space-y-1">
                    <p className="flex items-center gap-1.5 text-[13px] font-medium pb-1 text-[var(--text)] border-b border-b-[var(--border)]">
                      <BarChart3 className="h-3.5 w-3.5 text-[var(--primary)]" aria-hidden />
                      {t('analysis.categoryEvaluation')}
                    </p>
                    {parsed.categories.map((cat) => {
                      const color = barColor(cat.score);
                      const categoryKey = `categories.${cat.name}` as const;
                      const label = t.has(categoryKey) ? t(categoryKey) : cat.name;
                      return (
                        <div key={cat.name} className="py-2.5">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[13px] font-semibold text-[var(--text)]">{label}</span>
                            {/* color: 동적 barColor 값, Tailwind 전환 불가 */}
                            <span className="text-[13px] font-bold" style={{ color }}>{cat.score}</span>
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden bg-[var(--border)]">
                            {/* width/backgroundColor: 동적 애니메이션, Tailwind 전환 불가 */}
                            <div
                              className="h-full rounded-full transition-all duration-700 ease-out"
                              style={{ width: barsAnimated ? `${cat.score}%` : '0%', backgroundColor: color }}
                            />
                          </div>
                          <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--text-3)]">{cat.comment}</p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* AI 개선 코드 아코디언 */}
                {parsed.optimizedCode && (
                  <div className="border-t border-t-[var(--border)]">
                    <button
                      type="button"
                      onClick={() => setShowOptimized(!showOptimized)}
                      className="flex items-center justify-between w-full px-0 py-2.5 text-[13px] font-medium transition-colors hover:text-primary text-[var(--text)]"
                    >
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-[var(--primary)]" aria-hidden />
                        {t('analysis.optimizedCode')}
                      </span>
                      <ChevronDown
                        className={cn('h-4 w-4 transition-transform text-[var(--text-3)]', showOptimized && 'rotate-180')}
                        aria-hidden
                      />
                    </button>
                    {showOptimized && (
                      <div className="rounded-card overflow-hidden mb-1 border border-[var(--border)]">
                        <CodeBlock
                          code={parsed.optimizedCode}
                          language={submission.language ?? 'text'}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────────────── 공통 컴포넌트 ───────────────── */

function SharedStatCard({ icon, value, label, bg, fg }: {
  readonly icon: ReactNode;
  readonly value: number;
  readonly label: string;
  readonly bg: string;
  readonly fg: string;
}): ReactNode {
  return (
    <Card className="flex items-center gap-3 px-4 py-4">
      {/* bg/fg: props 동적 값, Tailwind 전환 불가 */}
      <div
        className="flex h-10 w-10 items-center justify-center rounded-xl"
        style={{ backgroundColor: bg, color: fg }}
      >
        {icon}
      </div>
      <div>
        <p className="text-xl font-bold text-[var(--text)]">{value}</p>
        <p className="text-[11px] text-[var(--text-3)]">{label}</p>
      </div>
    </Card>
  );
}

function GuestShell({ children }: { readonly children: ReactNode }): ReactNode {
  const t = useTranslations('sharing');
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <header className="border-b border-[var(--border)] bg-[var(--bg-card)] px-4 py-3">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-2">
            <Image src="/avatars/default.svg" alt="AlgoSu" width={28} height={28} />
            <span className="text-sm font-semibold text-[var(--text)]">AlgoSu</span>
            <span className="rounded-badge px-2 py-0.5 text-[10px] font-medium bg-[var(--bg-alt)] text-[var(--text-3)]">
              {t('header.guestBadge')}
            </span>
          </div>
          <button
            type="button"
            aria-label={t('header.themeToggle')}
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className="flex items-center justify-center rounded-btn p-2 transition-all duration-150 hover:bg-bg-alt text-[var(--text-3)]"
          >
            {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">
        {children}
      </main>
    </div>
  );
}

function LoadingView(): ReactNode {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent text-[var(--primary)]" />
    </div>
  );
}

function ErrorView({ message }: { readonly message: string }): ReactNode {
  return (
    <div className="flex flex-col items-center gap-3 py-12">
      <AlertCircle size={32} className="text-[var(--error)]" />
      <p className="text-sm text-[var(--text-3)]">{message}</p>
    </div>
  );
}

function getMemberDisplayName(
  userId: string | undefined,
  createdByUserId: string | null,
  token: string,
  members: Array<{ userId: string; nickname: string }>,
  t: ReturnType<typeof useTranslations<'sharing'>>,
): string {
  if (!userId) return t('memberName.anonymous');
  if (createdByUserId && shouldShowRealName(userId, createdByUserId)) {
    const member = members.find((m) => m.userId === userId);
    return member?.nickname ?? t('memberName.profileOwner');
  }
  return getAnonymousName(userId, token);
}
