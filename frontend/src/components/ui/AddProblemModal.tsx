/**
 * AddProblemModal
 * Step 1: BOJ 문제 검색 (solved.ac API)
 * Step 2: 주차 / 마감일 설정 후 추가
 */

import { useState, useEffect, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {
  Search, X, ArrowLeft, Plus, Loader2, ExternalLink, CalendarDays, AlertCircle,
} from 'lucide-react';
import { Btn, type Difficulty, DIFFICULTY_CONFIG } from './AlgosuUI';

// ── solved.ac types ──────────────────────────────────────────────────────────

interface SolvedTag {
  key: string;
  displayNames: { language: string; name: string; short: string }[];
}

export interface SolvedProblem {
  problemId: number;
  titleKo: string;
  level: number; // 0=unrated, 1-5=Bronze, 6-10=Silver, 11-15=Gold, 16-20=Platinum, 21-25=Diamond
  tags: SolvedTag[];
  acceptedUserCount: number;
}

// solved.ac level → our Difficulty + level
function toOurDiff(solvedLevel: number): { difficulty: Difficulty; level: number } {
  if (solvedLevel === 0) return { difficulty: 'BRONZE', level: 1 };
  const tiers: Difficulty[] = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND', 'RUBY'];
  const tierIdx = Math.min(Math.floor((solvedLevel - 1) / 5), 5);
  const lvl = ((solvedLevel - 1) % 5) + 1;
  return { difficulty: tiers[tierIdx], level: lvl };
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

async function searchSolvedAC(query: string): Promise<SolvedProblem[]> {
  const res = await fetch(
    `https://solved.ac/api/v3/search/problem?query=${encodeURIComponent(query)}&page=1`,
    { headers: { Accept: 'application/json' } },
  );
  if (!res.ok) throw new Error(`solved.ac API error: ${res.status}`);
  const data = await res.json();
  return (data.items ?? []) as SolvedProblem[];
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

function SearchStep({ onSelect }: { onSelect: (p: SolvedProblem) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SolvedProblem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!query.trim()) { setResults([]); setError(''); return; }

    timerRef.current = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const items = await searchSolvedAC(query.trim());
        setResults(items.slice(0, 10));
      } catch {
        setError('검색 중 오류가 발생했습니다. 다시 시도해주세요.');
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query]);

  const tagName = (tag: SolvedTag) =>
    tag.displayNames.find((d) => d.language === 'ko')?.name ?? tag.key;

  return (
    <div className="flex flex-col" style={{ minHeight: 320 }}>
      {/* Search input */}
      <div className="px-5 pt-5 pb-3">
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 pointer-events-none"
            style={{ color: 'var(--text-3)' }}
          />
          <input
            ref={inputRef}
            type="search"
            placeholder="문제 번호 또는 제목으로 검색…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-10 w-full rounded-btn border pl-9 pr-10 text-[13px] outline-none"
            style={{
              background: 'var(--input-bg)',
              borderColor: 'var(--primary)',
              color: 'var(--text)',
              boxShadow: '0 0 0 3px var(--primary-soft)',
            }}
          />
          {loading && (
            <Loader2
              className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin"
              style={{ color: 'var(--primary)' }}
            />
          )}
        </div>
        <p className="mt-2 text-[11px]" style={{ color: 'var(--text-3)' }}>
          solved.ac 기반으로 검색됩니다.
        </p>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-5 pb-5" style={{ maxHeight: 360 }}>
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
              백준 문제를 검색하세요
            </p>
            <p className="mt-1 text-[11px]" style={{ color: 'var(--text-3)' }}>
              문제 번호(예: 1000) 또는 문제 이름을 입력하세요.
            </p>
          </div>
        )}

        {/* No results */}
        {query.trim() && !loading && results.length === 0 && !error && (
          <div className="py-12 text-center">
            <p className="text-[13px] font-medium" style={{ color: 'var(--text-2)' }}>
              검색 결과가 없습니다
            </p>
            <p className="mt-1 text-[11px]" style={{ color: 'var(--text-3)' }}>
              다른 키워드로 검색해보세요.
            </p>
          </div>
        )}

        {/* Results list */}
        {results.length > 0 && (
          <div className="space-y-1.5">
            {results.map((p) => {
              const { difficulty } = toOurDiff(p.level);
              const cfg = DIFFICULTY_CONFIG[difficulty];
              const tierLabel = TIER_NAMES[p.level] ?? 'Unrated';
              const tags = p.tags.slice(0, 3).map(tagName);

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
                      {/* Tags */}
                      {tags.map((t) => (
                        <span
                          key={t}
                          className="rounded-badge px-1.5 py-0.5 text-[10px] font-medium"
                          style={{ background: 'var(--bg-alt)', color: 'var(--text-3)' }}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Solved count */}
                  <div className="shrink-0 text-right">
                    <p className="text-[10px]" style={{ color: 'var(--text-3)' }}>
                      {p.acceptedUserCount.toLocaleString()}명 해결
                    </p>
                  </div>
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
  onBack,
  onAdd,
}: {
  problem: SolvedProblem;
  onBack: () => void;
  onAdd: (weekNumber: string, deadline: string) => void;
}) {
  const [weekNumber, setWeekNumber] = useState('');
  const [deadline, setDeadline] = useState('');
  const [errors, setErrors] = useState<{ weekNumber?: string; deadline?: string }>({});

  const { difficulty } = toOurDiff(problem.level);
  const cfg = DIFFICULTY_CONFIG[difficulty];
  const tierLabel = TIER_NAMES[problem.level] ?? 'Unrated';
  const tags = problem.tags.slice(0, 5).map(
    (t) => t.displayNames.find((d) => d.language === 'ko')?.name ?? t.key,
  );

  function validate() {
    const e: typeof errors = {};
    if (!weekNumber.trim()) e.weekNumber = '주차를 입력하세요.';
    if (!deadline) e.deadline = '마감일을 선택하세요.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleAdd() {
    if (!validate()) return;
    onAdd(weekNumber.trim(), deadline);
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
          검색으로 돌아가기
        </button>
      </div>

      <div className="space-y-4 overflow-y-auto px-5 pb-5" style={{ maxHeight: 'calc(100dvh - 260px)' }}>
        {/* Problem info card */}
        <div
          className="rounded-card border p-4"
          style={{ background: 'var(--bg-alt)', borderColor: 'var(--border)' }}
        >
          <div className="flex items-start gap-3">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[11px] font-bold"
              style={{ background: cfg.bg, color: cfg.color }}
            >
              BOJ
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
                <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>
                  #{problem.problemId}
                </span>
                {tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-badge px-1.5 py-0.5 text-[10px]"
                    style={{ background: 'var(--bg-card)', color: 'var(--text-3)' }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
            {/* BOJ link */}
            <a
              href={`https://www.acmicpc.net/problem/${problem.problemId}`}
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
          <FieldLabel>주차 *</FieldLabel>
          <input
            type="text"
            placeholder="예) 3월2주차"
            value={weekNumber}
            onChange={(e) => { setWeekNumber(e.target.value); setErrors((er) => ({ ...er, weekNumber: undefined })); }}
            className="h-9 w-full rounded-btn border px-3 text-[13px] outline-none transition-[border-color]"
            style={{
              background: 'var(--input-bg)',
              borderColor: errors.weekNumber ? 'var(--error)' : 'var(--border)',
              color: 'var(--text)',
            }}
            onFocus={(e) => !errors.weekNumber && (e.currentTarget.style.borderColor = 'var(--primary)')}
            onBlur={(e) => (e.currentTarget.style.borderColor = errors.weekNumber ? 'var(--error)' : 'var(--border)')}
          />
          {errors.weekNumber && (
            <p className="text-[11px]" style={{ color: 'var(--error)' }}>{errors.weekNumber}</p>
          )}
        </div>

        {/* Deadline */}
        <div className="space-y-1.5">
          <FieldLabel>마감일 *</FieldLabel>
          <div className="relative">
            <CalendarDays
              className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 pointer-events-none"
              style={{ color: 'var(--text-3)' }}
            />
            <input
              type="date"
              value={deadline}
              onChange={(e) => { setDeadline(e.target.value); setErrors((er) => ({ ...er, deadline: undefined })); }}
              className="h-9 w-full rounded-btn border pl-8 pr-3 text-[13px] outline-none transition-[border-color]"
              style={{
                background: 'var(--input-bg)',
                borderColor: errors.deadline ? 'var(--error)' : 'var(--border)',
                color: deadline ? 'var(--text)' : 'var(--text-3)',
                colorScheme: 'dark',
              }}
              onFocus={(e) => !errors.deadline && (e.currentTarget.style.borderColor = 'var(--primary)')}
              onBlur={(e) => (e.currentTarget.style.borderColor = errors.deadline ? 'var(--error)' : 'var(--border)')}
            />
          </div>
          {errors.deadline && (
            <p className="text-[11px]" style={{ color: 'var(--error)' }}>{errors.deadline}</p>
          )}
        </div>
      </div>

      {/* Footer */}
      <div
        className="flex items-center justify-end gap-2 border-t px-5 py-3.5"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-alt)' }}
      >
        <Btn variant="outline" size="md" onClick={onBack}>뒤로</Btn>
        <Btn variant="primary" size="md" onClick={handleAdd}>
          <Plus className="h-3.5 w-3.5" />
          문제 추가
        </Btn>
      </div>
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
  sourcePlatform: string;
  description: string;
}

interface AddProblemModalProps {
  open: boolean;
  onClose: () => void;
  onAdd?: (problem: NewProblemData) => void;
}

export function AddProblemModal({ open, onClose, onAdd: onAddCallback }: AddProblemModalProps) {
  const [step, setStep] = useState<Step>('search');
  const [selected, setSelected] = useState<SolvedProblem | null>(null);

  function handleClose() {
    setStep('search');
    setSelected(null);
    onClose();
  }

  function handleSelect(p: SolvedProblem) {
    setSelected(p);
    setStep('confirm');
  }

  function handleAdd(weekNumber: string, deadline: string) {
    if (!selected) return;

    const { difficulty, level: diffLevel } = toOurDiff(selected.level);
    const tagNames = selected.tags
      .slice(0, 5)
      .map((t) => t.displayNames.find((d) => d.language === 'ko')?.name ?? t.key);

    const newProblem = {
      id: `prob-${Date.now()}`,
      title: selected.titleKo,
      difficulty,
      level: diffLevel,
      weekNumber,
      status: 'ACTIVE' as const,
      deadline: new Date(deadline).toISOString(),
      tags: tagNames,
      sourceUrl: `https://www.acmicpc.net/problem/${selected.problemId}`,
      sourcePlatform: 'BOJ',
      description: '',
    };

    onAddCallback?.(newProblem);
    handleClose();
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
              {/* BOJ logo-ish icon */}
              <div
                className="flex h-7 w-7 items-center justify-center rounded-md text-[9px] font-black"
                style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}
              >
                BOJ
              </div>
              <div>
                <Dialog.Title
                  className="text-[14px] font-semibold"
                  style={{ color: 'var(--text)' }}
                >
                  {step === 'search' ? '백준 문제 검색' : '문제 추가'}
                </Dialog.Title>
                <Dialog.Description className="text-[11px]" style={{ color: 'var(--text-3)' }}>
                  {step === 'search'
                    ? '추가할 문제를 검색하여 선택하세요.'
                    : '주차와 마감일을 설정하세요.'}
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
          {step === 'search' && <SearchStep onSelect={handleSelect} />}
          {step === 'confirm' && selected && (
            <ConfirmStep
              problem={selected}
              onBack={() => setStep('search')}
              onAdd={handleAdd}
            />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}