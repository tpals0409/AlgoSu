/**
 * @file 게스트 스터디룸 — 공유 링크 기반 읽기 전용 뷰
 * @domain share
 * @layer page
 * @related GuestContext.tsx, anonymize.ts, publicApi
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
import { GuestProvider, useGuest } from '@/contexts/GuestContext';
import { publicApi, type Problem, type Submission, type AnalysisResult } from '@/lib/api';
import { getAnonymousName, shouldShowRealName } from '@/lib/anonymize';
import { getAvatarSrc } from '@/lib/avatars';
import { Card } from '@/components/ui/Card';
import { ScoreGauge } from '@/components/ui/ScoreGauge';
import { CodeBlock } from '@/components/ui/CodeBlock';
import {
  DIFF_BADGE_STYLE,
  DIFFICULTY_LABELS,
  PROBLEM_STATUS_LABELS,
  type Difficulty,
} from '@/lib/constants';

/* ───────────────── 피드백 파싱 (분석 페이지 동일) ───────────────── */

interface ParsedFeedback {
  totalScore: number;
  summary: string;
  categories: FeedbackCategory[];
  optimizedCode: string | null;
  timeComplexity: string | null;
  spaceComplexity: string | null;
}

interface FeedbackCategory {
  name: string;
  score: number;
  comment: string;
  highlights: { startLine: number; endLine: number }[];
}

function extractComplexity(categories: FeedbackCategory[]): { time: string | null; space: string | null } {
  const efficiency = categories.find((c) => c.name === 'efficiency');
  if (!efficiency) return { time: null, space: null };
  const bigOPattern = /O\([^)]+\)/g;
  const matches = efficiency.comment.match(bigOPattern);
  if (matches && matches.length >= 2) return { time: matches[0], space: matches[1] };
  if (matches && matches.length === 1) return { time: matches[0], space: null };
  return { time: null, space: null };
}

function parseFeedback(feedback: string | null, score: number | null, optimizedCode: string | null): ParsedFeedback | null {
  if (!feedback) return null;
  try {
    let cleaned = feedback.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }
    // Claude hallucination 대응: 숫자 뒤 불필요한 따옴표 제거
    cleaned = cleaned.replace(/:\s*(\d+)"(\s*[,}\]])/g, ': $1$2');
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const start = cleaned.indexOf('{');
      if (start === -1) throw new Error('No JSON found');
      let depth = 0, end = -1;
      for (let i = start; i < cleaned.length; i++) {
        if (cleaned[i] === '{') depth++;
        else if (cleaned[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
      }
      if (end === -1) throw new Error('No matching brace');
      parsed = JSON.parse(cleaned.substring(start, end + 1));
    }
    const rawCategories = parsed.categories as Record<string, unknown>[] | undefined;
    const categories: FeedbackCategory[] = (rawCategories ?? []).map((c) => ({
      name: (c.name as string) ?? '',
      score: (c.score as number) ?? 0,
      comment: (c.comment as string) ?? '',
      highlights: (c.highlights as { startLine: number; endLine: number }[]) ?? [],
    }));
    const complexity = extractComplexity(categories);
    const resolvedOptimizedCode = (parsed.optimizedCode as string | null) ?? optimizedCode ?? null;
    return {
      totalScore: (parsed.totalScore as number | null) ?? score ?? 0,
      summary: (parsed.summary as string) ?? '',
      categories,
      optimizedCode: resolvedOptimizedCode,
      timeComplexity: (parsed.timeComplexity as string | null) ?? complexity.time,
      spaceComplexity: (parsed.spaceComplexity as string | null) ?? complexity.space,
    };
  } catch {
    return {
      totalScore: score ?? 0,
      summary: feedback,
      categories: [],
      optimizedCode: optimizedCode ?? null,
      timeComplexity: null,
      spaceComplexity: null,
    };
  }
}

function barColor(score: number): string {
  if (score >= 80) return 'var(--success)';
  if (score >= 60) return 'var(--warning)';
  return 'var(--error)';
}

const CATEGORY_LABELS: Record<string, string> = {
  efficiency: '효율성',
  readability: '가독성',
  correctness: '정확성',
  structure: '코드 구조',
  bestPractice: '모범 사례',
  style: '코드 스타일',
  maintainability: '유지보수성',
};

/* ───────────────── 페이지 진입점 ───────────────── */

export default function SharedStudyPage(): ReactNode {
  const params = useParams();
  const token = params?.token as string;

  if (!token) {
    return <ErrorView message="유효하지 않은 공유 링크입니다." />;
  }

  return (
    <GuestProvider token={token}>
      <SharedStudyContent />
    </GuestProvider>
  );
}

/* ───────────────── 메인 콘텐츠 ───────────────── */

function SharedStudyContent(): ReactNode {
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
  if (!studyData) return <GuestShell><ErrorView message="스터디 정보를 불러올 수 없습니다." /></GuestShell>;

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
        {/* 스터디 헤더 */}
        <div style={fade(0)}>
          <h1 className="text-[22px] font-bold tracking-tight" style={{ color: 'var(--text)' }}>
            {studyData.studyName}
          </h1>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--text-2)' }}>
            공유된 스터디룸입니다. 문제를 선택해 멤버별 풀이를 확인하세요.
          </p>
        </div>

        {/* 스탯 카드 */}
        <div className="grid grid-cols-3 gap-3" style={fade(0.1)}>
          <StatCard icon={<Users size={18} />} value={studyData.memberCount} label="멤버" bg="var(--primary-soft)" fg="var(--primary)" />
          <StatCard icon={<FileText size={18} />} value={problems.length} label="문제" bg="var(--info-soft)" fg="var(--info)" />
          <StatCard icon={<CheckCircle2 size={18} />} value={uniqueSubmissionCount} label="제출" bg="var(--success-soft)" fg="var(--success)" />
        </div>

        {/* 주차별 문제 목록 */}
        {problems.length === 0 ? (
          <Card className="p-8 text-center" style={{ color: 'var(--text-3)' }}>
            등록된 문제가 없습니다.
          </Card>
        ) : (
          Array.from(weekGroups.entries()).map(([week, weekProblems], wi) => (
            <div key={week} className="space-y-3" style={fade(0.15 + wi * 0.05)}>
              {/* 주차 뱃지 */}
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold"
                  style={{ backgroundColor: 'var(--primary-soft)', color: 'var(--primary)' }}
                >
                  {week}
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: 'var(--success)' }} />
                </span>
              </div>

              {/* 문제 카드들 */}
              {weekProblems.map((p) => {
                const tier = (p.difficulty?.toLowerCase() ?? 'bronze') as string;
                const badgeStyle = DIFF_BADGE_STYLE[tier] ?? DIFF_BADGE_STYLE.bronze;
                const subCount = submissionCountMap.get(p.id) ?? 0;
                const pct = studyData.memberCount > 0 ? Math.min(100, Math.round((subCount / studyData.memberCount) * 100)) : 0;

                return (
                  <button
                    key={p.id}
                    type="button"
                    className="flex w-full items-stretch overflow-hidden rounded-card border text-left transition-all hover:-translate-y-0.5 hover:shadow-sm"
                    style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}
                    onClick={() => handleSelectProblem(p)}
                  >
                    {/* 좌측 난이도 색상 스트라이프 */}
                    <div className="w-1 shrink-0" style={{ backgroundColor: badgeStyle.color }} />

                    <div className="flex flex-1 items-center gap-3 p-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          {/* 난이도 뱃지 */}
                          <span
                            className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium"
                            style={badgeStyle}
                          >
                            {DIFFICULTY_LABELS[p.difficulty as Difficulty] ?? p.difficulty}
                          </span>
                          {/* 상태 뱃지 */}
                          {p.status && (
                            <span
                              className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                              style={{
                                color: p.status === 'ACTIVE' ? 'var(--success)' : 'var(--text-3)',
                                backgroundColor: p.status === 'ACTIVE' ? 'var(--success-soft)' : 'var(--bg-alt)',
                              }}
                            >
                              {PROBLEM_STATUS_LABELS[p.status as keyof typeof PROBLEM_STATUS_LABELS] ?? p.status}
                            </span>
                          )}
                        </div>

                        {/* 문제 제목 */}
                        <p className="mt-1.5 text-[15px] font-bold" style={{ color: 'var(--text)' }}>
                          {p.title}
                        </p>

                        {/* 진행 바 + 제출 수 */}
                        <div className="mt-2 flex items-center gap-2">
                          <div className="h-2 flex-1 overflow-hidden rounded-full" style={{ backgroundColor: 'var(--bg-alt)' }}>
                            <div
                              className="h-full rounded-full transition-all duration-700 ease-out"
                              style={{ width: mounted ? `${pct}%` : '0%', backgroundColor: badgeStyle.color }}
                            />
                          </div>
                          <span className="shrink-0 text-[11px] font-medium" style={{ color: 'var(--text-3)' }}>
                            {subCount}명 제출
                          </span>
                        </div>
                      </div>

                      <ChevronRight size={16} style={{ color: 'var(--text-3)' }} />
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
  const tier = (problem.difficulty?.toLowerCase() ?? 'bronze') as string;
  const badgeStyle = DIFF_BADGE_STYLE[tier] ?? DIFF_BADGE_STYLE.bronze;

  /* 고유 유저 수 */
  const uniqueSubmitters = new Set(submissions.map((s) => s.userId)).size;
  const analyzedCount = submissions.filter((s) => s.aiScore != null).length;

  return (
    <div className="space-y-5">
      {/* 뒤로 가기 */}
      <button
        type="button"
        onClick={onBack}
        className="flex h-9 w-9 items-center justify-center rounded-full transition-colors"
        style={{ color: 'var(--text-3)' }}
      >
        <ArrowLeft size={20} />
      </button>

      {/* 문제 헤더 */}
      <div>
        <div className="flex items-center gap-2">
          <span className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={badgeStyle}>
            {DIFFICULTY_LABELS[problem.difficulty as Difficulty] ?? problem.difficulty}
          </span>
          {problem.weekNumber && (
            <span className="text-[11px] font-medium" style={{ color: 'var(--text-3)' }}>
              {problem.weekNumber}
            </span>
          )}
        </div>
        <h2 className="mt-1 text-lg font-bold" style={{ color: 'var(--text)' }}>{problem.title}</h2>
      </div>

      {/* 스탯 */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <Card className="p-3">
          <div className="flex items-center justify-center gap-1.5">
            <Users className="h-4 w-4" style={{ color: 'var(--text-3)' }} />
            <span className="text-lg font-bold" style={{ color: 'var(--text)' }}>{memberCount}</span>
          </div>
          <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>전체 멤버</p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center justify-center gap-1.5">
            <CheckCircle2 className="h-4 w-4" style={{ color: 'var(--success)' }} />
            <span className="text-lg font-bold" style={{ color: 'var(--text)' }}>{uniqueSubmitters}</span>
          </div>
          <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>제출</p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center justify-center gap-1.5">
            <Brain className="h-4 w-4" style={{ color: 'var(--primary)' }} />
            <span className="text-lg font-bold" style={{ color: 'var(--text)' }}>{analyzedCount}</span>
          </div>
          <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>분석 완료</p>
        </Card>
      </div>

      {/* 제출 카드 그리드 */}
      {submissions.length === 0 ? (
        <Card className="p-8 text-center" style={{ color: 'var(--text-3)' }}>
          아직 제출 기록이 없습니다.
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {submissions.map((sub) => {
            const memberName = getMemberDisplayName(sub.userId, createdByUserId, token, members);
            const isOwner = !!(sub.userId && createdByUserId && shouldShowRealName(sub.userId, createdByUserId));
            return (
              <Card
                key={sub.id}
                className="cursor-pointer p-4 transition-all hover:-translate-y-0.5 hover:shadow-sm"
                style={isOwner ? { animation: 'glow-pulse 3s ease-in-out infinite', borderColor: 'var(--primary)' } : undefined}
                onClick={() => onSelect(sub)}
              >
                <div className="flex items-center gap-3">
                  {/* 아바타 */}
                  <img
                    src={getAvatarSrc('default')}
                    alt={`${memberName} 아바타`}
                    className="h-10 w-10 shrink-0 rounded-full object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold" style={{ color: 'var(--text)' }}>{memberName}</span>
                      {isOwner && (
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                          style={{ backgroundColor: 'var(--primary-soft)', color: 'var(--primary)' }}
                        >
                          내 제출
                        </span>
                      )}
                      <span
                        className="rounded-full px-2 py-0.5 text-[11px] font-medium uppercase"
                        style={{ backgroundColor: 'var(--bg-alt)', color: 'var(--text-2)' }}
                      >
                        {sub.language}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      {sub.aiScore != null && (
                        <span className="flex items-center gap-1 text-[11px] font-medium" style={{ color: 'var(--primary)' }}>
                          <Sparkles size={12} />
                          {sub.aiScore}점
                        </span>
                      )}
                      <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>
                        {new Date(sub.createdAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={16} style={{ color: 'var(--text-3)' }} />
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
  const memberName = getMemberDisplayName(submission.userId, createdByUserId, token, members);
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
            <ArrowLeft className="h-5 w-5" style={{ color: 'var(--text)' }} />
          </button>
          <h1 className="text-lg sm:text-xl font-bold tracking-tight truncate" style={{ color: 'var(--text)' }}>
            {memberName}
          </h1>
        </div>

        {/* 뱃지 행 */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* 언어 뱃지 */}
          <span
            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase"
            style={{ backgroundColor: 'var(--primary-soft)', color: 'var(--primary)' }}
          >
            {submission.language}
          </span>
          {/* 상태 뱃지 */}
          {analysis?.analysisStatus === 'completed' && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium"
              style={{ backgroundColor: 'var(--success-soft)', color: 'var(--success)' }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: 'var(--success)' }} aria-hidden />
              분석 완료
            </span>
          )}
          {/* 점수 뱃지 */}
          {parsed && (
            <span
              className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold"
              style={{ backgroundColor: 'var(--success-soft)', color: 'var(--success)' }}
            >
              {parsed.totalScore}점
            </span>
          )}
        </div>

        {/* 시간 */}
        <span className="text-[11px] sm:text-[12px]" style={{ color: 'var(--text-3)' }}>
          {new Date(submission.createdAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}{' '}
          {new Date(submission.createdAt).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit', hour12: true })}
        </span>
      </div>

      {/* ─── LOADING / STATUS ───────────────── */}
      {analysisLoading || !analysis ? (
        <LoadingView />
      ) : analysis.analysisStatus !== 'completed' ? (
        <Card className="p-8 text-center" style={{ color: 'var(--text-3)' }}>
          분석이 아직 완료되지 않았습니다. (상태: {analysis.analysisStatus})
        </Card>
      ) : parsed && (
        /* ─── COMPLETED: 2-Column Layout ────── */
        <div className="flex flex-col lg:flex-row gap-4 items-stretch">

          {/* ── LEFT: Code Viewer ──────────── */}
          <div className="w-full lg:w-1/2 min-w-0 flex flex-col">
            <Card className="p-0 overflow-hidden flex-1 flex flex-col">
              {/* 코드 헤더 */}
              <div
                className="flex items-center justify-between px-5 h-12 shrink-0 border-b"
                style={{ borderColor: 'var(--border)' }}
              >
                <span className="text-[13px] font-semibold flex items-center gap-1.5" style={{ color: 'var(--text)' }}>
                  <span style={{ color: 'var(--primary)' }}>&lt;/&gt;</span>
                  {submission.language}
                </span>
                {code && (
                  <button
                    onClick={() => void handleCopy(code)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-badge text-[11px] font-medium transition-colors hover:bg-bg-alt"
                    style={{ color: 'var(--text-3)' }}
                  >
                    {copied ? <Check className="h-3 w-3" style={{ color: 'var(--success)' }} /> : <Copy className="h-3 w-3" />}
                    {copied ? '복사됨' : '복사'}
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
                  <div className="p-4 text-xs" style={{ color: 'var(--text-3)', backgroundColor: 'var(--code-bg)' }}>
                    제출한 코드를 불러올 수 없습니다.
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* ── RIGHT: AI 분석 결과 사이드바 ── */}
          <div className="w-full lg:w-1/2 flex flex-col">
            <Card className="p-0 overflow-hidden flex-1 flex flex-col">
              {/* 카드 헤더 */}
              <div className="flex items-center justify-between px-5 h-12 shrink-0 border-b" style={{ borderColor: 'var(--border)' }}>
                <span className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: 'var(--text)' }}>
                  <Brain className="h-4 w-4" style={{ color: 'var(--primary)' }} aria-hidden />
                  AI 분석 결과
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
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium"
                        style={{ backgroundColor: 'var(--info-soft)', color: 'var(--info)' }}
                      >
                        <Clock className="h-3.5 w-3.5" aria-hidden />
                        시간 {parsed.timeComplexity}
                      </span>
                    )}
                    {parsed.spaceComplexity && (
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium"
                        style={{ backgroundColor: 'var(--primary-soft)', color: 'var(--primary)' }}
                      >
                        <Zap className="h-3.5 w-3.5" aria-hidden />
                        공간 {parsed.spaceComplexity}
                      </span>
                    )}
                  </div>
                )}

                {/* AI 총평 텍스트 */}
                {parsed.summary && (
                  <div
                    className="rounded-card px-4 py-3 text-[12px] leading-relaxed"
                    style={{
                      backgroundColor: 'var(--primary-soft)',
                      borderLeft: '3px solid var(--primary)',
                      color: 'var(--text-2)',
                    }}
                  >
                    {parsed.summary}
                  </div>
                )}

                {/* 항목별 평가 */}
                {parsed.categories.length > 0 && (
                  <div className="space-y-1">
                    <p className="flex items-center gap-1.5 text-[13px] font-medium pb-1" style={{ color: 'var(--text)', borderBottom: '1px solid var(--border)' }}>
                      <BarChart3 className="h-3.5 w-3.5" style={{ color: 'var(--primary)' }} aria-hidden />
                      항목별 평가
                    </p>
                    {parsed.categories.map((cat) => {
                      const color = barColor(cat.score);
                      const label = CATEGORY_LABELS[cat.name] ?? cat.name;
                      return (
                        <div key={cat.name} className="py-2.5">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[13px] font-semibold" style={{ color: 'var(--text)' }}>{label}</span>
                            <span className="text-[13px] font-bold" style={{ color }}>{cat.score}</span>
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border)' }}>
                            <div
                              className="h-full rounded-full transition-all duration-700 ease-out"
                              style={{ width: barsAnimated ? `${cat.score}%` : '0%', backgroundColor: color }}
                            />
                          </div>
                          <p className="mt-1.5 text-[11px] leading-relaxed" style={{ color: 'var(--text-3)' }}>{cat.comment}</p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* AI 개선 코드 아코디언 */}
                {parsed.optimizedCode && (
                  <div style={{ borderTop: '1px solid var(--border)' }}>
                    <button
                      type="button"
                      onClick={() => setShowOptimized(!showOptimized)}
                      className="flex items-center justify-between w-full px-0 py-2.5 text-[13px] font-medium transition-colors hover:text-primary"
                      style={{ color: 'var(--text)' }}
                    >
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5" style={{ color: 'var(--primary)' }} aria-hidden />
                        AI 개선 코드
                      </span>
                      <ChevronDown
                        className="h-4 w-4 transition-transform"
                        style={{ color: 'var(--text-3)', transform: showOptimized ? 'rotate(180deg)' : 'rotate(0deg)' }}
                        aria-hidden
                      />
                    </button>
                    {showOptimized && (
                      <div className="rounded-card overflow-hidden mb-1" style={{ border: '1px solid var(--border)' }}>
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

function StatCard({ icon, value, label, bg, fg }: {
  readonly icon: ReactNode;
  readonly value: number;
  readonly label: string;
  readonly bg: string;
  readonly fg: string;
}): ReactNode {
  return (
    <Card className="flex items-center gap-3 px-4 py-4">
      <div
        className="flex h-10 w-10 items-center justify-center rounded-xl"
        style={{ backgroundColor: bg, color: fg }}
      >
        {icon}
      </div>
      <div>
        <p className="text-xl font-bold" style={{ color: 'var(--text)' }}>{value}</p>
        <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>{label}</p>
      </div>
    </Card>
  );
}

function GuestShell({ children }: { readonly children: ReactNode }): ReactNode {
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <header className="border-b px-4 py-3" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}>
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-2">
            <Image src="/avatars/default.svg" alt="AlgoSu" width={28} height={28} />
            <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>AlgoSu</span>
            <span className="rounded-badge px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: 'var(--bg-alt)', color: 'var(--text-3)' }}>
              게스트
            </span>
          </div>
          <button
            type="button"
            aria-label="테마 전환"
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className="flex items-center justify-center rounded-btn p-2 transition-all duration-150 hover:bg-bg-alt"
            style={{ color: 'var(--text-3)' }}
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
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent" style={{ color: 'var(--primary)' }} />
    </div>
  );
}

function ErrorView({ message }: { readonly message: string }): ReactNode {
  return (
    <div className="flex flex-col items-center gap-3 py-12">
      <AlertCircle size={32} style={{ color: 'var(--error)' }} />
      <p className="text-sm" style={{ color: 'var(--text-3)' }}>{message}</p>
    </div>
  );
}

function getMemberDisplayName(
  userId: string | undefined,
  createdByUserId: string | null,
  token: string,
  members: Array<{ userId: string; nickname: string }>,
): string {
  if (!userId) return '익명';
  if (createdByUserId && shouldShowRealName(userId, createdByUserId)) {
    const member = members.find((m) => m.userId === userId);
    return member?.nickname ?? '프로필 소유자';
  }
  return getAnonymousName(userId, token);
}
