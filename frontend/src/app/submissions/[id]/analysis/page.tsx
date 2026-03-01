'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Brain, Code2, Trophy, Loader2 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Skeleton } from '@/components/ui/Skeleton';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useAuth } from '@/contexts/AuthContext';
import { submissionApi, type AnalysisResult, type Submission } from '@/lib/api';

function ScoreGauge({ score }: { readonly score: number }): ReactNode {
  let color = 'text-error';
  let bgColor = 'bg-[rgba(255,90,80,0.22)]';
  if (score >= 80) {
    color = 'text-success';
    bgColor = 'bg-[rgba(80,200,120,0.22)]';
  } else if (score >= 60) {
    color = 'text-[var(--color-warning)]';
    bgColor = 'bg-[rgba(255,200,60,0.22)]';
  } else if (score >= 40) {
    color = 'text-[var(--color-main)]';
    bgColor = 'bg-[rgba(148,126,176,0.22)]';
  }

  return (
    <div className="flex items-center gap-3">
      <div
        className={`flex items-center justify-center rounded-full ${bgColor}`}
        style={{ width: '56px', height: '56px' }}
      >
        <span className={`text-lg font-bold ${color}`}>{score}</span>
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">
          {score >= 80 ? '우수' : score >= 60 ? '양호' : score >= 40 ? '보통' : '개선 필요'}
        </p>
        <p className="font-mono text-[10px] text-muted-foreground">100점 만점</p>
      </div>
    </div>
  );
}

export default function AnalysisPage(): ReactNode {
  const params = useParams();
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const submissionId = params.id as string;

  const [submission, setSubmission] = useState<Submission | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [sub, analysisResult] = await Promise.all([
        submissionApi.findById(submissionId),
        submissionApi.getAnalysis(submissionId),
      ]);
      setSubmission(sub);
      setAnalysis(analysisResult);
    } catch (err: unknown) {
      setError((err as Error).message ?? 'AI 분석 결과를 불러오는 데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [submissionId]);

  useEffect(() => {
    if (isAuthenticated && submissionId) {
      void loadData();
    }
  }, [isAuthenticated, submissionId, loadData]);

  if (authLoading) return null;
  if (!isAuthenticated) return null;

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* 뒤로가기 + 헤더 */}
        <div className="flex items-center gap-3">
          <Link
            href="/submissions"
            className="flex items-center justify-center rounded-btn bg-bg2 text-muted-foreground transition-colors hover:text-foreground"
            style={{ width: '28px', height: '28px' }}
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          </Link>
          <div>
            <h1 className="text-base font-semibold text-foreground">AI 분석 결과</h1>
            <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
              {submission?.problemTitle ?? `제출 ${submissionId.slice(0, 8)}`}
            </p>
          </div>
        </div>

        {error && (
          <Alert variant="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* 로딩 */}
        {isLoading && (
          <div className="space-y-4">
            <Skeleton height={80} />
            <Skeleton height={200} />
            <Skeleton height={200} />
          </div>
        )}

        {/* 분석 대기 중 */}
        {!isLoading && analysis && analysis.analysisStatus === 'pending' && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
              <LoadingSpinner size="lg" />
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">AI 분석 중...</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  분석이 완료되면 결과가 표시됩니다. 잠시만 기다려주세요.
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => void loadData()}>
                새로고침
              </Button>
            </CardContent>
          </Card>
        )}

        {/* 분석 지연 */}
        {!isLoading && analysis && analysis.analysisStatus === 'delayed' && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="flex items-center justify-center rounded-full bg-[rgba(255,200,60,0.22)] p-4">
                <Loader2 className="h-8 w-8 text-[var(--color-warning)]" aria-hidden />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">분석 지연 중</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  AI 분석 서비스가 일시적으로 지연되고 있습니다. 잠시 후 다시 확인해주세요.
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => void loadData()}>
                새로고침
              </Button>
            </CardContent>
          </Card>
        )}

        {/* 분석 실패 */}
        {!isLoading && analysis && analysis.analysisStatus === 'failed' && (
          <Alert variant="error" title="분석 실패">
            AI 분석 중 오류가 발생했습니다. 코드를 다시 제출하거나 관리자에게 문의해주세요.
          </Alert>
        )}

        {/* 분석 완료 */}
        {!isLoading && analysis && analysis.analysisStatus === 'completed' && (
          <div className="space-y-4">
            {/* 점수 카드 */}
            {analysis.score !== null && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-[var(--color-warning)]" aria-hidden />
                    점수
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScoreGauge score={analysis.score} />
                </CardContent>
              </Card>
            )}

            {/* 피드백 카드 */}
            {analysis.feedback && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-4 w-4 text-primary" aria-hidden />
                    AI 피드백
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none text-foreground dark:prose-invert">
                    {analysis.feedback.split('\n').map((line, i) => (
                      <p key={i} className="text-sm leading-relaxed text-text2">
                        {line || '\u00A0'}
                      </p>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 최적화 코드 카드 */}
            {analysis.optimizedCode && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Code2 className="h-4 w-4 text-success" aria-hidden />
                    최적화 코드
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto rounded-md bg-bg2 p-4">
                    <pre className="font-mono text-[12px] leading-relaxed text-foreground">
                      <code>{analysis.optimizedCode}</code>
                    </pre>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 제출 정보 */}
            {submission && (
              <Card>
                <CardContent className="flex items-center gap-4 text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">언어:</span>
                    <Badge variant="info">{submission.language}</Badge>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">상태:</span>
                    <Badge variant="success" dot>완료</Badge>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">제출일:</span>
                    <span className="font-mono text-muted-foreground">
                      {new Date(submission.createdAt).toLocaleString('ko-KR')}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
