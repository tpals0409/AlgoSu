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
import { Search, X, Loader2, AlertCircle, RefreshCw, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { DIFFICULTY_CONFIG } from '../AlgosuUI';
import { PROGRAMMERS_LEVEL_LABELS } from '@/lib/constants';
import { useProblemRecommendation } from '@/hooks/use-problem-recommendation';
import type { RecommendationItem, RecommendationDifficulty } from '@/lib/api';
import {
  toOurDiff,
  resolveTierLabel,
  recommendationToSolvedProblem,
  type Platform,
  type SolvedProblem,
} from './problem-search.utils';

/**
 * 추천에서 선택 가능한 난이도 — 정적 seed가 커버하는 3티어(Bronze/Silver/Gold).
 * seed 폴백이 항상 결과를 보장하므로 빈 추천이 나오지 않는다(Sprint 256).
 */
const RECOMMENDABLE_DIFFICULTIES: readonly RecommendationDifficulty[] = [
  'BRONZE',
  'SILVER',
  'GOLD',
];

/**
 * 프로그래머스 네이티브 레벨 ↔ 내부 Difficulty 밴드 매핑.
 * recommendation-seeds 계약(Lv.1→BRONZE, Lv.2→SILVER, Lv.3→GOLD)과 1:1 대응.
 * 전송 값은 enum(Difficulty) 그대로 — 라벨만 플랫폼 체계에 맞춰 바꾼다.
 */
const PROGRAMMERS_LEVEL_BY_DIFFICULTY: Record<'BRONZE' | 'SILVER' | 'GOLD', number> = {
  BRONZE: 1,
  SILVER: 2,
  GOLD: 3,
};

/**
 * 플랫폼별 난이도 칩 라벨.
 * - BOJ: solved.ac 티어명(Bronze/Silver/Gold)
 * - PROGRAMMERS: 네이티브 레벨(Lv.1/Lv.2/Lv.3)
 * 백준과 프로그래머스는 난이도 체계가 다르므로 사용자가 보는 라벨을 분리한다.
 */
function difficultyChipLabel(
  platform: Platform,
  d: RecommendationDifficulty,
): string {
  if (platform === 'PROGRAMMERS') {
    const lv = PROGRAMMERS_LEVEL_BY_DIFFICULTY[d as 'BRONZE' | 'SILVER' | 'GOLD'];
    return PROGRAMMERS_LEVEL_LABELS[lv] ?? DIFFICULTY_CONFIG[d].label;
  }
  return DIFFICULTY_CONFIG[d].label;
}

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

  // 추천 난이도 선택 — undefined면 스터디 추론(자동), 값 지정 시 해당 난이도 (Sprint 256).
  const [recDifficulty, setRecDifficulty] = useState<
    RecommendationDifficulty | undefined
  >(undefined);

  // Recommendation section — hybrid prefetch + client rotation (Sprint 254).
  // 추천도 플랫폼 토글에 종속 — 탭 전환 시 해당 플랫폼 추천으로 재조회 (Sprint 255).
  // 난이도 선택 시 해당 난이도로 재조회 (Sprint 256).
  const rec = useProblemRecommendation({ platform, difficulty: recDifficulty });

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

      {/* Recommendation section — hybrid prefetch + client rotation */}
      <RecommendationSection
        platform={platform}
        current={rec.current}
        loading={rec.loading}
        error={rec.error}
        onRefresh={rec.refresh}
        onSelect={onSelect}
        difficulty={recDifficulty}
        onDifficultyChange={setRecDifficulty}
      />

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

/** {@link RecommendationSection} props */
interface RecommendationSectionProps {
  /** 현재 플랫폼 — 난이도 칩 라벨 체계(BOJ 티어 vs 프로그래머스 레벨)를 결정 */
  platform: Platform;
  current: RecommendationItem | null;
  loading: boolean;
  error: boolean;
  onRefresh: () => void;
  onSelect: (p: SolvedProblem) => void;
  /** 선택된 추천 난이도 — undefined면 "자동"(스터디 추론) */
  difficulty: RecommendationDifficulty | undefined;
  /** 난이도 칩 선택 콜백 — 같은 칩 재클릭 시 undefined(자동)로 토글 */
  onDifficultyChange: (d: RecommendationDifficulty | undefined) => void;
}

/**
 * "추천 문제" 섹션 — 기본 후보 1개 + [새로고침] 버튼.
 *
 * 카드 본문 클릭 시 추천 항목을 {@link SolvedProblem}으로 매핑해 상위
 * `onSelect`로 전달하므로 기존 검색 → confirm 파이프라인을 그대로 재사용한다.
 * 추천이 아예 없을 때(에러/소진 + current 없음)는 섹션을 렌더하지 않아
 * 검색 UX를 방해하지 않는다.
 */
function RecommendationSection({
  platform,
  current,
  loading,
  error,
  onRefresh,
  onSelect,
  difficulty,
  onDifficultyChange,
}: RecommendationSectionProps) {
  const t = useTranslations('problems');

  const resolvedDiff = current?.difficulty ?? undefined;
  const cfg = resolvedDiff ? DIFFICULTY_CONFIG[resolvedDiff] : null;
  const tags = (current?.tags ?? []).slice(0, 3);

  return (
    <div className="px-5 pt-3">
      <div className="mb-1.5 flex items-center justify-between">
        <span
          className="inline-flex items-center gap-1 text-[11px] font-semibold"
          style={{ color: 'var(--text-2)' }}
        >
          <Sparkles className="h-3 w-3" style={{ color: 'var(--primary)' }} />
          {t('addModal.recommend.sectionTitle')}
        </span>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-btn px-2 py-1 text-[11px] font-medium transition-opacity hover:opacity-70 disabled:opacity-50"
          style={{ background: 'var(--bg-alt)', color: 'var(--text-3)' }}
        >
          <RefreshCw className={`h-3 w-3${loading ? ' animate-spin' : ''}`} />
          {t('addModal.recommend.refresh')}
        </button>
      </div>

      {/* Difficulty selector — 자동 + seed-backed 3티어 (Sprint 256)
          라벨은 플랫폼 체계에 종속: BOJ=티어, 프로그래머스=Lv (Sprint 257) */}
      <div
        className="mb-1.5 flex flex-wrap gap-1"
        role="group"
        aria-label={t('addModal.recommend.difficultyAria')}
      >
        {/* 자동(전체) 칩 */}
        <DifficultyChip
          label={t('addModal.recommend.difficultyAuto')}
          selected={difficulty === undefined}
          onClick={() => onDifficultyChange(undefined)}
        />
        {RECOMMENDABLE_DIFFICULTIES.map((d) => (
          <DifficultyChip
            key={d}
            label={difficultyChipLabel(platform, d)}
            color={DIFFICULTY_CONFIG[d].color}
            bg={DIFFICULTY_CONFIG[d].bg}
            selected={difficulty === d}
            // 같은 칩 재클릭 시 자동(undefined)으로 토글.
            onClick={() => onDifficultyChange(difficulty === d ? undefined : d)}
          />
        ))}
      </div>

      {current ? (
        <button
          type="button"
          onClick={() => onSelect(recommendationToSolvedProblem(current))}
          className="group flex w-full items-start gap-3 rounded-card border px-4 py-3 text-left transition-all hover:-translate-y-0.5"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--primary)';
            e.currentTarget.style.boxShadow = '0 0 0 1px var(--primary), var(--shadow-hover)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <div className="min-w-0 flex-1">
            <p
              className="truncate text-[13px] font-semibold"
              style={{ color: 'var(--text)' }}
            >
              {current.title}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {cfg && (
                <span
                  className="inline-flex items-center gap-1 rounded-badge px-1.5 py-0.5 text-[10px] font-semibold"
                  style={{ background: cfg.bg, color: cfg.color }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: cfg.color }} />
                  {cfg.label}
                </span>
              )}
              {current.category === 'SQL' && (
                <span
                  className="rounded-badge px-1.5 py-0.5 text-[10px] font-semibold"
                  style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}
                >
                  SQL
                </span>
              )}
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
          <span className="shrink-0 text-[10px]" style={{ color: 'var(--text-3)' }}>
            {current.sourcePlatform}
          </span>
        </button>
      ) : loading ? (
        <div
          className="flex items-center gap-2 rounded-card border px-4 py-3 text-[12px]"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-3)' }}
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: 'var(--primary)' }} />
          {t('addModal.recommend.loading')}
        </div>
      ) : (
        <div
          className="rounded-card border px-4 py-3 text-[12px]"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-3)' }}
        >
          {error
            ? t('addModal.recommend.error')
            : t('addModal.recommend.empty')}
        </div>
      )}
    </div>
  );
}

/** {@link DifficultyChip} props */
interface DifficultyChipProps {
  label: string;
  selected: boolean;
  onClick: () => void;
  /** 난이도 컬러(선택 시 강조) — "자동" 칩은 미지정 → primary 사용 */
  color?: string;
  bg?: string;
}

/**
 * 추천 난이도 선택 칩 — 선택 시 해당 난이도 컬러로 채우고, 미선택 시 중립 배경.
 * "자동" 칩은 난이도 컬러가 없어 primary 토큰으로 강조한다.
 */
function DifficultyChip({ label, selected, onClick, color, bg }: DifficultyChipProps) {
  const selectedBg = bg ?? 'var(--primary-soft)';
  const selectedColor = color ?? 'var(--primary)';
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className="rounded-badge px-2 py-0.5 text-[10px] font-semibold transition-all"
      style={
        selected
          ? { background: selectedBg, color: selectedColor, boxShadow: `inset 0 0 0 1px ${selectedColor}` }
          : { background: 'var(--bg-alt)', color: 'var(--text-3)' }
      }
    >
      {label}
    </button>
  );
}
