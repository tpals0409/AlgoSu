/**
 * @file 게스트 스터디룸 — 공유 링크 기반 읽기 전용 뷰
 * @domain share
 * @layer page
 * @related GuestContext.tsx, anonymize.ts, publicApi
 *
 * 보안: 쓰기 UI 일체 숨김, 익명화 적용
 */
'use client';

import {
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import { BookOpen, Code2, Brain, Users, AlertCircle, ArrowLeft } from 'lucide-react';
import { GuestProvider, useGuest } from '@/contexts/GuestContext';
import { publicApi, type Problem, type Submission, type AnalysisResult } from '@/lib/api';
import { getAnonymousName, shouldShowRealName } from '@/lib/anonymize';
import { Card } from '@/components/ui/Card';

/** 피드백 하이라이트 — 문자열 또는 코드 어노테이션 객체 */
type FeedbackHighlight = string | { startLine?: number; endLine?: number; type?: string; message?: string };

/** 피드백 카테고리 타입 */
interface FeedbackCategory {
  name?: string;
  category?: string;
  score?: number;
  comment?: string;
  highlights?: FeedbackHighlight[];
}

/** 피드백 JSON 파싱 */
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

/** 페이지 진입점 — GuestProvider 래핑 */
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

/** 게스트 스터디룸 본문 */
function SharedStudyContent(): ReactNode {
  const { studyData, createdByUserId, token, loading, error } = useGuest();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [selectedProblem, setSelectedProblem] = useState<Problem | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [subLoading, setSubLoading] = useState(false);

  /* 문제 목록 로드 */
  useEffect(() => {
    if (!token || loading || error) return;
    publicApi.getSharedProblems(token)
      .then(setProblems)
      .catch(() => setProblems([]));
  }, [token, loading, error]);

  /* 제출 목록 로드 */
  const handleSelectProblem = useCallback((problem: Problem) => {
    setSelectedProblem(problem);
    setSelectedSubmission(null);
    setAnalysis(null);
    setSubLoading(true);
    publicApi.getSharedSubmissions(token)
      .then((subs) => {
        const filtered = subs.filter((s) => s.problemId === problem.id);
        setSubmissions(filtered);
      })
      .catch(() => setSubmissions([]))
      .finally(() => setSubLoading(false));
  }, [token]);

  /* AI 분석 로드 */
  const handleSelectSubmission = useCallback((sub: Submission) => {
    setSelectedSubmission(sub);
    setAnalysis(null);
    publicApi.getSharedAnalysis(token, sub.id)
      .then(setAnalysis)
      .catch(() => setAnalysis(null));
  }, [token]);

  /* 뒤로가기 */
  const handleBack = useCallback(() => {
    if (selectedSubmission) {
      setSelectedSubmission(null);
      setAnalysis(null);
    } else if (selectedProblem) {
      setSelectedProblem(null);
      setSubmissions([]);
    }
  }, [selectedProblem, selectedSubmission]);

  if (loading) return <GuestShell><LoadingView /></GuestShell>;
  if (error) return <GuestShell><ErrorView message={error} /></GuestShell>;
  if (!studyData) return <GuestShell><ErrorView message="스터디 정보를 불러올 수 없습니다." /></GuestShell>;

  /* 3단계 뷰: 분석 → 제출 → 문제 목록 */
  if (selectedProblem && selectedSubmission) {
    return (
      <GuestShell>
        <AnalysisView
          submission={selectedSubmission}
          analysis={analysis}
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
          submissions={submissions}
          loading={subLoading}
          onSelect={handleSelectSubmission}
          onBack={handleBack}
          createdByUserId={createdByUserId}
          token={token}
          members={studyData.members}
        />
      </GuestShell>
    );
  }

  return (
    <GuestShell>
      <div className="space-y-6">
        {/* 스터디 헤더 */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: 'var(--primary-soft)' }}>
            <BookOpen size={20} style={{ color: 'var(--primary)' }} />
          </div>
          <div>
            <h1 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
              {studyData.studyName}
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-3)' }}>
              <Users size={14} className="mr-1 inline" />
              {studyData.memberCount}명 · 읽기 전용
            </p>
          </div>
        </div>

        {/* 문제 목록 */}
        <div className="space-y-3">
          <h2 className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>문제 목록</h2>
          {problems.length === 0 ? (
            <Card className="p-6 text-center" style={{ color: 'var(--text-3)' }}>
              등록된 문제가 없습니다.
            </Card>
          ) : (
            problems.map((p) => (
              <button
                key={p.id}
                type="button"
                className="w-full rounded-card border p-4 text-left transition-colors hover:shadow-sm"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}
                onClick={() => handleSelectProblem(p)}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium" style={{ color: 'var(--text)' }}>{p.title}</span>
                  <Code2 size={16} style={{ color: 'var(--text-3)' }} />
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </GuestShell>
  );
}

/* ───────────────── 하위 뷰 컴포넌트 ───────────────── */

function SubmissionListView({ problem, submissions, loading, onSelect, onBack, createdByUserId, token, members }: {
  readonly problem: Problem;
  readonly submissions: Submission[];
  readonly loading: boolean;
  readonly onSelect: (s: Submission) => void;
  readonly onBack: () => void;
  readonly createdByUserId: string | null;
  readonly token: string;
  readonly members: Array<{ userId: string; nickname: string; role: string }>;
}): ReactNode {
  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="flex items-center gap-1 text-sm" style={{ color: 'var(--text-3)' }}>
        <ArrowLeft size={16} /> 문제 목록으로
      </button>
      <h2 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>{problem.title}</h2>

      {loading ? (
        <LoadingView />
      ) : submissions.length === 0 ? (
        <Card className="p-6 text-center" style={{ color: 'var(--text-3)' }}>
          제출 기록이 없습니다.
        </Card>
      ) : (
        <div className="space-y-3">
          {submissions.map((sub) => {
            const memberName = getMemberDisplayName(sub.userId, createdByUserId, token, members);
            return (
              <button
                key={sub.id}
                type="button"
                className="w-full rounded-card border p-4 text-left transition-colors hover:shadow-sm"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}
                onClick={() => onSelect(sub)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{memberName}</span>
                    <span className="text-xs" style={{ color: 'var(--text-3)' }}>{sub.language}</span>
                  </div>
                  {sub.aiScore != null && (
                    <span className="rounded-badge px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: 'var(--primary-soft)', color: 'var(--primary)' }}>
                      AI {sub.aiScore}점
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs" style={{ color: 'var(--text-3)' }}>
                  {new Date(sub.createdAt).toLocaleDateString('ko-KR')}
                </p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AnalysisView({ submission, analysis, onBack, createdByUserId, token, members }: {
  readonly submission: Submission;
  readonly analysis: AnalysisResult | null;
  readonly onBack: () => void;
  readonly createdByUserId: string | null;
  readonly token: string;
  readonly members: Array<{ userId: string; nickname: string; role: string }>;
}): ReactNode {
  const memberName = getMemberDisplayName(submission.userId, createdByUserId, token, members);
  const categories: FeedbackCategory[] = analysis?.feedback ? parseFeedback(analysis.feedback) : [];

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="flex items-center gap-1 text-sm" style={{ color: 'var(--text-3)' }}>
        <ArrowLeft size={16} /> 제출 목록으로
      </button>

      <div className="flex items-center gap-3">
        <Brain size={20} style={{ color: 'var(--primary)' }} />
        <div>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>AI 분석 결과</h2>
          <p className="text-sm" style={{ color: 'var(--text-3)' }}>
            {memberName} · {submission.language}
          </p>
        </div>
      </div>

      {!analysis ? (
        <LoadingView />
      ) : analysis.analysisStatus !== 'completed' ? (
        <Card className="p-6 text-center" style={{ color: 'var(--text-3)' }}>
          분석이 아직 완료되지 않았습니다. (상태: {analysis.analysisStatus})
        </Card>
      ) : (
        <div className="space-y-4">
          {analysis.score != null && (
            <Card className="p-4">
              <p className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>종합 점수</p>
              <p className="mt-1 text-3xl font-bold" style={{ color: 'var(--primary)' }}>{analysis.score}<span className="text-base font-normal">/100</span></p>
            </Card>
          )}

          {categories.length > 0 && (
            <Card className="space-y-3 p-4">
              <p className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>카테고리별 피드백</p>
              {categories.map((cat, i) => (
                <div key={i} className="rounded-card border p-3" style={{ borderColor: 'var(--border)' }}>
                  <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{cat.name ?? cat.category}</p>
                  {cat.highlights && cat.highlights.length > 0 && (
                    <ul className="mt-1 list-inside list-disc text-xs" style={{ color: 'var(--text-3)' }}>
                      {cat.highlights.map((h, j) => (
                        <li key={j}>
                          {typeof h === 'string' ? h : (h.message ?? `Line ${h.startLine ?? '?'}–${h.endLine ?? '?'}`)}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </Card>
          )}

          {(submission.code || (analysis as AnalysisResult & { code?: string })?.code) && (
            <Card className="p-4">
              <p className="mb-2 text-sm font-medium" style={{ color: 'var(--text-2)' }}>제출 코드</p>
              <pre className="overflow-x-auto rounded-card p-3 text-xs" style={{ backgroundColor: 'var(--bg-alt)', color: 'var(--text)' }}>
                <code>{submission.code || (analysis as AnalysisResult & { code?: string })?.code}</code>
              </pre>
            </Card>
          )}

          {analysis.optimizedCode && (
            <Card className="p-4">
              <p className="mb-2 text-sm font-medium" style={{ color: 'var(--text-2)' }}>최적화 코드</p>
              <pre className="overflow-x-auto rounded-card p-3 text-xs" style={{ backgroundColor: 'var(--bg-alt)', color: 'var(--text)' }}>
                <code>{analysis.optimizedCode}</code>
              </pre>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

/* ───────────────── 공통 유틸/레이아웃 ───────────────── */

/** 게스트 레이아웃 셸 — 최소 헤더 + 본문 */
function GuestShell({ children }: { readonly children: ReactNode }): ReactNode {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <header className="border-b px-4 py-3" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}>
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          <Image src="/avatars/default.svg" alt="AlgoSu" width={28} height={28} />
          <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>AlgoSu</span>
          <span className="rounded-badge px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: 'var(--bg-alt)', color: 'var(--text-3)' }}>
            게스트
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">
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

/** 멤버 표시명 — 생성자는 실명, 나머지는 익명 */
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
