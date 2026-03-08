/**
 * @file 스터디 목록 페이지 (v3 Figma 디자인)
 * @domain study
 * @layer page
 * @related StudyContext, studyApi, AppLayout
 */

'use client';

import { useState, useEffect, useCallback, type ReactNode, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Users, Plus, ArrowRight, Crown, Settings } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { InlineSpinner } from '@/components/ui/LoadingSpinner';
import { AppLayout } from '@/components/layout/AppLayout';
import { useStudy, type Study } from '@/contexts/StudyContext';
import { studyApi, ApiError } from '@/lib/api';
import { studyCreateSchema, type StudyCreateFormData } from '@/lib/schemas/study';
import { cn } from '@/lib/utils';
import { useRequireAuth } from '@/hooks/useRequireAuth';

// ─── HELPERS ─────────────────────────────

/**
 * 스터디 이름의 첫 글자를 아바타용으로 추출
 * @domain study
 */
function getInitial(name: string): string {
  return name.charAt(0);
}

// ─── RENDER ──────────────────────────────

/**
 * 스터디 목록 페이지 — 내 스터디 + 스터디 탐색 탭
 * @domain study
 */
export default function StudiesPage(): ReactNode {
  const router = useRouter();
  const { isAuthenticated } = useRequireAuth();
  const { setCurrentStudy, setStudies } = useStudy();

  // ─── MOUNT ANIMATION ───────────────────
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const fade = (delay = 0): CSSProperties => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'translateY(0)' : 'translateY(16px)',
    transition: `opacity .5s cubic-bezier(.16,1,.3,1) ${delay}s, transform .5s cubic-bezier(.16,1,.3,1) ${delay}s`,
  });

  // ─── STATE ─────────────────────────────
  const [activeTab, setActiveTab] = useState<'my' | 'explore'>('my');
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

  // 스터디 생성 모달
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createApiError, setCreateApiError] = useState<string | null>(null);
  const createForm = useForm<StudyCreateFormData>({
    resolver: zodResolver(studyCreateSchema),
    defaultValues: { name: '', description: '', nickname: '' },
  });

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
   * 스터디 카드 "자세히 보기" → 스터디 상세 이동
   * @domain study
   */
  const handleStudyClick = useCallback(
    (study: Study) => {
      router.push(`/studies/${study.id}`);
    },
    [router],
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

  /**
   * 스터디 생성 제출
   * @domain study
   */
  const handleCreate = useCallback(async (data: StudyCreateFormData) => {
    setCreateApiError(null);
    try {
      const created = await studyApi.create({
        name: data.name.trim(),
        description: data.description?.trim() || undefined,
        nickname: data.nickname.trim(),
      });
      const withRole = { ...created, role: 'ADMIN' as const };
      const updated = [...studies, withRole];
      setLocalStudies(updated);
      setStudies(updated);
      setCurrentStudy(created.id);
      setShowCreateModal(false);
      createForm.reset();
      router.push(`/studies/${created.id}`);
    } catch {
      setCreateApiError('스터디 생성에 실패했습니다. 다시 시도해주세요.');
    }
  }, [studies, setStudies, setCurrentStudy, createForm, router]);

  const openCreateModal = useCallback(() => {
    createForm.reset();
    setCreateApiError(null);
    setShowCreateModal(true);
  }, [createForm]);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* 페이지 헤더 */}
        <div style={fade(0)}>
          <h1 className="text-[22px] font-bold tracking-tight text-text">내 스터디</h1>
          <p className="mt-0.5 text-sm text-text-2">
            참여 중인 스터디를 관리하세요.
          </p>
        </div>

        {/* 탭 네비게이션 */}
        <div className="flex gap-2" style={fade(0.06)}>
          <button
            type="button"
            className={cn(
              'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
              activeTab === 'my'
                ? 'bg-primary text-white'
                : 'text-text-2 hover:text-text',
            )}
            onClick={() => setActiveTab('my')}
          >
            내 스터디
          </button>
          <button
            type="button"
            className={cn(
              'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
              activeTab === 'explore'
                ? 'bg-primary text-white'
                : 'text-text-2 hover:text-text',
            )}
            onClick={() => setActiveTab('explore')}
          >
            스터디 탐색
          </button>
        </div>

        {/* 에러 */}
        {error && (
          <Alert variant="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* ── 내 스터디 탭 ── */}
        {activeTab === 'my' && (
          <>
            {isLoading ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2" style={fade(0.12)}>
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
                  onClick: openCreateModal,
                }}
              />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2" style={fade(0.12)}>
                {studies.map((study) => (
                  <Card
                    key={study.id}
                    className="flex flex-col overflow-hidden p-0 transition-all hover:border-primary/50 hover:shadow-hover"
                  >
                    <CardContent className="flex flex-1 flex-col gap-3 p-5 pb-0">
                      {/* 상단: 아바타 + 이름/뱃지/멤버수 + 설정 */}
                      <div className="flex items-start gap-3">
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
                          style={{ backgroundColor: 'var(--primary)' }}
                        >
                          {getInitial(study.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate font-semibold text-text">
                              {study.name}
                            </p>
                            {study.role === 'ADMIN' ? (
                              <Badge className="bg-bg-alt text-text-2">
                                <Crown className="h-3 w-3" aria-hidden />
                                관리자
                              </Badge>
                            ) : (
                              <Badge className="bg-bg-alt text-text-2">
                                멤버
                              </Badge>
                            )}
                          </div>
                          {study.memberCount !== undefined && (
                            <p className="mt-0.5 text-xs text-text-3">
                              {study.memberCount}명 참여
                            </p>
                          )}
                        </div>
                        {study.role === 'ADMIN' && (
                          <button
                            type="button"
                            className="shrink-0 rounded-lg p-1.5 text-text-3 transition-colors hover:bg-bg-alt hover:text-text"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/studies/${study.id}/settings`);
                            }}
                            aria-label="스터디 설정"
                          >
                            <Settings className="h-4 w-4" aria-hidden />
                          </button>
                        )}
                      </div>

                      {/* 설명 */}
                      {study.description && (
                        <p className="truncate text-sm text-text-2">
                          {study.description}
                        </p>
                      )}
                    </CardContent>

                    {/* 자세히 보기 버튼 */}
                    <button
                      type="button"
                      className="mt-3 flex w-full items-center justify-center gap-1 py-3 text-sm font-medium text-white transition-colors hover:opacity-90"
                      style={{ backgroundColor: 'var(--primary)' }}
                      onClick={() => handleStudyClick(study)}
                    >
                      자세히 보기
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </Card>
                ))}

                {/* 새 스터디 만들기 카드 */}
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border py-10 text-text-3 transition-colors hover:border-primary/50 hover:text-primary"
                >
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-full"
                    style={{ backgroundColor: 'var(--primary-soft)' }}
                  >
                    <Plus className="h-5 w-5" style={{ color: 'var(--primary)' }} aria-hidden />
                  </div>
                  <span className="text-sm font-medium">새 스터디 만들기</span>
                </button>
              </div>
            )}
          </>
        )}

        {/* ── 스터디 탐색 탭 ── */}
        {activeTab === 'explore' && (
          <Card style={fade(0.12)}>
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
        )}

        {/* 스터디 생성 모달 */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur-sm">
            <Card className="mx-4 w-full max-w-sm">
              <form onSubmit={(e) => void createForm.handleSubmit(handleCreate)(e)} noValidate>
                <CardContent className="space-y-4 py-5">
                  <div>
                    <p className="text-sm font-semibold text-text">새 스터디 만들기</p>
                    <p className="mt-1 text-xs text-text-2">
                      팀원들과 함께 알고리즘 문제를 풀어보세요
                    </p>
                  </div>

                  {createApiError && (
                    <Alert variant="error" onClose={() => setCreateApiError(null)}>
                      {createApiError}
                    </Alert>
                  )}

                  <Input
                    label="스터디 이름"
                    placeholder="예: 알고리즘 스터디 1기"
                    {...createForm.register('name')}
                    error={createForm.formState.errors.name?.message}
                    disabled={createForm.formState.isSubmitting}
                    autoFocus
                  />

                  <Input
                    label="닉네임"
                    placeholder="스터디 내에서 사용할 닉네임"
                    {...createForm.register('nickname')}
                    error={createForm.formState.errors.nickname?.message}
                    disabled={createForm.formState.isSubmitting}
                  />

                  <Input
                    label="설명 (선택)"
                    placeholder="스터디에 대한 간단한 설명"
                    {...createForm.register('description')}
                    disabled={createForm.formState.isSubmitting}
                  />

                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="flex-1"
                      disabled={createForm.formState.isSubmitting}
                      onClick={() => setShowCreateModal(false)}
                    >
                      취소
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                      className="flex-1"
                      disabled={createForm.formState.isSubmitting}
                    >
                      {createForm.formState.isSubmitting ? (
                        <>
                          <InlineSpinner />
                          생성 중...
                        </>
                      ) : (
                        '스터디 만들기'
                      )}
                    </Button>
                  </div>
                </CardContent>
              </form>
            </Card>
          </div>
        )}

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
