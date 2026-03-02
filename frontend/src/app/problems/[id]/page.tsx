'use client';

import { useState, useEffect, useCallback, use, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { DifficultyBadge } from '@/components/ui/DifficultyBadge';
import { TimerBadge } from '@/components/ui/TimerBadge';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { CodeEditor } from '@/components/submission/CodeEditor';
import { useAutoSave } from '@/hooks/useAutoSave';
import { problemApi, submissionApi, draftApi, type Problem } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useStudy } from '@/contexts/StudyContext';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { ChevronLeft, Pencil } from 'lucide-react';

interface PageProps {
  readonly params: Promise<{ id: string }>;
}

type AutoSaveStatus = 'idle' | 'saving' | 'saved';

export default function ProblemDetailPage({ params }: PageProps): ReactNode {
  const { id: problemId } = use(params);
  const router = useRouter();
  const { isAuthenticated } = useRequireAuth();
  const { githubConnected } = useAuth();
  const { currentStudyId, currentStudyRole } = useStudy();
  const isAdmin = currentStudyRole === 'ADMIN';

  const [problem, setProblem] = useState<Problem | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [code, setCode] = useState<string>('');
  const [language, setLanguage] = useState<string>('python');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>('idle');

  // 문제 + Draft 로드 (인증 완료 후에만 실행)
  useEffect(() => {
    if (!isAuthenticated) return;
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

        // Draft 복원 — 서버 Draft 우선, 없으면 localStorage
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
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, problemId]);

  // localStorage Draft 복원 (서버 Draft가 없을 때)
  const { loadFromLocal, clearLocal } = useAutoSave({
    problemId,
    studyId: currentStudyId,
    code,
    language,
    onServerSave: useCallback(
      async (data: { code: string; language: string }): Promise<void> => {
        setAutoSaveStatus('saving');
        try {
          await draftApi.upsert(problemId, { language: data.language, code: data.code });
          setAutoSaveStatus('saved');
          setTimeout(() => setAutoSaveStatus('idle'), 2000);
        } catch {
          // 서버 저장 실패 — 무시 (localStorage에 이미 저장됨)
          setAutoSaveStatus('idle');
        }
      },
      [problemId],
    ),
    enabled: !isLoading && problem !== null,
  });

  // Draft 없을 경우 localStorage 복원
  useEffect(() => {
    if (isLoading) return;
    if (code) return; // 이미 코드가 있으면 복원 불필요

    const local = loadFromLocal();
    if (local) {
      setCode(local.code);
      setLanguage(local.language);
    }
  }, [isLoading, code, loadFromLocal]);

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

      // Draft 정리
      clearLocal();
      void draftApi.remove(problemId).catch(() => {
        // 삭제 실패 무시
      });

      // 제출 상태 페이지로 이동
      router.push(`/problems/${problemId}/status?submissionId=${submission.id}`);
    } catch (err: unknown) {
      setSubmitError((err as Error).message ?? '제출 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  }, [problem, language, code, problemId, clearLocal, router, githubConnected]);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <LoadingSpinner size="lg" label="문제를 불러오는 중..." />
        </div>
      </AppLayout>
    );
  }

  if (error || !problem) {
    return (
      <AppLayout>
        <div className="space-y-4">
          <Alert variant="error">{error ?? '문제를 찾을 수 없습니다.'}</Alert>
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ChevronLeft />
            뒤로 가기
          </Button>
        </div>
      </AppLayout>
    );
  }

  const deadlineDate = new Date(problem.deadline);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* 뒤로가기 + 수정 */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/problems')}
            className="-ml-1"
          >
            <ChevronLeft />
            문제 목록
          </Button>
          {isAdmin && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/problems/${problemId}/edit`)}
            >
              <Pencil />
              수정
            </Button>
          )}
        </div>

        {/* 문제 정보 */}
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="info">{problem.weekNumber}주차</Badge>
              <DifficultyBadge difficulty={problem.difficulty} level={problem.level} />
              <Badge variant={problem.status === 'ACTIVE' ? 'success' : 'muted'}>
                {problem.status === 'ACTIVE' ? '진행 중' : '종료'}
              </Badge>
              <TimerBadge deadline={deadlineDate} />
            </div>
            <CardTitle className="text-xl">{problem.title}</CardTitle>
          </CardHeader>

          <CardContent>
            <div className="prose prose-sm max-w-none text-foreground">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                {problem.description}
              </p>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="text-sm font-medium text-foreground">허용 언어:</span>
              {problem.allowedLanguages.map((lang) => (
                <Badge key={lang} variant="info">
                  {lang}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* GitHub 미연동 경고 (C1) */}
        {!githubConnected && problem.status === 'ACTIVE' && (
          <Alert variant="warning" title="GitHub 연동 필요">
            코드를 제출하려면 먼저 GitHub 계정을 연동해주세요.{' '}
            <button
              type="button"
              onClick={() => router.push('/github-link')}
              className="underline font-medium"
            >
              GitHub 연동하기
            </button>
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
          <Card>
            <CardHeader>
              <CardTitle>코드 제출</CardTitle>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>
        ) : (
          <Alert variant="warning" title="제출 마감">
            이 문제는 마감되었습니다. 더 이상 제출할 수 없습니다.
          </Alert>
        )}
      </div>
    </AppLayout>
  );
}
