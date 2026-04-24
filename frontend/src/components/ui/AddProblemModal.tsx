/**
 * @file Add Problem modal (BOJ / Programmers platform toggle, SQL auto-tagging)
 * @domain problem
 * @layer component
 * @related problemApi, solvedacApi, programmersApi, PROGRAMMERS_LEVEL_LABELS, CreateProblemData
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {
  Search, X, ArrowLeft, Plus, Loader2, ExternalLink, AlertCircle,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Btn, type Difficulty, DIFFICULTY_CONFIG } from './AlgosuUI';
import { problemApi, solvedacApi, programmersApi, studyApi, type CreateProblemData } from '@/lib/api';
import { PROGRAMMERS_LEVEL_LABELS } from '@/lib/constants';
import { useStudy } from '@/contexts/StudyContext';

// ── solved.ac types ──────────────────────────────────────────────────────────
// Gateway `/api/external/solvedac/search` returns flattened `string[]` with
// Korean tag names. The `{ key, displayNames[] }` structure from direct
// solved.ac calls is absorbed by the Gateway layer.

export interface SolvedProblem {
  problemId: number;
  titleKo: string;
  level: number; // BOJ: 0=unrated, 1-5=Bronze ... 21-25=Diamond | PROGRAMMERS: 1~5
  tags: string[];
  acceptedUserCount: number;
  /** Programmers: difficulty provided directly by Gateway */
  difficulty?: Difficulty;
  /** Programmers: problem URL provided directly by Gateway */
  sourceUrl?: string;
  /** Programmers: problem category (algorithm | sql) */
  category?: 'algorithm' | 'sql';
}

// solved.ac level(0~30) -> our Difficulty + level(raw value preserved)
function toOurDiff(solvedLevel: number): { difficulty: Difficulty; level: number } {
  if (solvedLevel <= 0) return { difficulty: 'BRONZE', level: 1 };
  const tiers: Difficulty[] = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND', 'RUBY'];
  const tierIdx = Math.min(Math.floor((solvedLevel - 1) / 5), 5);
  return { difficulty: tiers[tierIdx], level: solvedLevel };
}

/**
 * Determine if a Programmers problem is SQL-based.
 * Dual check via category or tags.
 */
function isSqlProblem(p: SolvedProblem): boolean {
  if (p.category === 'sql') return true;
  return (p.tags ?? []).some((t) => t.toUpperCase() === 'SQL');
}

/**
 * Merge SQL tag without duplication (case-normalized).
 * Preserves original if SQL tag already exists.
 */
function mergeSqlTag(tags: string[]): string[] {
  const has = tags.some((t) => t.toUpperCase() === 'SQL');
  return has ? tags : ['SQL', ...tags];
}

// Full tier label (e.g. "Gold III")
const TIER_NAMES = [
  'Unrated',
  'Bronze V', 'Bronze IV', 'Bronze III', 'Bronze II', 'Bronze I',
  'Silver V', 'Silver IV', 'Silver III', 'Silver II', 'Silver I',
  'Gold V', 'Gold IV', 'Gold III', 'Gold II', 'Gold I',
  'Platinum V', 'Platinum IV', 'Platinum III', 'Platinum II', 'Platinum I',
  'Diamond V', 'Diamond IV', 'Diamond III', 'Diamond II', 'Diamond I',
  'Ruby V', 'Ruby IV', 'Ruby III', 'Ruby II', 'Ruby I',
];

/**
 * Gateway `/api/external/solvedac/search` proxy call.
 * Direct solved.ac calls trigger 403 via Referer header, so Gateway proxy is required.
 */
async function searchSolvedAC(query: string): Promise<SolvedProblem[]> {
  const data = await solvedacApi.searchByQuery(query, 1);
  if (!data || !Array.isArray(data.items)) {
    throw new Error('SEARCH_RESULT_INVALID');
  }
  return data.items.map((item) => ({
    problemId: item.problemId,
    titleKo: item.titleKo ?? item.title ?? `#${item.problemId}`,
    level: item.level,
    tags: item.tags ?? [],
    acceptedUserCount: item.acceptedUserCount ?? 0,
  }));
}

/**
 * Gateway `/api/external/programmers/search` proxy call.
 * Converts Programmers search results to SolvedProblem format.
 */
async function searchProgrammers(query: string): Promise<SolvedProblem[]> {
  const data = await programmersApi.searchByQuery(query, 1);
  if (!data || !Array.isArray(data.items)) {
    throw new Error('SEARCH_RESULT_INVALID');
  }
  return data.items.map((item) => ({
    problemId: item.problemId,
    titleKo: item.title,
    level: item.level,
    tags: item.tags ?? [],
    acceptedUserCount: 0,
    difficulty: (item.difficulty ?? undefined) as Difficulty | undefined,
    sourceUrl: item.sourceUrl,
    category: item.category,
  }));
}

// ── Week calculation (calendar-based) ────────────────────────────────────

/** Day-of-week keys for i18n lookup */
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

/** Structured week option (locale-independent) */
interface WeekOption {
  month: number;
  week: number;
  /** Stable key for select value (e.g. "4-1") */
  key: string;
}

/**
 * Generate week options from current week onward (current month + next month week 1).
 *
 * Calendar-based week calculation:
 * - Week 1 starts from the week containing the 1st of the month (Sunday = week start).
 * - currentWeek = ceil((today + firstDayOfWeek) / 7)
 * - totalWeeks  = ceil((lastDay + firstDayOfWeek) / 7)
 */
function generateWeekData(): WeekOption[] {
  const now = new Date();
  const month = now.getMonth() + 1;
  const firstDayOfWeek = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
  const currentWeek = Math.ceil((now.getDate() + firstDayOfWeek) / 7);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const totalWeeks = Math.ceil((lastDay + firstDayOfWeek) / 7);
  const options: WeekOption[] = [];
  for (let w = currentWeek; w <= totalWeeks; w++) {
    options.push({ month, week: w, key: `${month}-${w}` });
  }
  const nextMonth = month === 12 ? 1 : month + 1;
  options.push({ month: nextMonth, week: 1, key: `${nextMonth}-1` });
  return options;
}

/** Structured date option (locale-independent) */
interface DateOption {
  dayIndex: number;
  month: number;
  day: number;
  value: string;
}

/**
 * Get date entries for a given week (calendar-based, KST 23:59:59).
 *
 * Week start/end accounts for the 1st day-of-week offset:
 * - rawStart = (week - 1) * 7 - firstDayOfWeek + 1
 * - rawEnd   = week * 7 - firstDayOfWeek
 * Clamped to month boundary (1 ~ daysInMonth).
 */
function getWeekDateData(month: number, week: number): DateOption[] {
  const now = new Date();
  const year = now.getFullYear();
  const adjustedYear = month < now.getMonth() + 1 && month === 1 ? year + 1 : year;
  const firstDayOfWeek = new Date(adjustedYear, month - 1, 1).getDay();
  const daysInMonth = new Date(adjustedYear, month, 0).getDate();

  const rawStart = (week - 1) * 7 - firstDayOfWeek + 1;
  const rawEnd = week * 7 - firstDayOfWeek;
  const startDate = Math.max(1, rawStart);
  const endDate = Math.min(daysInMonth, rawEnd);

  const dates: DateOption[] = [];
  for (let d = startDate; d <= endDate; d++) {
    const date = new Date(adjustedYear, month - 1, d, 23, 59, 59);
    dates.push({
      dayIndex: date.getDay(),
      month,
      day: d,
      value: date.toISOString(),
    });
  }
  return dates;
}

// ── Field components ─────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[12px] font-medium" style={{ color: 'var(--text-2)' }}>
      {children}
    </label>
  );
}

// ── Step 1: Search ───────────────────────────────────────────────────────────

/** SearchStep props — search function and UI text vary by platform */
interface SearchStepProps {
  onSelect: (p: SolvedProblem) => void;
  platform: 'BOJ' | 'PROGRAMMERS';
  searchFn: (query: string) => Promise<SolvedProblem[]>;
  onPlatformChange: (p: 'BOJ' | 'PROGRAMMERS') => void;
}

function SearchStep({ onSelect, platform, searchFn, onPlatformChange }: SearchStepProps) {
  const t = useTranslations('problems');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SolvedProblem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  /* Reset search results on platform switch */
  useEffect(() => {
    setQuery('');
    setResults([]);
    setError('');
  }, [platform]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!query.trim()) { setResults([]); setError(''); return; }

    timerRef.current = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const items = await searchFn(query.trim());
        setResults(items.slice(0, 10));
      } catch {
        setError(t('addModal.error.searchError'));
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query, searchFn, t]);

  /** Platform-specific placeholder text */
  const placeholder = platform === 'BOJ'
    ? t('addModal.search.placeholderBoj')
    : t('addModal.search.placeholderProgrammers');

  /** Platform-specific helper text */
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
              const tierLabel = platform === 'BOJ'
                ? (TIER_NAMES[p.level] ?? 'Unrated')
                : (PROGRAMMERS_LEVEL_LABELS[p.level] ?? `Lv.${p.level}`);
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

// ── Step 2: Confirm ──────────────────────────────────────────────────────────

function ConfirmStep({
  problem,
  platform,
  onBack,
  onAdd,
  isAdding,
  addError,
}: {
  problem: SolvedProblem;
  platform: 'BOJ' | 'PROGRAMMERS';
  onBack: () => void;
  onAdd: (weekNumber: string, deadline: string) => void;
  isAdding?: boolean;
  addError?: string | null;
}) {
  const t = useTranslations('problems');
  const tErrors = useTranslations('errors');
  const [weekKey, setWeekKey] = useState('');
  const [deadline, setDeadline] = useState('');
  const [errors, setErrors] = useState<{ weekNumber?: string; deadline?: string }>({});

  const resolvedDiff = problem.difficulty ?? toOurDiff(problem.level).difficulty;
  const cfg = DIFFICULTY_CONFIG[resolvedDiff];
  const tierLabel = platform === 'BOJ'
    ? (TIER_NAMES[problem.level] ?? 'Unrated')
    : (PROGRAMMERS_LEVEL_LABELS[problem.level] ?? `Lv.${problem.level}`);
  const tags = problem.tags.slice(0, 5);

  /** Week options (memoized) */
  const weekOptions = useMemo(() => generateWeekData(), []);

  /** Parsed month/week from selected key */
  const selectedWeek = useMemo(() => {
    if (!weekKey) return null;
    const opt = weekOptions.find((w) => w.key === weekKey);
    return opt ?? null;
  }, [weekKey, weekOptions]);

  /** Date options for the selected week */
  const dateOptions = useMemo(() => {
    if (!selectedWeek) return [];
    return getWeekDateData(selectedWeek.month, selectedWeek.week).map((d) => {
      const dayName = t(`addModal.dayNames.${DAY_KEYS[d.dayIndex]}`);
      return {
        label: t('addModal.confirm.dateFormat', { dayName, month: d.month, day: d.day }),
        value: d.value,
      };
    });
  }, [selectedWeek, t]);

  function validate() {
    const e: typeof errors = {};
    if (!weekKey) e.weekNumber = t('addModal.validation.weekRequired');
    if (!deadline) {
      e.deadline = t('addModal.validation.deadlineRequired');
    } else if (new Date(deadline) < new Date()) {
      e.deadline = t('addModal.validation.deadlinePast');
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleAdd() {
    if (!validate()) return;
    // Canonical DB format (locale-independent) — backend/dashboard regex expects "N월M주차"
    const weekNumber = selectedWeek
      ? `${selectedWeek.month}월${selectedWeek.week}주차`
      : '';
    onAdd(weekNumber, deadline);
  }

  return (
    <div className="flex flex-col">
      {/* Back button row */}
      <div className="px-5 pt-4 pb-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-[12px] transition-opacity hover:opacity-70"
          style={{ color: 'var(--text-3)' }}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t('addModal.confirm.back')}
        </button>
      </div>

      <div className="space-y-4 overflow-y-auto px-5 pb-5" style={{ maxHeight: 'calc(100dvh - 260px)' }}>
        {/* Problem info card */}
        <div
          className="rounded-card border p-4"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="flex items-start gap-3">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[11px] font-bold"
              style={{ background: cfg.bg, color: cfg.color }}
            >
              {platform === 'PROGRAMMERS' ? 'PG' : 'BOJ'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold" style={{ color: 'var(--text)' }}>
                {problem.titleKo}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span
                  className="inline-flex items-center gap-1 rounded-badge px-1.5 py-0.5 text-[10px] font-semibold"
                  style={{ background: cfg.bg, color: cfg.color }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: cfg.color }} />
                  {tierLabel}
                </span>
                {/* SQL badge — confirm step */}
                {platform === 'PROGRAMMERS' && isSqlProblem(problem) && (
                  <span
                    className="rounded-badge px-1.5 py-0.5 text-[10px] font-semibold"
                    style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}
                  >
                    SQL
                  </span>
                )}
                <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>
                  #{problem.problemId}
                </span>
                {tags.map((tg) => (
                  <span
                    key={tg}
                    className="rounded-badge px-1.5 py-0.5 text-[10px]"
                    style={{ background: 'var(--bg-card)', color: 'var(--text-3)' }}
                  >
                    {tg}
                  </span>
                ))}
              </div>
            </div>
            {/* External link */}
            <a
              href={problem.sourceUrl ?? (platform === 'PROGRAMMERS'
                ? `https://school.programmers.co.kr/learn/courses/30/lessons/${problem.problemId}`
                : `https://www.acmicpc.net/problem/${problem.problemId}`)}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="shrink-0 rounded-btn p-1.5 transition-opacity hover:opacity-70"
              style={{ background: 'var(--bg-card)', color: 'var(--text-3)' }}
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

        {/* Week number */}
        <div className="space-y-1.5">
          <FieldLabel>{t('addModal.confirm.weekLabel')}</FieldLabel>
          <select
            value={weekKey}
            onChange={(e) => { setWeekKey(e.target.value); setDeadline(''); setErrors((er) => ({ ...er, weekNumber: undefined })); }}
            className="h-9 w-full rounded-btn border px-3 text-[13px] outline-none transition-[border-color] appearance-none bg-[length:16px] bg-[right_8px_center] bg-no-repeat"
            style={{
              borderColor: errors.weekNumber ? 'var(--error)' : 'var(--border)',
              color: weekKey ? 'var(--text)' : 'var(--text-3)',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m4 6 4 4 4-4'/%3E%3C/svg%3E")`,
            }}
            onFocus={(e) => !errors.weekNumber && (e.currentTarget.style.borderColor = 'var(--primary)')}
            onBlur={(e) => (e.currentTarget.style.borderColor = errors.weekNumber ? 'var(--error)' : 'var(--border)')}
          >
            <option value="" disabled>{t('addModal.confirm.weekPlaceholder')}</option>
            {weekOptions.map((w) => (
              <option key={w.key} value={w.key}>
                {t('addModal.confirm.weekFormat', { month: w.month, week: w.week })}
              </option>
            ))}
          </select>
          {errors.weekNumber && (
            <p className="text-[11px]" style={{ color: 'var(--error)' }}>{tErrors(errors.weekNumber)}</p>
          )}
        </div>

        {/* Deadline */}
        <div className="space-y-1.5">
          <FieldLabel>{t('addModal.confirm.deadlineLabel')}</FieldLabel>
          <select
            value={deadline}
            onChange={(e) => { setDeadline(e.target.value); setErrors((er) => ({ ...er, deadline: undefined })); }}
            disabled={!weekKey}
            className="h-9 w-full rounded-btn border px-3 text-[13px] outline-none transition-[border-color] appearance-none bg-[length:16px] bg-[right_8px_center] bg-no-repeat disabled:opacity-50"
            style={{
              borderColor: errors.deadline ? 'var(--error)' : 'var(--border)',
              color: deadline ? 'var(--text)' : 'var(--text-3)',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m4 6 4 4 4-4'/%3E%3C/svg%3E")`,
            }}
            onFocus={(e) => !errors.deadline && (e.currentTarget.style.borderColor = 'var(--primary)')}
            onBlur={(e) => (e.currentTarget.style.borderColor = errors.deadline ? 'var(--error)' : 'var(--border)')}
          >
            <option value="" disabled>{weekKey ? t('addModal.confirm.deadlinePlaceholder') : t('addModal.confirm.deadlinePlaceholderDisabled')}</option>
            {dateOptions.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
          {errors.deadline && (
            <p className="text-[11px]" style={{ color: 'var(--error)' }}>{tErrors(errors.deadline)}</p>
          )}
        </div>
      </div>

      {/* Footer */}
      <div
        className="flex items-center justify-end gap-2 border-t px-5 py-3.5"
        style={{ borderColor: 'var(--border)' }}
      >
        <Btn variant="outline" size="md" onClick={onBack} disabled={isAdding}>{t('addModal.confirm.backButton')}</Btn>
        <Btn variant="primary" size="md" onClick={handleAdd} disabled={isAdding}>
          {isAdding ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          {isAdding ? t('addModal.confirm.adding') : t('addModal.confirm.addButton')}
        </Btn>
      </div>
      {addError && (
        <div className="px-5 pb-3">
          <p className="text-[11px] font-medium" style={{ color: 'var(--error)' }}>
            <AlertCircle className="inline h-3 w-3 mr-1" />
            {addError}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Main Modal ───────────────────────────────────────────────────────────────

type Step = 'search' | 'confirm';

export interface NewProblemData {
  id: string;
  title: string;
  difficulty: Difficulty;
  level: number;
  weekNumber: string;
  status: 'ACTIVE';
  deadline: string;
  tags: string[];
  sourceUrl: string;
  sourcePlatform: 'BOJ' | 'PROGRAMMERS';
  description: string;
}

interface AddProblemModalProps {
  open: boolean;
  onClose: () => void;
  onAdd?: (problem: NewProblemData) => void;
}

export function AddProblemModal({ open, onClose, onAdd: onAddCallback }: AddProblemModalProps) {
  const t = useTranslations('problems');
  const [step, setStep] = useState<Step>('search');
  const [selected, setSelected] = useState<SolvedProblem | null>(null);
  const [platform, setPlatform] = useState<'BOJ' | 'PROGRAMMERS'>('PROGRAMMERS');
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const { currentStudyId } = useStudy();

  function handleClose() {
    setStep('search');
    setSelected(null);
    setAddError(null);
    onClose();
  }

  function handleSelect(p: SolvedProblem) {
    setSelected(p);
    setStep('confirm');
  }

  async function handleAdd(weekNumber: string, deadline: string) {
    if (!selected || isAdding) return;

    const resolvedDiff = selected.difficulty ?? toOurDiff(selected.level).difficulty;
    const diffLevel = selected.difficulty ? selected.level : toOurDiff(selected.level).level;
    const sql = isSqlProblem(selected);
    const tagNames = sql
      ? mergeSqlTag(selected.tags.slice(0, 5))
      : selected.tags.slice(0, 5);

    setIsAdding(true);
    setAddError(null);

    try {
      const sourceUrl = selected.sourceUrl ?? (platform === 'PROGRAMMERS'
        ? `https://school.programmers.co.kr/learn/courses/30/lessons/${selected.problemId}`
        : `https://www.acmicpc.net/problem/${selected.problemId}`);

      const data: CreateProblemData = {
        title: selected.titleKo,
        weekNumber,
        difficulty: resolvedDiff as CreateProblemData['difficulty'],
        level: diffLevel,
        deadline: new Date(deadline).toISOString(),
        tags: tagNames,
        sourceUrl,
        sourcePlatform: platform,
        ...(sql && { allowedLanguages: ['sql'] }),
      };

      const created = await problemApi.create(data);

      if (currentStudyId) {
        void studyApi.notifyProblemCreated(currentStudyId, {
          problemId: created.id,
          problemTitle: created.title,
          weekNumber,
        }).catch(() => {});
      }

      onAddCallback?.({
        id: created.id,
        title: created.title,
        difficulty: created.difficulty as Difficulty,
        level: created.level ?? diffLevel,
        weekNumber: created.weekNumber,
        status: 'ACTIVE' as const,
        deadline: created.deadline,
        tags: created.tags ?? tagNames,
        sourceUrl: created.sourceUrl ?? data.sourceUrl ?? '',
        sourcePlatform: created.sourcePlatform ?? platform,
        description: created.description ?? '',
      });
      handleClose();
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : t('addModal.error.addFailed'));
    } finally {
      setIsAdding(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && handleClose()}>
      <Dialog.Portal>
        {/* Overlay */}
        <Dialog.Overlay
          className="fixed inset-0 z-50"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)' }}
        />

        {/* Panel */}
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-card outline-none overflow-hidden"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between border-b px-5 py-4"
            style={{ borderColor: 'var(--border)' }}
          >
            <div className="flex items-center gap-2.5">
              {/* Platform icon */}
              <div
                className="flex h-7 w-7 items-center justify-center rounded-md text-[9px] font-black"
                style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}
              >
                {platform === 'PROGRAMMERS' ? 'PG' : 'BOJ'}
              </div>
              <div>
                <Dialog.Title
                  className="text-[14px] font-semibold"
                  style={{ color: 'var(--text)' }}
                >
                  {step === 'search'
                    ? (platform === 'BOJ' ? t('addModal.header.searchTitleBoj') : t('addModal.header.searchTitleProgrammers'))
                    : t('addModal.header.confirmTitle')}
                </Dialog.Title>
                <Dialog.Description className="text-[11px]" style={{ color: 'var(--text-3)' }}>
                  {step === 'search'
                    ? t('addModal.header.searchDescription')
                    : t('addModal.header.confirmDescription')}
                </Dialog.Description>
              </div>
            </div>

            {/* Step indicator */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                {(['search', 'confirm'] as Step[]).map((s) => (
                  <div
                    key={s}
                    className="h-1.5 rounded-full transition-all duration-300"
                    style={{
                      width: step === s ? '20px' : '6px',
                      background: step === s ? 'var(--primary)' : 'var(--border)',
                    }}
                  />
                ))}
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="flex h-7 w-7 items-center justify-center rounded-btn transition-opacity hover:opacity-70"
                  style={{ background: 'var(--bg-alt)', color: 'var(--text-3)' }}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </Dialog.Close>
            </div>
          </div>

          {/* Body */}
          {step === 'search' && (
            <SearchStep
              onSelect={handleSelect}
              platform={platform}
              searchFn={platform === 'BOJ' ? searchSolvedAC : searchProgrammers}
              onPlatformChange={(p) => { setPlatform(p); }}
            />
          )}
          {step === 'confirm' && selected && (
            <ConfirmStep
              problem={selected}
              platform={platform}
              onBack={() => setStep('search')}
              onAdd={(w, d) => void handleAdd(w, d)}
              isAdding={isAdding}
              addError={addError}
            />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
