/**
 * @file 코드 제출 페이지 (v2 전면 교체)
 * @domain submission
 * @layer page
 * @related problemApi, submissionApi, draftApi, CodeEditor, useAutoSave
 */

'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { BackBtn } from '@/components/ui/BackBtn';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { DifficultyBadge } from '@/components/ui/DifficultyBadge';
import { TimerBadge } from '@/components/ui/TimerBadge';
import { LangBadge } from '@/components/ui/LangBadge';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { CodeEditor } from '@/components/submission/CodeEditor';
import { useAutoSave } from '@/hooks/useAutoSave';
import { problemApi, submissionApi, draftApi, type Problem } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useStudy } from '@/contexts/StudyContext';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useRequireStudy } from '@/hooks/useRequireStudy';
import type { Difficulty } from '@/lib/constants';

// ─── TYPES ────────────────────────────────

type AutoSaveStatus = 'idle' | 'saving' | 'saved';

// ─── RENDER ───────────────────────────────

/**
 * 코드 제출 페이지
 * @domain submission
 * @guard C1-github-check
 */
export default function SubmitPage(): ReactNode {
  const params = useParams();
  const problemId = params?.problemId as string;
  const router = useRouter();
  const { isAuthenticated } = useRequireAuth();
  useRequireStudy();
  const { githubConnected } = useAuth();
  const { currentStudyId } = useStudy();

  // ─── STATE ──────────────────────────────

  const [problem, setProblem] = useState<Problem | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string>('');
  const [language, setLanguage] = useState<string>('python');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>('idle');

  // ─── EFFECTS ────────────────────────────

  useEffect(() => {
    if (!isAuthenticated || !problemId) return;
    let cancelled = false;

    const load = async (): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        const [problemData, draftData] = await Promise.all([
          problemApi.findById(problemId),
          draftApi.find(problemId),
        ]);
        if (cancelled) return;
        setProblem(problemData);
        if (draftData) {
          setCode(draftData.code);
          setLanguage(draftData.language);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError((err as Error).message ?? '문제를 불러오는 데 실패했습니다.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [isAuthenticated, problemId]);

  // ─── HOOKS ──────────────────────────────

  const { loadFromLocal, clearLocal } = useAutoSave({
    problemId,
    studyId: currentStudyId,
    code,
    language,
    onLocalSaved: useCallback(() => {
      setAutoSaveStatus('saved');
      setTimeout(() => setAutoSaveStatus('idle'), 2000);
    }, []),
    onServerSave: useCallback(
      async (data: { code: string; language: string }): Promise<void> => {
        try {
          await draftApi.upsert(problemId, { language: data.language, code: data.code });
        } catch {
          // 서버 저장 실패 — localStorage에 이미 저장됨
        }
      },
      [problemId],
    ),
    enabled: !isLoading && problem !== null,
  });

  useEffect(() => {
    if (isLoading || code) return;
    const local = loadFromLocal();
    if (local) {
      setCode(local.code);
      setLanguage(local.language);
    }
  }, [isLoading, code, loadFromLocal]);

  // ─── HANDLERS ─────────────────────────────

  const handleCodeChange = useCallback((newCode: string): void => {
    setCode(newCode);
    setAutoSaveStatus('saving');
  }, []);

  const handleLanguageChange = useCallback((lang: string): void => {
    setLanguage(lang);
    setAutoSaveStatus('saving');
  }, []);

  const handleSubmit = useCallback(async (): Promise<void> => {
    if (!problem) return;
    if (!githubConnected) {
      setSubmitError('GitHub 계정을 먼저 연동해주세요.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const submission = await submissionApi.create({
        problemId: problem.id,
        language,
        code,
      });

      clearLocal();
      void draftApi.remove(problemId).catch(() => {});

      router.push(`/problems/${problemId}/status?submissionId=${submission.id}`);
    } catch (err: unknown) {
      setSubmitError((err as Error).message ?? '제출 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  }, [problem, language, code, problemId, clearLocal, router, githubConnected]);

  // ─── LOADING ────────────────────────────

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-4">
          <Skeleton height={60} />
          <Skeleton height={300} />
        </div>
      </AppLayout>
    );
  }

  if (error || !problem) {
    return (
      <AppLayout>
        <div className="space-y-4">
          <Alert variant="error">{error ?? '문제를 찾을 수 없습니다.'}</Alert>
          <BackBtn label="뒤로 가기" />
        </div>
      </AppLayout>
    );
  }

  const deadlineDate = problem.deadline ? new Date(problem.deadline) : null;

  return (
    <AppLayout>
      <div className="space-y-5">
        {/* 뒤로가기 */}
        <BackBtn label="문제 상세" href={`/problems/${problemId}`} className="-ml-1" />

        {/* 페이지 타이틀 */}
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-text">코드 제출</h1>
          <p className="mt-0.5 text-xs text-text-3">코드를 작성하고 제출하세요</p>
        </div>

        {/* 문제 정보 */}
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              {problem.difficulty && (
                <DifficultyBadge difficulty={problem.difficulty as Difficulty} level={problem.level} />
              )}
              <Badge variant="info">{problem.weekNumber}</Badge>
              {deadlineDate && <TimerBadge deadline={deadlineDate} />}
            </div>
            <CardTitle>{problem.title}</CardTitle>
          </CardHeader>
          <CardContent>
            {/* 문제 설명 */}
            {problem.description && (
              <p className="text-[13px] leading-relaxed text-text-2 mb-4">
                {problem.description}
              </p>
            )}
            {/* 허용 언어 */}
            {problem.allowedLanguages.length > 0 && (
              <div>
                <span className="text-[11px] font-medium text-text-3 mb-1.5 block">허용 언어</span>
                <div className="flex flex-wrap gap-1.5">
                  {problem.allowedLanguages.map((lang) => (
                    <LangBadge key={lang} language={lang} />
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* GitHub 미연동 경고 */}
        {!githubConnected && (
          <Alert variant="warning" title="GitHub 연동 필요">
            코드를 제출하려면 먼저 GitHub 계정을 연동해주세요.{' '}
            <Button
              variant="link"
              size="sm"
              onClick={() => router.push('/github-link')}
              className="inline h-auto p-0 text-inherit underline font-medium"
            >
              GitHub 연동하기
            </Button>
          </Alert>
        )}

        {/* 제출 에러 */}
        {submitError && (
          <Alert variant="error" onClose={() => setSubmitError(null)}>
            {submitError}
          </Alert>
        )}

        {/* 코드 에디터 */}
        {problem.status === 'ACTIVE' ? (
          <CodeEditor
            code={code}
            language={language}
            onCodeChange={handleCodeChange}
            onLanguageChange={handleLanguageChange}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            autoSaveStatus={autoSaveStatus}
            deadline={problem.deadline}
          />
        ) : (
          <Alert variant="warning" title="제출 마감">
            이 문제는 마감되었습니다. 더 이상 제출할 수 없습니다.
          </Alert>
        )}
      </div>
    </AppLayout>
  );
}
