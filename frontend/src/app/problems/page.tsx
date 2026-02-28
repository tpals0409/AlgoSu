'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { DifficultyBadge } from '@/components/ui/DifficultyBadge';
import { TimerBadge } from '@/components/ui/TimerBadge';
import { Alert } from '@/components/ui/Alert';
import { EmptyState } from '@/components/ui/EmptyState';
import { problemApi, type Problem } from '@/lib/api';

export default function ProblemsPage(): ReactNode {
  const router = useRouter();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadProblems = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await problemApi.findAll();
      setProblems(data);
    } catch (err: unknown) {
      setError((err as Error).message ?? '문제 목록을 불러오는 데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProblems();
  }, [loadProblems]);

  const handleProblemClick = useCallback(
    (id: string): void => {
      router.push(`/problems/${id}`);
    },
    [router],
  );

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* 헤더 */}
        <div>
          <h1 className="text-base font-semibold text-foreground">문제 목록</h1>
          <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
            {problems.length > 0
              ? `${Math.ceil(problems.length / 5)}주차 · ${problems.length}개 문제`
              : '문제를 불러오는 중...'}
          </p>
        </div>

        {/* 에러 */}
        {error && (
          <Alert variant="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* 로딩 스켈레톤 */}
        {isLoading && (
          <Card>
            <div className="divide-y divide-border">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="animate-pulse h-12 bg-muted rounded mx-4 my-2" />
              ))}
            </div>
          </Card>
        )}

        {/* 빈 상태 */}
        {!isLoading && !error && problems.length === 0 && (
          <EmptyState
            icon={BookOpen}
            title="등록된 문제가 없습니다"
            description="곧 새로운 문제가 추가될 예정입니다."
            action={{ label: '새로고침', onClick: loadProblems }}
          />
        )}

        {/* 문제 목록 테이블 */}
        {!isLoading && problems.length > 0 && (
          <Card className="p-0">
            {/* 헤더 행 */}
            <div
              className="grid items-center gap-x-2.5 px-4 py-2 border-b border-border font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
              style={{ gridTemplateColumns: '28px 1fr auto auto auto' }}
            >
              <span>#</span>
              <span>문제</span>
              <span>난이도</span>
              <span>마감</span>
              <span>상태</span>
            </div>

            {/* 데이터 행 */}
            {problems.map((problem, index) => {
              const deadlineDate = problem.deadline ? new Date(problem.deadline) : null;
              const isExpired = deadlineDate ? deadlineDate < new Date() : true;
              const weekNumber = index + 1;

              return (
                <button
                  key={problem.id}
                  type="button"
                  onClick={() => handleProblemClick(problem.id)}
                  aria-label={`${problem.title} 문제 보기`}
                  className="grid items-center gap-x-2.5 w-full px-4 py-2.5 text-left border-b border-border last:border-b-0 hover:bg-muted/40 transition-colors"
                  style={{ gridTemplateColumns: '28px 1fr auto auto auto' }}
                >
                  {/* # */}
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {String(weekNumber).padStart(2, '0')}
                  </span>

                  {/* 문제 제목 + 주차 */}
                  <div className="min-w-0">
                    <p className="text-[12px] font-medium text-foreground truncate">
                      {problem.title}
                    </p>
                    <p className="font-mono text-[10px] text-muted-foreground">
                      {weekNumber}주차
                    </p>
                  </div>

                  {/* 난이도 */}
                  <DifficultyBadge difficulty={problem.difficulty} />

                  {/* 마감 */}
                  <div>
                    {deadlineDate && !isExpired && problem.status === 'ACTIVE' ? (
                      <TimerBadge deadline={deadlineDate} />
                    ) : (
                      <span className="font-mono text-[10px] text-muted-foreground">—</span>
                    )}
                  </div>

                  {/* 상태 */}
                  <Badge variant={problem.status === 'ACTIVE' ? 'success' : 'muted'}>
                    {problem.status === 'ACTIVE' ? '진행 중' : '종료'}
                  </Badge>
                </button>
              );
            })}
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
