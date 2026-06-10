/**
 * @file 문제 수정 — 플랫폼 검색 섹션 컴포넌트 (BOJ / 프로그래머스)
 * @domain problem
 * @layer component
 * @related edit/page.tsx, useBojSearch, useProgrammersSearch
 */

'use client';

import type React from 'react';
import { useTranslations } from 'next-intl';
import { Search, ExternalLink, X } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { DifficultyBadge } from '@/components/ui/DifficultyBadge';
import { InlineSpinner } from '@/components/ui/LoadingSpinner';
import type { SolvedacProblemInfo } from '@/lib/api';
import type { ProgrammersProblemInfo } from '@/lib/api';
import type { Difficulty } from '@/lib/constants';

// ─── TYPES ───────────────────────────────

export interface PlatformSearchSectionProps {
  readonly activePlatform: 'BOJ' | 'PROGRAMMERS';
  readonly onPlatformChange: (p: 'BOJ' | 'PROGRAMMERS') => void;
  readonly bojQuery: string;
  readonly setBojQuery: (v: string) => void;
  readonly bojSearching: boolean;
  readonly bojError: string | null;
  readonly setBojError: (e: string | null) => void;
  readonly bojResult: SolvedacProblemInfo | null;
  readonly bojApplied: boolean;
  readonly handleBojSearch: () => Promise<void>;
  readonly handleBojKeyDown: React.KeyboardEventHandler;
  readonly handleBojReset: () => void;
  readonly programmersQuery: string;
  readonly setProgrammersQuery: (v: string) => void;
  readonly programmersSearching: boolean;
  readonly programmersError: string | null;
  readonly setProgrammersError: (e: string | null) => void;
  readonly programmersResult: ProgrammersProblemInfo | null;
  readonly programmersApplied: boolean;
  readonly handleProgrammersSearch: () => Promise<void>;
  readonly handleProgrammersKeyDown: React.KeyboardEventHandler;
  readonly handleProgrammersReset: () => void;
  readonly isSubmitting: boolean;
}

// ─── COMPONENT ───────────────────────────

/**
 * 플랫폼 토글 + BOJ / 프로그래머스 문제 검색 카드
 * @domain problem
 */
export function PlatformSearchSection({
  activePlatform,
  onPlatformChange,
  bojQuery,
  setBojQuery,
  bojSearching,
  bojError,
  setBojError,
  bojResult,
  bojApplied,
  handleBojSearch,
  handleBojKeyDown,
  handleBojReset,
  programmersQuery,
  setProgrammersQuery,
  programmersSearching,
  programmersError,
  setProgrammersError,
  programmersResult,
  programmersApplied,
  handleProgrammersSearch,
  handleProgrammersKeyDown,
  handleProgrammersReset,
  isSubmitting,
}: PlatformSearchSectionProps) {
  const t = useTranslations('problems');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary-soft text-primary">
            <Search className="h-3.5 w-3.5" />
          </div>
          {activePlatform === 'BOJ' ? t('form.searchTitle.boj') : t('form.searchTitle.programmers')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* 플랫폼 토글 */}
        <div
          className="inline-flex rounded-btn p-0.5 mb-3"
          style={{ backgroundColor: 'var(--bg-alt)' }} // eslint-disable-line react/forbid-dom-props
          role="tablist"
          aria-label={t('form.platformAriaLabel')}
        >
          {(['PROGRAMMERS', 'BOJ'] as const).map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={activePlatform === p}
              tabIndex={activePlatform === p ? 0 : -1}
              onClick={() => onPlatformChange(p)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                  e.preventDefault();
                  onPlatformChange(activePlatform === 'BOJ' ? 'PROGRAMMERS' : 'BOJ');
                }
              }}
              className="px-3 py-1.5 text-[12px] font-medium rounded-btn transition-all duration-150"
              // eslint-disable-next-line react/forbid-dom-props
              style={
                activePlatform === p
                  ? {
                      backgroundColor: 'var(--bg-card)',
                      color: 'var(--primary)',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                    }
                  : { color: 'var(--text-3)' }
              }
            >
              {p === 'BOJ' ? t('form.platform.boj') : t('form.platform.programmers')}
            </button>
          ))}
        </div>

        <p className="text-[11px] text-text-3">
          {activePlatform === 'BOJ' ? t('form.searchDesc.boj') : t('form.searchDesc.programmers')}
        </p>

        {/* BOJ 검색 UI */}
        {activePlatform === 'BOJ' && (
          <>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-3 pointer-events-none"
                  aria-hidden
                />
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder={t('edit.searchPlaceholderBoj')}
                  value={bojQuery}
                  onChange={(e) => {
                    setBojQuery(e.target.value);
                    setBojError(null);
                  }}
                  onKeyDown={handleBojKeyDown}
                  disabled={bojSearching || isSubmitting || bojApplied}
                  className="w-full h-[40px] pl-8 pr-3 rounded-badge border border-border bg-input-bg text-text text-xs outline-none transition-[border-color] duration-150 placeholder:text-text-3 focus:border-primary disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
              {bojApplied ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="md"
                  onClick={handleBojReset}
                  disabled={isSubmitting}
                  className="shrink-0"
                >
                  <X className="h-3.5 w-3.5" />
                  {t('form.disconnect')}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  disabled={bojSearching || isSubmitting || !bojQuery.trim()}
                  onClick={() => void handleBojSearch()}
                  className="shrink-0"
                >
                  {bojSearching ? <InlineSpinner /> : t('form.search')}
                </Button>
              )}
            </div>

            {bojError && <p className="text-[11px] text-error">{bojError}</p>}

            {bojResult && (
              <div className="flex items-center gap-2.5 rounded-badge bg-primary-soft border border-border px-3 py-2.5">
                <span className="text-xs font-mono text-text-3">#{bojResult.problemId}</span>
                <span className="text-xs font-medium text-text truncate">{bojResult.title}</span>
                {bojResult.difficulty && (
                  <DifficultyBadge
                    difficulty={bojResult.difficulty as Difficulty}
                    level={bojResult.level}
                  />
                )}
                <a
                  href={bojResult.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto shrink-0 text-text-3 hover:text-primary transition-colors"
                  aria-label={t('form.bojViewAriaLabel')}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            )}

            {bojResult && bojResult.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {bojResult.tags.map((tag) => (
                  <Badge key={tag} variant="muted">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </>
        )}

        {/* 프로그래머스 검색 UI */}
        {activePlatform === 'PROGRAMMERS' && (
          <>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-3 pointer-events-none"
                  aria-hidden
                />
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder={t('form.searchPlaceholder.programmers')}
                  value={programmersQuery}
                  onChange={(e) => {
                    setProgrammersQuery(e.target.value);
                    setProgrammersError(null);
                  }}
                  onKeyDown={handleProgrammersKeyDown}
                  disabled={programmersSearching || isSubmitting || programmersApplied}
                  className="w-full h-[40px] pl-8 pr-3 rounded-badge border border-border bg-input-bg text-text text-xs outline-none transition-[border-color] duration-150 placeholder:text-text-3 focus:border-primary disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
              {programmersApplied ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="md"
                  onClick={handleProgrammersReset}
                  disabled={isSubmitting}
                  className="shrink-0"
                >
                  <X className="h-3.5 w-3.5" />
                  {t('form.disconnect')}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  disabled={
                    programmersSearching || isSubmitting || !programmersQuery.trim()
                  }
                  onClick={() => void handleProgrammersSearch()}
                  className="shrink-0"
                >
                  {programmersSearching ? <InlineSpinner /> : t('form.search')}
                </Button>
              )}
            </div>

            {programmersError && (
              <p className="text-[11px] text-error">{programmersError}</p>
            )}

            {programmersResult && (
              <div className="flex items-center gap-2.5 rounded-badge bg-primary-soft border border-border px-3 py-2.5">
                <span className="text-xs font-mono text-text-3">
                  #{programmersResult.problemId}
                </span>
                <span className="text-xs font-medium text-text truncate">
                  {programmersResult.title}
                </span>
                {programmersResult.difficulty && (
                  <DifficultyBadge
                    difficulty={programmersResult.difficulty as Difficulty}
                    level={programmersResult.level}
                  />
                )}
                <a
                  href={programmersResult.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto shrink-0 text-text-3 hover:text-primary transition-colors"
                  aria-label={t('form.programmersViewAriaLabel')}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            )}

            {programmersResult && programmersResult.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {programmersResult.tags.map((tag) => (
                  <Badge key={tag} variant="muted">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
