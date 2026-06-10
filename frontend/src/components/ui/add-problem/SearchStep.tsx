/**
 * @file AddProblemModal Step 1 — platform toggle + debounced search + result list
 * @domain problem
 * @layer component
 * @related AddProblemModal, ConfirmStep, problem-search.utils
 *
 * Extracted from AddProblemModal.tsx (Sprint 242 Q-1 FE).
 * Owns its own search-state (query/results/loading/error); platform selection
 * is lifted to the parent so it survives step transitions.
 */
import { useState, useEffect, useRef } from 'react';
import { Search, X, Loader2, AlertCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { DIFFICULTY_CONFIG } from '../AlgosuUI';
import { PROGRAMMERS_LEVEL_LABELS } from '@/lib/constants';
import {
  toOurDiff,
  resolveTierLabel,
  type Platform,
  type SolvedProblem,
} from './problem-search.utils';

/** SearchStep props — search function and UI text vary by platform */
export interface SearchStepProps {
  onSelect: (p: SolvedProblem) => void;
  platform: Platform;
  searchFn: (query: string) => Promise<SolvedProblem[]>;
  onPlatformChange: (p: Platform) => void;
}

/** Debounce window (ms) for the search input → API call */
const SEARCH_DEBOUNCE_MS = 400;

/** Maximum results shown to the user (server may return more) */
const MAX_RESULTS = 10;

/**
 * Step 1 of the Add Problem flow: platform tab → search input → result rows.
 *
 * Behaviour is deliberately unchanged from the original `SearchStep` so the
 * full-flow integration tests keep passing.
 */
export function SearchStep({
  onSelect,
  platform,
  searchFn,
  onPlatformChange,
}: SearchStepProps) {
  const t = useTranslations('problems');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SolvedProblem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Autofocus the search input on first mount.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Reset search state whenever the platform toggles.
  useEffect(() => {
    setQuery('');
    setResults([]);
    setError('');
  }, [platform]);

  // Debounced query → searchFn dispatch (cancels in-flight timer on edit/unmount).
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!query.trim()) {
      setResults([]);
      setError('');
      return;
    }

    timerRef.current = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const items = await searchFn(query.trim());
        setResults(items.slice(0, MAX_RESULTS));
      } catch {
        setError(t('addModal.error.searchError'));
      } finally {
        setLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, searchFn, t]);

  const placeholder = platform === 'BOJ'
    ? t('addModal.search.placeholderBoj')
    : t('addModal.search.placeholderProgrammers');

  const helperText = platform === 'BOJ'
    ? t('addModal.search.helperBoj')
    : t('addModal.search.helperProgrammers');

  return (
    <div className="flex flex-col" style={{ minHeight: 320 }}>
      {/* Platform toggle */}
      <div className="px-5 pt-4 pb-1">
        <div
          className="inline-flex rounded-btn p-0.5"
          style={{ backgroundColor: 'var(--bg-alt)' }}
          role="tablist"
          aria-label={t('addModal.platform.aria')}
        >
          {(['PROGRAMMERS', 'BOJ'] as const).map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={platform === p}
              tabIndex={platform === p ? 0 : -1}
              onClick={() => { onPlatformChange(p); }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                  e.preventDefault();
                  onPlatformChange(platform === 'BOJ' ? 'PROGRAMMERS' : 'BOJ');
                }
              }}
              className="px-3 py-1.5 text-[12px] font-medium rounded-btn transition-all duration-150"
              style={
                platform === p
                  ? { backgroundColor: 'var(--bg-card)', color: 'var(--primary)', boxShadow: '0 1px 2px rgba(0,0,0,0.08)' }
                  : { color: 'var(--text-3)' }
              }
            >
              {p === 'BOJ' ? t('addModal.platform.boj') : t('addModal.platform.programmers')}
            </button>
          ))}
        </div>
      </div>

      {/* Search input */}
      <div className="px-5 pt-3 pb-3">
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 pointer-events-none"
            style={{ color: 'var(--text-3)' }}
          />
          <input
            ref={inputRef}
            type="text"
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-10 w-full rounded-btn border pl-9 pr-10 text-[13px] outline-none"
            style={{
              background: 'var(--bg-card)',
              borderColor: 'var(--border)',
              color: 'var(--text)',
            }}
          />
          {loading ? (
            <Loader2
              className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin"
              style={{ color: 'var(--primary)' }}
            />
          ) : query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center h-5 w-5 rounded-full transition-opacity hover:opacity-70"
              style={{ backgroundColor: 'var(--bg-alt)', color: 'var(--text-3)' }}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        <p className="mt-2 text-[11px]" style={{ color: 'var(--text-3)' }}>
          {helperText}
        </p>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-5 pt-2 pb-5" style={{ maxHeight: 360 }}>
        {/* Error */}
        {error && (
          <div
            className="flex items-center gap-2 rounded-btn px-3 py-2.5 text-[12px]"
            style={{ background: 'var(--error-soft)', color: 'var(--error)' }}
          >
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {error}
          </div>
        )}

        {/* Empty query */}
        {!query.trim() && !loading && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div
              className="mb-3 flex h-10 w-10 items-center justify-center rounded-full"
              style={{ background: 'var(--bg-alt)' }}
            >
              <Search className="h-4 w-4" style={{ color: 'var(--text-3)' }} />
            </div>
            <p className="text-[13px] font-medium" style={{ color: 'var(--text-2)' }}>
              {platform === 'BOJ' ? t('addModal.search.emptyTitleBoj') : t('addModal.search.emptyTitleProgrammers')}
            </p>
            <p className="mt-1 text-[11px]" style={{ color: 'var(--text-3)' }}>
              {platform === 'BOJ'
                ? t('addModal.search.emptyHintBoj')
                : t('addModal.search.emptyHintProgrammers')}
            </p>
          </div>
        )}

        {/* No results */}
        {query.trim() && !loading && results.length === 0 && !error && (
          <div className="py-12 text-center">
            <p className="text-[13px] font-medium" style={{ color: 'var(--text-2)' }}>
              {t('addModal.search.noResults')}
            </p>
            <p className="mt-1 text-[11px]" style={{ color: 'var(--text-3)' }}>
              {t('addModal.search.noResultsHint')}
            </p>
          </div>
        )}

        {/* Results list */}
        {results.length > 0 && (
          <div className="space-y-1.5">
            {results.map((p) => {
              const resolvedDiff = p.difficulty ?? toOurDiff(p.level).difficulty;
              const cfg = DIFFICULTY_CONFIG[resolvedDiff];
              const tierLabel = resolveTierLabel(platform, p.level, PROGRAMMERS_LEVEL_LABELS);
              const tags = p.tags.slice(0, 3);

              return (
                <button
                  key={p.problemId}
                  type="button"
                  onClick={() => onSelect(p)}
                  className="group flex w-full items-start gap-3 rounded-card border px-4 py-3 text-left transition-all hover:-translate-y-0.5"
                  style={{
                    background: 'var(--bg-card)',
                    borderColor: 'var(--border)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--primary)';
                    e.currentTarget.style.boxShadow = '0 0 0 1px var(--primary), var(--shadow-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  {/* Tier dot */}
                  <div
                    className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[10px] font-bold"
                    style={{ background: cfg.bg, color: cfg.color }}
                  >
                    {p.problemId}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p
                        className="truncate text-[13px] font-semibold"
                        style={{ color: 'var(--text)' }}
                      >
                        {p.titleKo}
                      </p>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {/* Tier badge */}
                      <span
                        className="inline-flex items-center gap-1 rounded-badge px-1.5 py-0.5 text-[10px] font-semibold"
                        style={{ background: cfg.bg, color: cfg.color }}
                      >
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: cfg.color }} />
                        {tierLabel}
                      </span>
                      {/* SQL badge — Programmers SQL category */}
                      {platform === 'PROGRAMMERS' && p.category === 'sql' && (
                        <span
                          className="rounded-badge px-1.5 py-0.5 text-[10px] font-semibold"
                          style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}
                        >
                          SQL
                        </span>
                      )}
                      {/* Tags */}
                      {tags.map((tg) => (
                        <span
                          key={tg}
                          className="rounded-badge px-1.5 py-0.5 text-[10px] font-medium"
                          style={{ background: 'var(--bg-alt)', color: 'var(--text-3)' }}
                        >
                          {tg}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Solved count — BOJ only */}
                  {platform === 'BOJ' && (
                    <div className="shrink-0 text-right">
                      <p className="text-[10px]" style={{ color: 'var(--text-3)' }}>
                        {t('addModal.search.solvedCount', { count: p.acceptedUserCount.toLocaleString() })}
                      </p>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
