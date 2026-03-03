/**
 * @file 문제 상세 페이지 (v2 전면 교체)
 * @domain problem
 * @layer page
 * @related problemApi, DifficultyBadge, TimerBadge, AppLayout
 */

'use client';

import { useState, useEffect, use, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Pencil, Trash2, ExternalLink, Send } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { DifficultyBadge } from '@/components/ui/DifficultyBadge';
import { TimerBadge } from '@/components/ui/TimerBadge';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { problemApi, type Problem } from '@/lib/api';
import { useStudy } from '@/contexts/StudyContext';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useRequireStudy } from '@/hooks/useRequireStudy';
import type { Difficulty } from '@/lib/constants';

// ─── TYPES ────────────────────────────────

interface PageProps {
  readonly params: Promise<{ id: string }>;
}

// ─── RENDER ───────────────────────────────

/**
 * 문제 상세 페이지
 * @domain problem
 */
export default function ProblemDetailPage({ params }: PageProps): ReactNode {
  const { id: problemId } = use(params);
  const router = useRouter();
  const { isAuthenticated } = useRequireAuth();
  useRequireStudy();
  const { currentStudyRole } = useStudy();
  const isAdmin = currentStudyRole === 'ADMIN';

  // ─── STATE ──────────────────────────────

  const [problem, setProblem] = useState<Problem | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ─── EFFECTS ────────────────────────────

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;

    const load = async (): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await problemApi.findById(problemId);
        if (!cancelled) setProblem(data);
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

  // ─── LOADING ────────────────────────────

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-4">
          <Skeleton height={20} width="30%" />
          <Skeleton height={200} />
          <Skeleton height={100} />
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

  return (
    <AppLayout>
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
            {/* 설명 */}
            {problem.description && (
              <p className="text-sm leading-relaxed text-text-2 whitespace-pre-wrap">
                {problem.description}
              </p>
            )}

            {/* 태그 */}
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

            {/* 허용 언어 */}
            {problem.allowedLanguages && problem.allowedLanguages.length > 0 && (
              <div>
                <span className="block text-[11px] font-medium text-text-3 mb-1.5">허용 언어</span>
                <div className="flex flex-wrap gap-1.5">
                  {problem.allowedLanguages.map((lang) => (
                    <Badge key={lang} variant="muted">{lang}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* 출처 링크 */}
            {problem.sourceUrl && (
              <a
                href={problem.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {problem.sourcePlatform ?? '출처'} 에서 보기
              </a>
            )}
          </CardContent>
        </Card>

        {/* CTA 버튼 */}
        <div className="flex gap-3">
          {isActive && (
            <Button
              variant="primary"
              size="lg"
              className="flex-1"
              onClick={() => router.push(`/submit/${problemId}`)}
            >
              <Send />
              코드 제출
            </Button>
          )}
          <Button
            variant="ghost"
            size="lg"
            className={isActive ? '' : 'flex-1'}
            onClick={() => router.push(`/problems/${problemId}/status`)}
          >
            제출 현황
          </Button>
        </div>

        {/* 마감 안내 */}
        {!isActive && (
          <Alert variant="warning" title="제출 마감">
            이 문제는 마감되었습니다. 더 이상 제출할 수 없습니다.
          </Alert>
        )}
      </div>
    </AppLayout>
  );
}
