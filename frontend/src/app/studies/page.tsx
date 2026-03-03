/**
 * @file 스터디 목록 페이지 (v2 디자인 시스템)
 * @domain study
 * @layer page
 * @related StudyContext, studyApi, AppLayout
 */

'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Users, Plus, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { AppLayout } from '@/components/layout/AppLayout';
import { useStudy, type Study } from '@/contexts/StudyContext';
import { studyApi, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useRequireAuth } from '@/hooks/useRequireAuth';

// ─── HELPERS ─────────────────────────────

/**
 * 스터디 카드 내 멤버 수 표시 텍스트
 * @domain study
 */
function formatMemberCount(count?: number): string {
  if (count === undefined) return '';
  return `${count}명`;
}

// ─── RENDER ──────────────────────────────

/**
 * 스터디 목록 페이지 — 참여 중인 스터디 + 초대코드 가입
 * @domain study
 */
export default function StudiesPage(): ReactNode {
  const router = useRouter();
  const { isAuthenticated } = useRequireAuth();
  const { setCurrentStudy, setStudies } = useStudy();

  // ─── STATE ─────────────────────────────
  const [studies, setLocalStudies] = useState<Study[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [joinCode, setJoinCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // 닉네임 팝업
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [verifiedStudyName, setVerifiedStudyName] = useState('');
  const [joinNickname, setJoinNickname] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [joinModalError, setJoinModalError] = useState<string | null>(null);

  // ─── API ───────────────────────────────

  /**
   * 스터디 목록 로드
   * @domain study
   */
  const loadStudies = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await studyApi.list();
      setLocalStudies(data);
      setStudies(data);
    } catch {
      setError('스터디 목록을 불러오는 데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [setStudies]);

  // ─── EFFECTS ───────────────────────────

  useEffect(() => {
    if (isAuthenticated) {
      void loadStudies();
    }
  }, [isAuthenticated, loadStudies]);

  // ─── HANDLERS ──────────────────────────

  /**
   * 스터디 카드 클릭 → 스터디 상세 이동
   * @domain study
   */
  const handleStudyClick = useCallback(
    (study: Study) => {
      router.push(`/studies/${study.id}`);
    },
    [router],
  );

  /**
   * 스터디 선택 (대시보드 이동)
   * @domain study
   */
  const handleSelectStudy = useCallback(
    (study: Study) => {
      setCurrentStudy(study.id);
      router.push('/dashboard');
    },
    [setCurrentStudy, router],
  );

  /**
   * 1단계: 초대코드 검증 → 유효하면 닉네임 팝업
   * @domain study
   */
  const handleVerify = useCallback(async () => {
    if (!joinCode.trim()) return;
    setJoinError(null);
    setIsVerifying(true);
    try {
      const result = await studyApi.verifyInvite(joinCode.trim());
      setVerifiedStudyName(result.studyName);
      setJoinNickname('');
      setJoinModalError(null);
      setShowNicknameModal(true);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setJoinError(err.message);
      } else {
        setJoinError('초대 코드 확인에 실패했습니다.');
      }
    } finally {
      setIsVerifying(false);
    }
  }, [joinCode]);

  /**
   * 2단계: 닉네임 입력 후 실제 가입
   * @domain study
   */
  const handleJoin = useCallback(async () => {
    if (!joinNickname.trim()) {
      setJoinModalError('닉네임을 입력해주세요.');
      return;
    }
    setJoinModalError(null);
    setIsJoining(true);
    try {
      const joined = await studyApi.join(joinCode.trim(), joinNickname.trim());
      const updated = [...studies, joined];
      setLocalStudies(updated);
      setStudies(updated);
      setCurrentStudy(joined.id);
      setShowNicknameModal(false);
      router.push(`/studies/${joined.id}`);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setJoinModalError(err.message);
      } else {
        setJoinModalError('스터디 가입에 실패했습니다.');
      }
    } finally {
      setIsJoining(false);
    }
  }, [joinCode, joinNickname, studies, setStudies, setCurrentStudy, router]);

  return (
    <AppLayout>
      <div className="mx-auto max-w-2xl space-y-6">
        {/* 페이지 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-bold tracking-tight text-text">내 스터디</h1>
            <p className="mt-0.5 text-sm text-text-2">
              참여 중인 스터디를 선택하거나 새로 만드세요.
            </p>
          </div>
          <Button variant="primary" size="sm" asChild>
            <Link href="/studies/create">
              <Plus className="h-3.5 w-3.5" aria-hidden />
              스터디 만들기
            </Link>
          </Button>
        </div>

        {/* 에러 */}
        {error && (
          <Alert variant="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* 스터디 목록 */}
        {isLoading ? (
          <div className="space-y-3">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : studies.length === 0 ? (
          <EmptyState
            icon={Users}
            title="참여 중인 스터디가 없습니다"
            description="새 스터디를 만들거나 초대 코드로 가입하세요."
            action={{
              label: '스터디 만들기',
              onClick: () => router.push('/studies/create'),
            }}
          />
        ) : (
          <div className="space-y-3">
            {studies.map((study) => (
              <Card
                key={study.id}
                className="cursor-pointer transition-all hover:border-primary/50 hover:shadow-hover"
              >
                <CardContent className="flex items-center justify-between py-4">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => handleStudyClick(study)}
                  >
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium text-text">
                        {study.name}
                      </p>
                      <Badge
                        variant={study.role === 'ADMIN' ? 'info' : 'default'}
                      >
                        {study.role === 'ADMIN' ? '관리자' : '멤버'}
                      </Badge>
                    </div>
                    {study.description && (
                      <p className="mt-1 truncate text-sm text-text-2">
                        {study.description}
                      </p>
                    )}
                    {study.memberCount !== undefined && (
                      <p className="mt-1 text-xs text-text-3">
                        <Users
                          className="mr-1 inline-block h-3 w-3"
                          aria-hidden
                        />
                        {formatMemberCount(study.memberCount)}
                      </p>
                    )}
                  </button>
                  <div className="ml-3 flex shrink-0 items-center gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleSelectStudy(study)}
                    >
                      선택
                      <ArrowRight className="h-3 w-3" aria-hidden />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* 초대 코드로 가입 */}
        <Card>
          <CardContent className="space-y-3 py-4">
            <p className="text-sm font-medium text-text">초대 코드로 가입</p>
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <Input
                  placeholder="초대 코드 입력"
                  value={joinCode}
                  onChange={(e) => {
                    setJoinCode(e.target.value);
                    setJoinError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleVerify();
                  }}
                  disabled={isVerifying}
                />
                <p
                  className={cn(
                    'mt-1 min-h-[18px] text-[11px]',
                    joinError ? 'text-error' : 'text-transparent',
                  )}
                >
                  {joinError ?? '\u00A0'}
                </p>
              </div>
              <Button
                variant="primary"
                size="md"
                disabled={isVerifying || !joinCode.trim()}
                onClick={() => void handleVerify()}
              >
                {isVerifying ? '확인 중...' : '가입'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 닉네임 입력 팝업 */}
        {showNicknameModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur-sm">
            <Card className="mx-4 w-full max-w-sm">
              <CardContent className="space-y-4 py-5">
                <div>
                  <p className="text-sm font-semibold text-text">스터디 가입</p>
                  <p className="mt-1 text-xs text-text-2">
                    <span className="font-medium text-primary">{verifiedStudyName}</span>에서 사용할 닉네임을 입력해주세요.
                  </p>
                </div>
                <Input
                  placeholder="닉네임 입력"
                  value={joinNickname}
                  onChange={(e) => {
                    setJoinNickname(e.target.value);
                    setJoinModalError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleJoin();
                  }}
                  disabled={isJoining}
                  autoFocus
                />
                {joinModalError && (
                  <p className="text-[11px] text-error">{joinModalError}</p>
                )}
                <div className="flex gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1"
                    onClick={() => setShowNicknameModal(false)}
                    disabled={isJoining}
                  >
                    취소
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    className="flex-1"
                    disabled={isJoining || !joinNickname.trim()}
                    onClick={() => void handleJoin()}
                  >
                    {isJoining ? '가입 중...' : '가입하기'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
