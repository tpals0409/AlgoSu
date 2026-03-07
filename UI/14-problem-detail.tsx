/**
 * @file 문제 상세 + 코드 제출 통합 페이지
 * @domain problem, submission
 * @layer page
 * @related problemApi, submissionApi, draftApi, CodeEditor, useAutoSave
 */

'use client';

import { useState, useEffect, useCallback, use, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  Pencil,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
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

interface PageProps {
  readonly params: Promise<{ id: string }>;
}

type AutoSaveStatus = 'idle' | 'saving' | 'saved';

// ─── RENDER ───────────────────────────────

/**
 * 문제 상세 + 코드 제출 통합 페이지
 * @domain problem, submission
 */
export default function ProblemDetailPage({ params }: PageProps): ReactNode {
  const { id: problemId } = use(params);
  const router = useRouter();
  const { isAuthenticated } = useRequireAuth();
  useRequireStudy();
  const { githubConnected } = useAuth();
  const { currentStudyId, currentStudyRole } = useStudy();
  const isAdmin = currentStudyRole === 'ADMIN';

  // ─── STATE ──────────────────────────────

  const [problem, setProblem] = useState<Problem | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // 코드 제출 관련
  const [code, setCode] = useState<string>('');
  const [language, setLanguage] = useState<string>('python');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>('idle');

  // ─── EFFECTS ────────────────────────────

  useEffect(() => {
    if (!isAuthenticated || !currentStudyId) return;
    let cancelled = false;

    const load = async (): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        const [problemData, draftData] = await Promise.all([
          problemApi.findById(problemId),
          draftApi.find(problemId).catch(() => null),
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
  }, [isAuthenticated, currentStudyId, problemId]);

  // ─── AUTO-SAVE ──────────────────────────

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
    enabled: !isLoading && problem !== null && problem.status === 'ACTIVE',
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

  const handleDelete = async (): Promise<void> => {
    const confirmed = window.confirm(
      '정말 이 문제를 삭제하시겠습니까? 관련 제출 기록도 함께 삭제됩니다.',
    );
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      await problemApi.delete(problemId);
      router.replace('/problems');
    } catch {
      setIsDeleting(false);
    }
  };

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

      router.push(`/submissions/${submission.id}/status`);
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
          <Skeleton height={20} width="30%" />
          <Skeleton height={200} />
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
          <Button variant="ghost" size="sm" onClick={() => router.push('/problems')}>
            <ChevronLeft />
            문제 목록
          </Button>
        </div>
      </AppLayout>
    );
  }

  const deadlineDate = problem.deadline ? new Date(problem.deadline) : null;
  const isActive = problem.status === 'ACTIVE';

  // ─── 문제 정보 패널 (좌측 / 모바일 상단) ───
  const problemPanel = (
    <div className="space-y-5">
      {/* 뒤로가기 + 관리 */}
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
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/problems/${problemId}/edit`)}
            >
              <Pencil />
              수정
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={isDeleting}
              onClick={() => void handleDelete()}
            >
              <Trash2 />
              삭제
            </Button>
          </div>
        )}
      </div>

      {/* 문제 정보 카드 */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Badge variant="info">{problem.weekNumber}</Badge>
            {problem.difficulty && (
              <DifficultyBadge difficulty={problem.difficulty as Difficulty} level={problem.level} />
            )}
            <Badge variant={isActive ? 'success' : 'muted'}>
              {isActive ? '진행 중' : '종료'}
            </Badge>
            {deadlineDate && <TimerBadge deadline={deadlineDate} />}
          </div>
          <CardTitle className="text-xl">{problem.title}</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {problem.description && (
            <p className="text-sm leading-relaxed text-text-2 whitespace-pre-wrap">
              {problem.description}
            </p>
          )}

          {problem.tags && problem.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {problem.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-bg-alt px-2.5 py-0.5 text-[10px] font-medium text-text-2"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {problem.allowedLanguages && problem.allowedLanguages.length > 0 && (
            <div>
              <span className="block text-[11px] font-medium text-text-3 mb-1.5">허용 언어</span>
              <div className="flex flex-wrap gap-1.5">
                {problem.allowedLanguages.map((lang) => (
                  <LangBadge key={lang} language={lang} />
                ))}
              </div>
            </div>
          )}

          {problem.sourceUrl && (
            <a
              href={problem.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary transition-colors hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              {problem.sourcePlatform ?? '출처'} 에서 보기
            </a>
          )}
        </CardContent>
      </Card>

      {/* GitHub 미연동 경고 */}
      {isActive && !githubConnected && (
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

      {/* 모바일: 마감 안내 */}
      {!isActive && (
        <Alert variant="warning" title="제출 마감">
          이 문제는 마감되었습니다. 더 이상 제출할 수 없습니다.
        </Alert>
      )}
    </div>
  );

  // ─── 에디터 패널 (우측 / 모바일 하단) ───
  const editorPanel = isActive ? (
    <CodeEditor
      code={code}
      language={language}
      onCodeChange={handleCodeChange}
      onLanguageChange={handleLanguageChange}
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      autoSaveStatus={autoSaveStatus}
      deadline={problem.deadline}
      editorHeight="calc(100vh - 16rem)"
    />
  ) : null;

  return (
    <AppLayout className="lg:!max-w-none lg:!px-4">
      {/* 데스크톱(lg+): 좌우 스플릿뷰 / 모바일: 세로 스택 */}
      <div className="lg:flex lg:gap-5 lg:items-start">
        {/* 좌측: 문제 정보 (데스크톱에서 고정 폭, 스크롤) */}
        <div className="lg:w-[420px] lg:shrink-0 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:pr-1">
          {problemPanel}
        </div>

        {/* 우측: 코드 에디터 (데스크톱에서 나머지 공간) */}
        {editorPanel && (
          <div className="flex-1 min-w-0 mt-5 lg:mt-0">
            {editorPanel}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
