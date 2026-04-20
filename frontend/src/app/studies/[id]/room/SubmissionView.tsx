/**
 * @file 스터디룸 제출 현황 뷰 (2단계)
 * @domain study
 * @layer component
 * @related page.tsx, utils.ts
 */

'use client';

import { useState, useEffect, type ReactNode, type CSSProperties } from 'react';
import {
  Users,
  Sparkles,
  Code2,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  ExternalLink,
  ShieldAlert,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { DifficultyBadge } from '@/components/ui/DifficultyBadge';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { StudyNoteEditor } from '@/components/review/StudyNoteEditor';
import { getAvatarPresetKey, getAvatarSrc } from '@/lib/avatars';
import type { Problem, Submission } from '@/lib/api';
import { toTier, getSagaStatus } from './utils';

export interface SubmissionViewProps {
  readonly problem: Problem;
  readonly submissions: Submission[];
  readonly loading: boolean;
  readonly notSubmitted: boolean;
  readonly accessDenied: boolean;
  readonly nicknameMap: Record<string, string>;
  readonly avatarMap: Record<string, string | null>;
  readonly error: string | null;
  readonly totalMembers: number;
  readonly submittedCount: number;
  readonly analyzedCount: number;
  readonly onBack: () => void;
  readonly onSelectSubmission: (sub: Submission) => void;
  readonly onRetry: () => void;
}

export function SubmissionView({ problem, submissions, loading, notSubmitted, accessDenied, nicknameMap, avatarMap, error, totalMembers, submittedCount, analyzedCount, onBack, onSelectSubmission, onRetry }: SubmissionViewProps): ReactNode {
  const [viewMounted, setViewMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setViewMounted(true), 50); return () => clearTimeout(t); }, []);
  const vfade = (delay = 0): CSSProperties => ({
    opacity: viewMounted ? 1 : 0, transform: viewMounted ? 'translateY(0)' : 'translateY(16px)',
    transition: `opacity .5s cubic-bezier(.16,1,.3,1) ${delay}s, transform .5s cubic-bezier(.16,1,.3,1) ${delay}s`,
  });

  const tier = toTier(problem.difficulty);
  const pct = totalMembers > 0 ? (submittedCount / totalMembers) * 100 : 0;

  return (
    <div className="space-y-5">
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-card border border-error bg-error-soft px-4 py-3">
          <AlertCircle className="h-4 w-4 shrink-0 text-error" />
          <span className="flex-1 text-xs text-error">{error}</span>
          <button
            type="button"
            onClick={onRetry}
            className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-error transition-colors hover:bg-error/10"
          >
            <RefreshCw className="h-3 w-3" aria-hidden />
            다시 시도
          </button>
        </div>
      )}

      {/* 헤더 */}
      <div className="flex items-center gap-3" style={vfade(0)}>
        <button type="button" onClick={onBack} className="flex items-center justify-center shrink-0 h-9 w-9 rounded-full transition-colors hover:bg-bg-alt">
          <ArrowLeft className="h-5 w-5" style={{ color: 'var(--text)' }} />
        </button>
        <div>
          <h1 className="text-lg sm:text-[22px] font-bold tracking-tight text-text">{problem.title}</h1>
          <p className="mt-0.5 text-xs sm:text-sm text-text-3">{problem.weekNumber} · 멤버별 제출 현황</p>
        </div>
      </div>

      {/* 진행 바 */}
      <div className="h-2 w-full overflow-hidden rounded-full" style={{ backgroundColor: 'var(--bg-alt)' }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: `var(--diff-${tier}-color)` }} />
      </div>

      {/* 정보 카드 */}
      <Card className="p-0 overflow-hidden" style={vfade(0.06)}>
        <div className="px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div className="flex flex-wrap items-center gap-2">
              <DifficultyBadge
                difficulty={problem.difficulty ?? null}
                level={problem.level}
                sourcePlatform={problem.sourcePlatform}
              />
              {(problem.tags ?? []).map((tag) => (
                <span key={tag} className="rounded-badge px-2 py-0.5 text-[11px]" style={{ backgroundColor: 'var(--bg-alt)', color: 'var(--text-3)' }}>{tag}</span>
              ))}
            </div>
            {problem.sourceUrl && (
              <a href={problem.sourceUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[12px] font-medium text-primary transition-colors hover:underline">
                문제 보기<ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="flex items-center justify-center gap-1.5"><Users className="h-4 w-4 text-text-3" /><span className="text-lg font-bold text-text">{totalMembers}</span></div>
              <p className="text-[11px] text-text-3">전체 멤버</p>
            </div>
            <div>
              <div className="flex items-center justify-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-text-3" /><span className="text-lg font-bold text-text">{submittedCount}</span></div>
              <p className="text-[11px] text-text-3">제출 완료</p>
            </div>
            <div>
              <div className="flex items-center justify-center gap-1.5"><Sparkles className="h-4 w-4" style={{ color: 'var(--success)' }} /><span className="text-lg font-bold" style={{ color: 'var(--success)' }}>{analyzedCount}</span></div>
              <p className="text-[11px] text-text-3">분석 완료</p>
            </div>
          </div>
        </div>
      </Card>

      {/* 로딩 / 미제출 / 제출 목록 */}
      {loading ? (
        <div className="space-y-3"><SkeletonCard /><SkeletonCard /></div>
      ) : accessDenied ? (
        <Card><CardContent className="py-10 text-center">
          <ShieldAlert className="mx-auto mb-2 h-6 w-6 text-error opacity-60" />
          <p className="text-sm font-medium text-text">이 스터디에 접근 권한이 없습니다</p>
          <p className="mt-1 text-xs text-text-3">스터디 멤버만 제출 내역을 볼 수 있습니다</p>
        </CardContent></Card>
      ) : notSubmitted ? (
        <Card><CardContent className="py-10 text-center">
          <Code2 className="mx-auto mb-2 h-6 w-6 text-primary opacity-60" />
          <p className="text-sm font-medium text-text">문제를 먼저 제출해주세요</p>
          <p className="mt-1 text-xs text-text-3">제출 후 다른 스터디원의 풀이를 볼 수 있습니다</p>
        </CardContent></Card>
      ) : submissions.length === 0 ? (
        <Card><CardContent className="py-10 text-center">
          <Code2 className="mx-auto mb-2 h-6 w-6 text-text-3 opacity-40" />
          <p className="text-xs text-text-3">아직 제출이 없습니다</p>
        </CardContent></Card>
      ) : (
        <>
          <p className="text-sm font-medium text-text-2" style={vfade(0.1)}>제출 완료 · {submissions.length}명</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" style={vfade(0.14)}>
            {submissions.map((sub) => {
              const saga = getSagaStatus(sub.sagaStep);
              const name = (sub.userId && nicknameMap[sub.userId]) ? nicknameMap[sub.userId] : '익명';
              const avatarUrl = sub.userId ? avatarMap[sub.userId] : null;

              return (
                <Card key={sub.id} className="p-4 cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-hover" onClick={() => onSelectSubmission(sub)}>
                  <div className="flex items-center gap-3">
                    <img
                      src={avatarUrl ? getAvatarSrc(getAvatarPresetKey(avatarUrl)) : getAvatarSrc('default')}
                      alt={`${name} 아바타`} className="h-10 w-10 shrink-0 rounded-full object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold text-text">{name}</span>
                        <span className="rounded-full px-2 py-0.5 text-[11px] font-medium uppercase" style={{ backgroundColor: 'var(--bg-alt)', color: 'var(--text-2)' }}>{sub.language}</span>
                        {sub.isLate && (
                          <span
                            className="inline-flex items-center rounded-badge px-1.5 py-0.5 text-[10px] font-semibold"
                            style={{ backgroundColor: 'var(--warning-soft)', color: 'var(--warning)' }}
                          >
                            지각
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-text-3">
                        {new Date(sub.createdAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-text-3" />
                  </div>
                  <div className="mt-3">
                    <span className="flex items-center gap-1 text-[12px] font-medium" style={{ color: saga.variant === 'success' ? 'var(--success)' : saga.variant === 'warning' ? 'var(--warning)' : 'var(--text-3)' }}>
                      <Sparkles className="h-3.5 w-3.5" />{saga.label}
                      {sub.aiScore != null && <span className="ml-1 font-bold">{sub.aiScore}점</span>}
                    </span>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* 스터디 노트 */}
      <StudyNoteEditor problemId={problem.id} />
    </div>
  );
}
