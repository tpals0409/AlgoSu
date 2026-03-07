/**
 * @file 스터디룸 -- 문제 > 제출 > 리뷰 전환 페이지
 * @domain study
 * @layer page
 * @related AppLayout, StudyContext, problemApi, submissionApi, studyNoteApi
 *
 * 스터디 멤버들이 문제 -> 제출 -> 리뷰 흐름을 한눈에 볼 수 있는 전환 페이지.
 * @guard study-member 스터디 멤버 확인
 * @guard cookie-auth httpOnly Cookie JWT 인증
 */

'use client';

import { useState, useEffect, useCallback, type ReactElement } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Code2,
  Users,
  ChevronRight,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useStudy } from '@/contexts/StudyContext';
import {
  problemApi,
  submissionApi,
  studyApi,
  ApiError,
  type Problem,
  type Submission,
} from '@/lib/api';
import { DiffBadge } from '@/components/ui/DiffBadge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LangBadge } from '@/components/ui/LangBadge';
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton';
import { StudyNoteEditor } from '@/components/review/StudyNoteEditor';
import { getAvatarPresetKey, getAvatarSrc } from '@/lib/avatars';

// ─── TYPES ────────────────────────────────

type DiffTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'ruby' | 'unrated';

// ─── HELPERS ──────────────────────────────

/** API difficulty -> DiffBadge tier 변환 */
function toTier(diff: Problem['difficulty']): DiffTier {
  return diff.toLowerCase() as DiffTier;
}

/** 마감까지 남은 시간 텍스트 */
function getTimeRemaining(deadline: string): string | null {
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return null;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 24) return `${hours}시간`;
  const days = Math.floor(hours / 24);
  return `${days}일`;
}

/** sagaStep -> 상태 라벨 + variant */
function getSagaStatus(
  step: Submission['sagaStep'],
): { label: string; variant: 'success' | 'warning' | 'error' | 'muted' } {
  switch (step) {
    case 'DONE':
      return { label: '분석 완료', variant: 'success' };
    case 'AI_QUEUED':
      return { label: '분석 중', variant: 'warning' };
    case 'GITHUB_QUEUED':
      return { label: 'GitHub 동기화 중', variant: 'warning' };
    case 'FAILED':
      return { label: '실패', variant: 'error' };
    default:
      return { label: '대기', variant: 'muted' };
  }
}

// ─── COMPONENT ────────────────────────────

/**
 * 스터디룸 페이지 -- 문제 목록 > 제출 목록 > 리뷰 이동
 * @domain study
 */
export default function StudyRoomPage(): ReactElement {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { currentStudyId, setCurrentStudy } = useStudy();

  // ─── STATE ──────────────────────────────
  const [problems, setProblems] = useState<Problem[]>([]);
  const [selectedProblem, setSelectedProblem] = useState<Problem | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loadingProblems, setLoadingProblems] = useState(true);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notSubmitted, setNotSubmitted] = useState(false);
  const [nicknameMap, setNicknameMap] = useState<Record<string, string>>({});
  const [avatarMap, setAvatarMap] = useState<Record<string, string | null>>({});

  const studyId = params.id;

  // 스터디 ID 동기화
  useEffect(() => {
    if (studyId && studyId !== currentStudyId) {
      setCurrentStudy(studyId);
    }
  }, [studyId, currentStudyId, setCurrentStudy]);

  // ─── EFFECTS ────────────────────────────

  /** 문제 목록 로드 (studyId 동기화 완료 후) */
  useEffect(() => {
    if (!isAuthenticated || authLoading || !currentStudyId) return;
    let cancelled = false;
    setLoadingProblems(true);
    setError(null);

    problemApi.findAll()
      .then((data) => {
        if (!cancelled) setProblems(data);
      })
      .catch(() => {
        if (!cancelled) setError('문제 목록을 불러오지 못했습니다.');
      })
      .finally(() => {
        if (!cancelled) setLoadingProblems(false);
      });

    if (currentStudyId) {
      studyApi.getMembers(currentStudyId).then((members) => {
        if (cancelled) return;
        const nMap: Record<string, string> = {};
        const aMap: Record<string, string | null> = {};
        for (const m of members) {
          if (m.nickname) nMap[m.user_id] = m.nickname;
          else if (m.username) nMap[m.user_id] = m.username;
          aMap[m.user_id] = m.avatar_url ?? null;
        }
        setNicknameMap(nMap);
        setAvatarMap(aMap);
      }).catch(() => {});
    }

    return () => { cancelled = true; };
  }, [isAuthenticated, authLoading, currentStudyId]);

  /** 선택된 문제의 제출 목록 로드 */
  const loadSubmissions = useCallback(async (problem: Problem): Promise<void> => {
    setLoadingSubmissions(true);
    setNotSubmitted(false);
    try {
      const data = await submissionApi.listByProblemForStudy(problem.id);
      // userId별 최신 제출만 필터 (백엔드가 createdAt DESC 정렬)
      const latestByUser = data.filter((sub, idx, arr) =>
        arr.findIndex((s) => s.userId === sub.userId) === idx,
      );
      setSubmissions(latestByUser);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setNotSubmitted(true);
        setSubmissions([]);
      } else {
        setError('제출 목록을 불러오지 못했습니다.');
        setSubmissions([]);
      }
    } finally {
      setLoadingSubmissions(false);
    }
  }, []);

  // ─── HANDLERS ───────────────────────────

  const handleSelectProblem = (problem: Problem): void => {
    setSelectedProblem(problem);
    void loadSubmissions(problem);
  };

  const handleBack = (): void => {
    setSelectedProblem(null);
    setSubmissions([]);
    setNotSubmitted(false);
  };

  const handleGoToReview = (submissionId: string): void => {
    router.push(`/reviews/${submissionId}`);
  };

  // ─── RENDER ─────────────────────────────

  if (authLoading) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-3xl space-y-4 py-8">
          <Skeleton height={32} width="40%" />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </AppLayout>
    );
  }

  if (!isAuthenticated) {
    router.push('/login');
    return (
      <AppLayout>
        <div className="flex min-h-[50vh] items-center justify-center">
          <Skeleton height={32} width="40%" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl py-4">
        {/* 에러 상태 */}
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-card border border-error bg-error-soft px-4 py-3">
            <AlertCircle className="h-4 w-4 text-error" />
            <span className="text-xs text-error">{error}</span>
          </div>
        )}

        {selectedProblem ? (
          /* 제출 목록 + 스터디 노트 */
          <div className="animate-fade-in">
            {/* 뒤로가기 */}
            <button
              type="button"
              onClick={handleBack}
              className="mb-3 flex items-center gap-1 text-xs text-text-3 transition-colors hover:text-text"
            >
              <ChevronRight className="h-3.5 w-3.5 rotate-180" />
              문제 목록
            </button>

            {/* 문제 헤더 */}
            <div className="mb-6 text-center">
              <h1 className="text-[22px] font-bold tracking-tight text-text">
                {selectedProblem.title}
              </h1>
              <div className="mt-2 flex items-center justify-center gap-2">
                <DiffBadge tier={toTier(selectedProblem.difficulty)} level={selectedProblem.level} />
                <StatusBadge
                  label={selectedProblem.weekNumber}
                  variant="info"
                />
              </div>
            </div>

            {/* 제출 목록 카드 */}
            <div className="mb-5 overflow-hidden rounded-card border border-border bg-bg-card shadow-card">
              <div className="flex items-center gap-2 border-b border-border px-5 py-3">
                <Users className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-text">
                  제출 목록
                </span>
                <span className="rounded-badge bg-primary-soft px-2 py-0.5 text-[10px] font-medium text-primary">
                  {submissions.length}건
                </span>
              </div>

              {loadingSubmissions ? (
                <div className="space-y-3 p-5">
                  <Skeleton height={48} />
                  <Skeleton height={48} />
                  <Skeleton height={48} />
                </div>
              ) : notSubmitted ? (
                <div className="py-10 text-center">
                  <Code2 className="mx-auto mb-2 h-6 w-6 text-primary opacity-60" />
                  <p className="text-sm font-medium text-text">문제를 먼저 제출해주세요</p>
                  <p className="mt-1 text-xs text-text-3">
                    제출 후 다른 스터디원의 풀이를 볼 수 있습니다
                  </p>
                </div>
              ) : submissions.length === 0 ? (
                <div className="py-10 text-center">
                  <Code2 className="mx-auto mb-2 h-6 w-6 text-text-3 opacity-40" />
                  <p className="text-xs text-text-3">아직 제출이 없습니다</p>
                </div>
              ) : (
                submissions.map((sub, idx) => {
                  const saga = getSagaStatus(sub.sagaStep);
                  return (
                    <div
                      key={sub.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleGoToReview(sub.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleGoToReview(sub.id);
                      }}
                      className={cn(
                        'flex cursor-pointer items-center justify-between px-5 py-3.5 transition-colors hover:bg-primary-soft',
                        idx < submissions.length - 1 && 'border-b border-border',
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={sub.userId && avatarMap[sub.userId]
                            ? getAvatarSrc(getAvatarPresetKey(avatarMap[sub.userId]))
                            : getAvatarSrc('default')}
                          alt=""
                          className="h-8 w-8 rounded-full object-cover"
                        />
                        <div>
                          <div className="text-[13px] font-medium text-text">
                            {(sub.userId && nicknameMap[sub.userId]) ? nicknameMap[sub.userId] : '익명'}
                          </div>
                          <div className="mt-0.5 flex items-center gap-1 text-[11px] text-text-3">
                            <LangBadge language={sub.language} />
                            <span className="opacity-30">|</span>
                            {new Date(sub.createdAt).toLocaleDateString('ko-KR', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge
                          label={saga.label}
                          variant={saga.variant}
                        />
                        <ChevronRight className="h-3.5 w-3.5 text-text-3" />
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* 스터디 노트 */}
            <StudyNoteEditor problemId={selectedProblem.id} />
          </div>
        ) : (
          /* 문제 목록 */
          <div className="animate-fade-in">
            <div className="mb-6 text-center">
              <h1 className="text-[22px] font-bold tracking-tight text-text">
                코드 리뷰
              </h1>
              <p className="mt-1 text-[13px] text-text-3">
                문제별로 스터디원들의 풀이를 확인하고 리뷰하세요
              </p>
            </div>

            {/* 안내 배너 */}
            <div className="mb-4 flex items-center gap-2 rounded-card border border-info/30 bg-info-soft px-4 py-2.5">
              <AlertCircle className="h-3.5 w-3.5 text-info" />
              <span className="text-xs text-text-2">
                마감 전 코드는 본인만 볼 수 있으며, 마감 후 전체 공개됩니다.
              </span>
            </div>

            {/* 문제 카드 리스트 */}
            {loadingProblems ? (
              <div className="space-y-3">
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </div>
            ) : problems.length === 0 ? (
              <div className="rounded-card border border-border bg-bg-card py-16 text-center shadow-card">
                <Code2 className="mx-auto mb-3 h-8 w-8 text-text-3 opacity-40" />
                <p className="text-sm text-text-3">등록된 문제가 없습니다</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {problems.map((p) => {
                  const isClosed = p.status === 'CLOSED';
                  const timeLeft = getTimeRemaining(p.deadline);

                  return (
                    <div
                      key={p.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleSelectProblem(p)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSelectProblem(p);
                      }}
                      className={cn(
                        'flex items-center justify-between rounded-card border border-border bg-bg-card px-5 py-4 shadow-card transition-all',
                        'cursor-pointer hover:-translate-y-0.5 hover:shadow-hover',
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-badge bg-primary-soft text-primary">
                          <Code2 className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-text">
                            {p.title}
                          </div>
                          <div className="mt-1 flex gap-1.5">
                            <DiffBadge
                              tier={toTier(p.difficulty)}
                              level={p.level}
                            />
                            <StatusBadge
                              label={p.weekNumber}
                              variant="info"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {!isClosed && timeLeft && (
                          <span className="flex items-center gap-1 rounded-badge bg-warning-soft px-2.5 py-0.5 text-[11px] font-medium text-warning">
                            <Clock className="h-3 w-3" />
                            {timeLeft}
                          </span>
                        )}
                        <ChevronRight className="h-3.5 w-3.5 text-text-3" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
