/**
 * @file 제출 목록 페이지 (Figma 디자인 반영)
 * @domain submission
 * @layer page
 * @related submissionApi, problemApi
 */

'use client';

import React, { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Search, Loader2 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Alert } from '@/components/ui/Alert';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  submissionApi,
  problemApi,
  type Submission,
} from '@/lib/api';
import { useStudy } from '@/contexts/StudyContext';
import { DIFFICULTIES, DIFFICULTY_LABELS, toTierLevel, type Difficulty } from '@/lib/constants';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useRequireStudy } from '@/hooks/useRequireStudy';

// ─── CONSTANTS ────────────────────────────

const STATUS_TABS = [
  { value: '', label: '전체' },
  { value: 'DONE', label: '분석 완료' },
  { value: 'AI_QUEUED', label: '분석 중' },
  { value: 'QUEUED', label: '대기 중' },
  { value: 'FAILED', label: '실패' },
] as const;

// ─── DIFFICULTY STYLES (CSS 변수 기반, 문제 목록 패턴 통일) ────

const DIFF_DOT_STYLE: Record<string, React.CSSProperties> = {
  bronze:   { backgroundColor: 'var(--diff-bronze-color)' },
  silver:   { backgroundColor: 'var(--diff-silver-color)' },
  gold:     { backgroundColor: 'var(--diff-gold-color)' },
  platinum: { backgroundColor: 'var(--diff-platinum-color)' },
  diamond:  { backgroundColor: 'var(--diff-diamond-color)' },
  ruby:     { backgroundColor: 'var(--diff-ruby-color)' },
};

const DIFF_BADGE_STYLE: Record<string, React.CSSProperties> = {
  bronze:   { backgroundColor: 'var(--diff-bronze-bg)',   color: 'var(--diff-bronze-color)' },
  silver:   { backgroundColor: 'var(--diff-silver-bg)',   color: 'var(--diff-silver-color)' },
  gold:     { backgroundColor: 'var(--diff-gold-bg)',     color: 'var(--diff-gold-color)' },
  platinum: { backgroundColor: 'var(--diff-platinum-bg)', color: 'var(--diff-platinum-color)' },
  diamond:  { backgroundColor: 'var(--diff-diamond-bg)',  color: 'var(--diff-diamond-color)' },
  ruby:     { backgroundColor: 'var(--diff-ruby-bg)',     color: 'var(--diff-ruby-color)' },
};

// 언어 아바타 색상
const LANG_AVATAR: Record<string, { label: string; bg: string; color: string }> = {
  python:     { label: 'PY', bg: '#3572A520', color: '#3572A5' },
  javascript: { label: 'JS', bg: '#f1e05a20', color: '#b8a000' },
  typescript: { label: 'TS', bg: '#3178c620', color: '#3178c6' },
  java:       { label: 'JA', bg: '#b0731420', color: '#b07314' },
  cpp:        { label: 'CP', bg: '#f3428520', color: '#f34285' },
  c:          { label: 'C',  bg: '#555555220', color: '#555555' },
  go:         { label: 'GO', bg: '#00ADD820', color: '#00ADD8' },
  rust:       { label: 'RS', bg: '#dea58420', color: '#dea584' },
  kotlin:     { label: 'KT', bg: '#A97BFF20', color: '#A97BFF' },
};

// ─── HELPERS ─────────────────────────────

/** 상대 시간 표시 (Figma: "6시간 전", "1일 전") */
function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}일 전`;
  return `${Math.floor(days / 30)}개월 전`;
}

/** 상태를 Figma 라벨로 변환 */
function getStatusDisplay(sagaStep: string): { label: string; bg: string; color: string; dot: boolean } {
  switch (sagaStep) {
    case 'DONE':
      return { label: '분석 완료', bg: 'var(--success-soft)', color: 'var(--success)', dot: true };
    case 'AI_QUEUED':
      return { label: '분석 중', bg: 'var(--warning-soft)', color: 'var(--warning)', dot: false };
    case 'GITHUB_QUEUED':
    case 'DB_SAVED':
      return { label: '대기 중', bg: 'var(--bg-alt)', color: 'var(--text-3)', dot: false };
    case 'FAILED':
      return { label: '실패', bg: 'var(--error-soft)', color: 'var(--error)', dot: false };
    default:
      return { label: sagaStep, bg: 'var(--bg-alt)', color: 'var(--text-3)', dot: false };
  }
}

/** 점수 색상 */
function scoreColor(score: number): string {
  if (score >= 80) return 'var(--success)';
  if (score >= 60) return 'var(--warning)';
  return 'var(--error)';
}

// ─── RENDER ───────────────────────────────

export default function SubmissionsPage(): ReactNode {
  const router = useRouter();
  const { isAuthenticated } = useRequireAuth();
  useRequireStudy();
  const { currentStudyId } = useStudy();

  // ─── STATE ──────────────────────────────

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [problemMap, setProblemMap] = useState<Map<string, { title: string; difficulty?: string; level?: number; weekNumber?: string }>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterSearch, setFilterSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const fade = (delay = 0): React.CSSProperties => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'translateY(0)' : 'translateY(16px)',
    transition: `opacity .5s cubic-bezier(.16,1,.3,1) ${delay}s, transform .5s cubic-bezier(.16,1,.3,1) ${delay}s`,
  });

  // ─── API ────────────────────────────────

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [result, problems] = await Promise.all([
        submissionApi.list({ page: 1, limit: 100 }),
        problemApi.findAllIncludingClosed().catch(() => []),
      ]);
      setSubmissions(result.data);
      setProblemMap(new Map(problems.map((p) => [p.id, { title: p.title, difficulty: p.difficulty ?? undefined, level: p.level ?? undefined, weekNumber: p.weekNumber ?? undefined }])));
    } catch (err: unknown) {
      setError((err as Error).message ?? '제출 이력을 불러오는 데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && currentStudyId) {
      void loadData();
    }
  }, [isAuthenticated, currentStudyId, loadData]);

  // ─── FILTERING ──────────────────────────

  const filtered = useMemo(() => {
    return submissions.filter((s) => {
      if (filterSearch) {
        const q = filterSearch.toLowerCase();
        const title = s.problemTitle ?? problemMap.get(s.problemId)?.title ?? '';
        if (!title.toLowerCase().includes(q)) return false;
      }
      if (filterStatus) {
        if (filterStatus === 'QUEUED') {
          if (s.sagaStep !== 'GITHUB_QUEUED' && s.sagaStep !== 'DB_SAVED') return false;
        } else if (s.sagaStep !== filterStatus) return false;
      }
      if (filterDifficulty) {
        const diff = problemMap.get(s.problemId)?.difficulty;
        if (diff !== filterDifficulty) return false;
      }
      return true;
    });
  }, [submissions, filterSearch, filterStatus, filterDifficulty, problemMap]);

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* 헤더 */}
        <div style={fade(0)}>
          <h1 className="text-[22px] font-bold tracking-tight text-text">제출 이력</h1>
          <p className="text-[13px] mt-1" style={{ color: 'var(--text-3)' }}>
            내가 제출한 코드와 AI 분석 결과를 확인하세요.
          </p>
        </div>

        {/* 검색 + 상태 필터 */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3" style={fade(0.06)}>
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: 'var(--text-3)' }} aria-hidden />
            <input
              type="text"
              placeholder="문제명 검색..."
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              className="w-full h-[44px] pl-10 pr-4 rounded-xl text-text text-sm font-body outline-none transition-[border-color] duration-150 placeholder:text-text-3 focus:border-primary"
              style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
            />
          </div>
          <div className="flex items-center shrink-0 overflow-x-auto">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setFilterStatus(tab.value)}
                className="px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors whitespace-nowrap"
                style={
                  filterStatus === tab.value
                    ? { backgroundColor: 'var(--bg-card)', color: 'var(--primary)', border: '1px solid var(--border)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }
                    : { color: 'var(--text-3)' }
                }
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* 난이도 필터 pills */}
        <div className="flex items-center gap-2 flex-wrap" style={fade(0.1)}>
          <button
            type="button"
            onClick={() => setFilterDifficulty('')}
            className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[12px] font-medium transition-all hover:shadow-sm hover:brightness-95 hover:scale-105"
            style={
              !filterDifficulty
                ? { backgroundColor: 'var(--primary)', color: '#fff' }
                : { backgroundColor: 'var(--bg-card)', color: 'var(--text-2)', border: '1px solid var(--border)' }
            }
          >
            전체
          </button>
          {DIFFICULTIES.map((d) => {
            const diffKey = d.toLowerCase();
            const isActive = filterDifficulty === d;
            return (
              <button
                key={d}
                type="button"
                onClick={() => setFilterDifficulty(d)}
                className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[12px] font-medium transition-all hover:shadow-sm hover:brightness-95 hover:scale-105"
                style={
                  isActive
                    ? { backgroundColor: 'var(--primary)', color: '#fff' }
                    : DIFF_BADGE_STYLE[diffKey] ?? { backgroundColor: 'var(--bg-card)', color: 'var(--text-2)' }
                }
              >
                <span className="h-1.5 w-1.5 rounded-full" style={isActive ? { backgroundColor: '#fff' } : (DIFF_DOT_STYLE[diffKey] ?? {})} aria-hidden />
                {DIFFICULTY_LABELS[d]}
              </button>
            );
          })}
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[12px] font-medium transition-all opacity-50 cursor-not-allowed"
            style={DIFF_BADGE_STYLE.ruby ?? {}}
            disabled
          >
            <span className="h-1.5 w-1.5 rounded-full" style={DIFF_DOT_STYLE.ruby ?? {}} aria-hidden />
            Ruby
          </button>
        </div>

        {/* 에러 */}
        {error && (
          <Alert variant="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* 로딩 스켈레톤 */}
        {isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4 rounded-xl border border-border bg-bg-card animate-pulse">
                <div className="h-10 w-10 rounded-full" style={{ backgroundColor: 'var(--bg-alt)' }} />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/3 rounded" style={{ backgroundColor: 'var(--bg-alt)' }} />
                  <div className="h-3 w-1/4 rounded" style={{ backgroundColor: 'var(--bg-alt)' }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 빈 상태 */}
        {!isLoading && !error && submissions.length === 0 && (
          <EmptyState
            icon={FileText}
            title="제출 이력이 없습니다"
            description="아직 제출한 코드가 없습니다. 문제를 풀어보세요!"
            action={{ label: '문제 목록', onClick: () => router.push('/problems') }}
          />
        )}

        {/* 필터 결과 없음 */}
        {!isLoading && submissions.length > 0 && filtered.length === 0 && (
          <EmptyState
            icon={Search}
            title="검색 결과가 없습니다"
            description="필터 조건을 변경해 보세요."
            action={{ label: '필터 초기화', onClick: () => { setFilterSearch(''); setFilterStatus(''); setFilterDifficulty(''); } }}
            size="sm"
          />
        )}

        {/* 제출 목록 (카드) */}
        {!isLoading && filtered.length > 0 && (
          <div className="space-y-2" style={fade(0.14)}>
            {filtered.map((s) => {
              const pInfo = problemMap.get(s.problemId);
              const title = s.problemTitle ?? pInfo?.title ?? `문제 ${s.problemId}`;
              const diffKey = pInfo?.difficulty ? (pInfo.difficulty as string).toLowerCase() : '';
              const diffLabel = pInfo?.difficulty
                ? `${DIFFICULTY_LABELS[pInfo.difficulty as Difficulty] ?? pInfo.difficulty}${toTierLevel(pInfo.level) ? ` ${toTierLevel(pInfo.level)}` : ''}`
                : '';
              const status = getStatusDisplay(s.sagaStep);
              const lang = LANG_AVATAR[s.language] ?? { label: s.language.slice(0, 2).toUpperCase(), bg: 'var(--bg-alt)', color: 'var(--text-3)' };
              const isDone = s.sagaStep === 'DONE';

              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => router.push(isDone ? `/submissions/${s.id}/analysis` : `/submissions/${s.id}/status`)}
                  aria-label={`${title} 제출 보기`}
                  className="group flex items-center gap-3 sm:gap-4 w-full px-3 sm:px-5 py-3 sm:py-4 rounded-xl border border-border transition-colors text-left bg-bg-card hover:bg-bg-alt"
                >
                  {/* 언어 아바타 (라운드 스퀘어, 난이도 색상) */}
                  <div
                    className="flex items-center justify-center shrink-0 h-10 w-10 rounded-lg text-[11px] font-bold"
                    style={{ backgroundColor: DIFF_BADGE_STYLE[diffKey]?.backgroundColor ?? 'var(--bg-alt)', color: DIFF_BADGE_STYLE[diffKey]?.color ?? 'var(--text-3)' }}
                  >
                    {lang.label}
                  </div>

                  {/* 문제 정보 */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-text truncate transition-colors group-hover:text-primary">
                      {title}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {/* 난이도 뱃지 */}
                      {diffLabel && (
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium" style={DIFF_BADGE_STYLE[diffKey] ?? {}}>
                          <span className="h-1.5 w-1.5 rounded-full" style={DIFF_DOT_STYLE[diffKey] ?? {}} aria-hidden />
                          {diffLabel}
                        </span>
                      )}
                      {/* 언어 뱃지 */}
                      <span
                        className="rounded-full px-2 py-0.5 text-[11px] font-medium uppercase"
                        style={{ backgroundColor: 'var(--bg-alt)', color: 'var(--text-2)' }}
                      >
                        {s.language}
                      </span>
                      {/* 상태 뱃지 */}
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                        style={{ backgroundColor: status.bg, color: status.color }}
                      >
                        {status.dot && <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: status.color }} aria-hidden />}
                        {status.label}
                      </span>
                      {/* 상대 시간 */}
                      <span className="text-[11px] font-medium" style={{ color: 'var(--text-3)' }}>
                        {relativeTime(s.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* 우측: AI 점수 or 상태 */}
                  <div className="shrink-0 text-right">
                    {s.aiScore != null ? (
                      <>
                        <span className="text-[20px] font-bold leading-none" style={{ color: scoreColor(s.aiScore) }}>
                          {s.aiScore}
                        </span>
                        <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-3)' }}>/100</p>
                      </>
                    ) : s.sagaStep === 'AI_QUEUED' ? (
                      <div className="flex items-center gap-1.5" style={{ color: 'var(--warning)' }}>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-[12px] font-medium">분석 중</span>
                      </div>
                    ) : s.sagaStep === 'FAILED' ? (
                      <span className="text-[12px] font-medium" style={{ color: 'var(--error)' }}>실패</span>
                    ) : (
                      <span className="text-[12px] font-medium" style={{ color: 'var(--text-3)' }}>대기 중</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
