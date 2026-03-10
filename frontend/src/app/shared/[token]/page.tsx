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
  Code2, Brain, Users, AlertCircle, ArrowLeft,
  ChevronRight, FileText, CheckCircle2, Sparkles, Copy, Check,
} from 'lucide-react';
import { GuestProvider, useGuest } from '@/contexts/GuestContext';
import { publicApi, type Problem, type Submission, type AnalysisResult } from '@/lib/api';
import { getAnonymousName, shouldShowRealName } from '@/lib/anonymize';
import { getAvatarSrc } from '@/lib/avatars';
import { Card } from '@/components/ui/Card';
import {
  DIFF_BADGE_STYLE,
  DIFFICULTY_LABELS,
  PROBLEM_STATUS_LABELS,
  type Difficulty,
} from '@/lib/constants';

/* ───────────────── 피드백 파싱 ───────────────── */

type FeedbackHighlight = string | { startLine?: number; endLine?: number; type?: string; message?: string };

interface FeedbackCategory {
  name?: string;
  category?: string;
  score?: number;
  comment?: string;
  highlights?: FeedbackHighlight[];
}

function parseFeedback(feedback: string | null): FeedbackCategory[] {
  if (!feedback) return [];
  try {
    let rawJson = feedback;
    try { JSON.parse(rawJson); } catch {
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
    return cats as FeedbackCategory[];
  } catch { return []; }
}

/** 총점 추출 (feedback JSON 내 totalScore) */
function parseTotalScore(feedback: string | null): number | null {
  if (!feedback) return null;
  try {
    const parsed = JSON.parse(feedback);
    return parsed.totalScore ?? null;
  } catch { return null; }
}

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

  /* 문제별 제출 필터 */
  const filteredSubmissions = useMemo(() => {
    if (!selectedProblem) return [];
    return allSubmissions.filter((s) => s.problemId === selectedProblem.id);
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

  /* 문제별 제출 수 맵 */
  const submissionCountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of allSubmissions) {
      map.set(s.problemId, (map.get(s.problemId) ?? 0) + 1);
    }
    return map;
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
          <StatCard icon={<CheckCircle2 size={18} />} value={allSubmissions.length} label="제출" bg="var(--success-soft)" fg="var(--success)" />
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
        <div>
          <div className="flex items-center justify-center gap-1.5">
            <Users className="h-4 w-4" style={{ color: 'var(--text-3)' }} />
            <span className="text-lg font-bold" style={{ color: 'var(--text)' }}>{memberCount}</span>
          </div>
          <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>전체 멤버</p>
        </div>
        <div>
          <div className="flex items-center justify-center gap-1.5">
            <CheckCircle2 className="h-4 w-4" style={{ color: 'var(--success)' }} />
            <span className="text-lg font-bold" style={{ color: 'var(--text)' }}>{uniqueSubmitters}</span>
          </div>
          <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>제출</p>
        </div>
        <div>
          <div className="flex items-center justify-center gap-1.5">
            <Brain className="h-4 w-4" style={{ color: 'var(--primary)' }} />
            <span className="text-lg font-bold" style={{ color: 'var(--text)' }}>{analyzedCount}</span>
          </div>
          <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>분석 완료</p>
        </div>
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
            return (
              <Card
                key={sub.id}
                className="cursor-pointer p-4 transition-all hover:-translate-y-0.5 hover:shadow-sm"
                onClick={() => onSelect(sub)}
              >
                <div className="flex items-center gap-3">
                  {/* 아바타 */}
                  <img
                    src={getAvatarSrc('default')}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-full object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold" style={{ color: 'var(--text)' }}>{memberName}</span>
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

/* ───────────────── 분석 뷰 ───────────────── */

/** 카테고리 이름별 색상 매핑 */
const CAT_COLORS: Record<string, string> = {
  correctness: 'var(--success)',
  efficiency: 'var(--info)',
  readability: 'var(--primary)',
  structure: 'var(--warning)',
  bestPractice: '#9f7aea',
  bestpractice: '#9f7aea',
};

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
  const categories: FeedbackCategory[] = analysis?.feedback ? parseFeedback(analysis.feedback) : [];
  const totalScore = analysis?.score ?? parseTotalScore(analysis?.feedback ?? null);
  const code = submission.code || (analysis as AnalysisResult & { code?: string } | null)?.code;
  const [copied, setCopied] = useState(false);
  const [barsAnimated, setBarsAnimated] = useState(false);

  useEffect(() => {
    if (categories.length === 0) return;
    const timer = setTimeout(() => setBarsAnimated(true), 100);
    return () => clearTimeout(timer);
  }, [categories.length]);

  const handleCopy = useCallback(async () => {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

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

      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <img src={getAvatarSrc('default')} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
        <div>
          <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>{memberName}</h2>
          <div className="flex items-center gap-2">
            <span className="rounded-full px-2 py-0.5 text-[11px] font-medium uppercase" style={{ backgroundColor: 'var(--bg-alt)', color: 'var(--text-2)' }}>
              {submission.language}
            </span>
            <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>
              {new Date(submission.createdAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          </div>
        </div>
      </div>

      {analysisLoading || !analysis ? (
        <LoadingView />
      ) : analysis.analysisStatus !== 'completed' ? (
        <Card className="p-8 text-center" style={{ color: 'var(--text-3)' }}>
          분석이 아직 완료되지 않았습니다. (상태: {analysis.analysisStatus})
        </Card>
      ) : (
        <div className="flex flex-col gap-4 lg:flex-row">
          {/* 좌측: 코드 */}
          {code && (
            <div className="flex w-full flex-col lg:w-1/2">
              <Card className="flex-1 overflow-hidden p-0">
                <div className="flex h-12 items-center justify-between border-b px-5" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-2">
                    <Code2 size={14} style={{ color: 'var(--text-3)' }} />
                    <span className="text-[13px] font-semibold" style={{ color: 'var(--text)' }}>제출 코드</span>
                    <span className="rounded-full px-2 py-0.5 text-[11px] font-medium uppercase" style={{ backgroundColor: 'var(--bg-alt)', color: 'var(--text-2)' }}>
                      {submission.language}
                    </span>
                  </div>
                  <button type="button" onClick={() => void handleCopy()} className="flex items-center gap-1 rounded-full px-2 py-1 text-[11px] transition-colors" style={{ color: copied ? 'var(--success)' : 'var(--text-3)' }}>
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? '복사됨' : '복사'}
                  </button>
                </div>
                <pre className="overflow-x-auto p-5 text-[13px] leading-relaxed" style={{ color: 'var(--text)', backgroundColor: 'var(--bg-alt)' }}>
                  <code>{code}</code>
                </pre>
              </Card>
            </div>
          )}

          {/* 우측: 분석 결과 */}
          <div className={`flex w-full flex-col gap-4 ${code ? 'lg:w-1/2' : ''}`}>
            {/* 점수 */}
            {totalScore != null && (
              <Card className="p-5">
                <div className="flex items-center gap-3">
                  <Sparkles size={20} style={{ color: 'var(--primary)' }} />
                  <div>
                    <p className="text-[11px] font-medium" style={{ color: 'var(--text-3)' }}>AI 종합 점수</p>
                    <p className="text-3xl font-bold" style={{ color: 'var(--primary)' }}>
                      {totalScore}<span className="text-base font-normal" style={{ color: 'var(--text-3)' }}>/100</span>
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {/* 카테고리별 점수 바 */}
            {categories.length > 0 && (
              <Card className="space-y-1 p-5">
                <p className="mb-3 text-[13px] font-semibold" style={{ color: 'var(--text)' }}>카테고리별 분석</p>
                {categories.map((cat, i) => {
                  const catKey = (cat.name ?? cat.category ?? '').toLowerCase();
                  const barColor = CAT_COLORS[catKey] ?? 'var(--primary)';
                  const catScore = cat.score ?? 0;

                  return (
                    <div key={i} className="py-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] font-medium" style={{ color: 'var(--text-2)' }}>{cat.name ?? cat.category}</span>
                        {cat.score != null && (
                          <span className="text-[13px] font-bold" style={{ color: barColor }}>{cat.score}</span>
                        )}
                      </div>
                      {cat.score != null && (
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: 'var(--border)' }}>
                          <div
                            className="h-full rounded-full transition-all duration-700 ease-out"
                            style={{ width: barsAnimated ? `${catScore}%` : '0%', backgroundColor: barColor }}
                          />
                        </div>
                      )}
                      {cat.comment && (
                        <p className="mt-1.5 text-[11px] leading-relaxed" style={{ color: 'var(--text-3)' }}>{cat.comment}</p>
                      )}
                      {cat.highlights && cat.highlights.length > 0 && (
                        <ul className="mt-1.5 space-y-1">
                          {cat.highlights.map((h, j) => (
                            <li key={j} className="flex items-start gap-1.5 text-[11px] leading-relaxed" style={{ color: 'var(--text-3)' }}>
                              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full" style={{ backgroundColor: barColor }} />
                              {typeof h === 'string' ? h : (h.message ?? `Line ${h.startLine ?? '?'}–${h.endLine ?? '?'}`)}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </Card>
            )}

            {/* 최적화 코드 */}
            {analysis.optimizedCode && (
              <Card className="overflow-hidden p-0">
                <div className="flex h-10 items-center gap-2 border-b px-4" style={{ borderColor: 'var(--border)' }}>
                  <Brain size={14} style={{ color: 'var(--primary)' }} />
                  <span className="text-[12px] font-semibold" style={{ color: 'var(--text)' }}>최적화 코드</span>
                </div>
                <pre className="overflow-x-auto p-4 text-[12px] leading-relaxed" style={{ color: 'var(--text)', backgroundColor: 'var(--bg-alt)' }}>
                  <code>{analysis.optimizedCode}</code>
                </pre>
              </Card>
            )}
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
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <header className="border-b px-4 py-3" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}>
        <div className="mx-auto flex max-w-4xl items-center gap-2">
          <Image src="/avatars/default.svg" alt="AlgoSu" width={28} height={28} />
          <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>AlgoSu</span>
          <span className="rounded-badge px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: 'var(--bg-alt)', color: 'var(--text-3)' }}>
            게스트
          </span>
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
      <AlertCircle size={32} style={{ color: 'var(--danger)' }} />
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
