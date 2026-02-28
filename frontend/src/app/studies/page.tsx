'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { AppLayout } from '@/components/layout/AppLayout';
import { useStudy, type Study } from '@/contexts/StudyContext';
import { studyApi, ApiError } from '@/lib/api';

export default function StudiesPage(): ReactNode {
  const router = useRouter();
  const { setCurrentStudy, setStudies } = useStudy();

  const [studies, setLocalStudies] = useState<Study[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [joinCode, setJoinCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const loadStudies = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await studyApi.list();
      setLocalStudies(data);
      setStudies(data);
    } catch {
      setError('스터디 목록을 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [setStudies]);

  useEffect(() => {
    void loadStudies();
  }, [loadStudies]);

  const handleSelectStudy = useCallback(
    (study: Study) => {
      setCurrentStudy(study.id);
      router.push('/problems');
    },
    [setCurrentStudy, router],
  );

  const handleJoin = useCallback(async () => {
    if (!joinCode.trim()) return;
    setJoinError(null);
    setIsJoining(true);
    try {
      const joined = await studyApi.join(joinCode.trim());
      const updated = [...studies, joined];
      setLocalStudies(updated);
      setStudies(updated);
      setCurrentStudy(joined.id);
      router.push('/problems');
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 404) {
        setJoinError('유효하지 않은 초대 코드입니다.');
      } else {
        setJoinError('스터디 가입에 실패했습니다. 다시 시도해주세요.');
      }
    } finally {
      setIsJoining(false);
    }
  }, [joinCode, studies, setStudies, setCurrentStudy, router]);

  return (
    <AppLayout>
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">내 스터디</h1>
            <p className="mt-0.5 text-sm text-text2">참여 중인 스터디를 선택하세요.</p>
          </div>
          <Button variant="primary" size="sm" asChild>
            <Link href="/studies/create">새 스터디 만들기</Link>
          </Button>
        </div>

        {error && (
          <Alert variant="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : studies.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <p className="text-sm text-text2">아직 참여 중인 스터디가 없습니다.</p>
              <p className="mt-1 text-sm text-text3">새 스터디를 만들거나 초대 코드로 가입하세요.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {studies.map((study) => (
              <Card key={study.id} className="cursor-pointer transition-colors hover:border-primary-500/50">
                <CardContent className="flex items-center justify-between py-4">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => router.push(`/studies/${study.id}`)}
                  >
                    <p className="truncate font-medium text-foreground">{study.name}</p>
                    {study.description && (
                      <p className="mt-0.5 truncate text-sm text-text2">{study.description}</p>
                    )}
                  </button>
                  <div className="flex items-center gap-2 ml-3 shrink-0">
                    <Badge variant={study.role === 'OWNER' ? 'info' : 'default'}>
                      {study.role === 'OWNER' ? '방장' : '멤버'}
                    </Badge>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleSelectStudy(study)}
                    >
                      선택
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* 초대 코드로 가입 */}
        <div className="rounded-card border border-border bg-bg2 p-4">
          <p className="mb-3 text-sm font-medium text-foreground">초대 코드로 가입</p>
          <div className="flex gap-2">
            <Input
              placeholder="초대 코드 입력"
              value={joinCode}
              onChange={(e) => {
                setJoinCode(e.target.value);
                setJoinError(null);
              }}
              error={joinError ?? undefined}
              disabled={isJoining}
              className="flex-1"
            />
            <Button
              variant="secondary"
              size="md"
              disabled={isJoining || !joinCode.trim()}
              onClick={() => void handleJoin()}
            >
              {isJoining ? '가입 중...' : '가입'}
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
