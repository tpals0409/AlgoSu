/**
 * AddProblemModal
 * Step 1: BOJ 문제 검색 (solved.ac API)
 * Step 2: 주차 / 마감일 설정 후 추가
 */

import { useState, useEffect, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {
  Search, X, ArrowLeft, Plus, Loader2, ExternalLink, AlertCircle,
} from 'lucide-react';
import { Btn, type Difficulty, DIFFICULTY_CONFIG } from './AlgosuUI';
import { problemApi, solvedacApi, studyApi, type CreateProblemData } from '@/lib/api';
import { useStudy } from '@/contexts/StudyContext';

// ── solved.ac types ──────────────────────────────────────────────────────────
// Gateway `/api/external/solvedac/search`가 한국어 태그명으로 평탄화된 `string[]`을 반환한다.
// 직접 solved.ac 호출 시의 `{ key, displayNames[] }` 구조는 Gateway 레이어가 흡수한다.

export interface SolvedProblem {
  problemId: number;
  titleKo: string;
  level: number; // 0=unrated, 1-5=Bronze, 6-10=Silver, 11-15=Gold, 16-20=Platinum, 21-25=Diamond
  tags: string[];
  acceptedUserCount: number;
}

// solved.ac level(0~30) → our Difficulty + level(원시값 그대로 저장)
function toOurDiff(solvedLevel: number): { difficulty: Difficulty; level: number } {
  if (solvedLevel <= 0) return { difficulty: 'BRONZE', level: 1 };
  const tiers: Difficulty[] = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND', 'RUBY'];
  const tierIdx = Math.min(Math.floor((solvedLevel - 1) / 5), 5);
  return { difficulty: tiers[tierIdx], level: solvedLevel };
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
 * Gateway의 `/api/external/solvedac/search` 프록시 호출.
 * 직접 solved.ac 호출 시 Referer 헤더로 403이 발생해 Gateway 경유 필수.
 */
async function searchSolvedAC(query: string): Promise<SolvedProblem[]> {
  const data = await solvedacApi.searchByQuery(query, 1);
  if (!data || !Array.isArray(data.items)) {
    throw new Error('검색 결과를 불러오지 못했습니다. 다시 시도해주세요.');
  }
  return data.items.map((item) => ({
    problemId: item.problemId,
    titleKo: item.titleKo ?? item.title ?? `#${item.problemId}`,
    level: item.level,
    tags: item.tags ?? [],
    acceptedUserCount: item.acceptedUserCount ?? 0,
  }));
}

// ── 주차 계산 (단순 7일 구간) ─────────────────────────────────────────────────

const DOW_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

/** 현재 주차부터 이후 주차만 표시 (현재 월 + 다음달 1주차) */
function generateWeekOptions(): string[] {
  const now = new Date();
  const month = now.getMonth() + 1;
  const currentWeek = Math.ceil(now.getDate() / 7);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const totalWeeks = Math.ceil(lastDay / 7);
  const options: string[] = [];
  for (let w = currentWeek; w <= totalWeeks; w++) {
    options.push(`${month}월${w}주차`);
  }
  const nextMonth = month === 12 ? 1 : month + 1;
  options.push(`${nextMonth}월1주차`);
  return options;
}

/** 주차 문자열 → 해당 주의 날짜 목록 (단순 7일 구간, KST 23:59:59) */
function getWeekDates(weekStr: string): { label: string; value: string }[] {
  const match = weekStr.match(/(\d+)월(\d+)주차/);
  if (!match) return [];
  const month = parseInt(match[1]);
  const week = parseInt(match[2]);
  const now = new Date();
  const year = now.getFullYear();
  const adjustedYear = month < now.getMonth() + 1 && month === 1 ? year + 1 : year;
  const daysInMonth = new Date(adjustedYear, month, 0).getDate();

  const startDate = (week - 1) * 7 + 1;
  const endDate = Math.min(week * 7, daysInMonth);

  const dates: { label: string; value: string }[] = [];
  for (let d = startDate; d <= endDate; d++) {
    const date = new Date(adjustedYear, month - 1, d, 23, 59, 59);
    const dayName = DOW_LABELS[date.getDay()];
    dates.push({
      label: `${dayName}요일 (${month}/${d})`,
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
      } catch (err) {
        setError(err instanceof Error && err.message
          ? err.message
          : '검색 중 오류가 발생했습니다. 다시 시도해주세요.');
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query]);

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
            type="text"
            placeholder="문제 번호 또는 제목으로 검색…"
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
          solved.ac 기반으로 검색됩니다.
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
  isAdding,
  addError,
}: {
  problem: SolvedProblem;
  onBack: () => void;
  onAdd: (weekNumber: string, deadline: string) => void;
  isAdding?: boolean;
  addError?: string | null;
}) {
  const [weekNumber, setWeekNumber] = useState('');
  const [deadline, setDeadline] = useState('');
  const [errors, setErrors] = useState<{ weekNumber?: string; deadline?: string }>({});

  const { difficulty } = toOurDiff(problem.level);
  const cfg = DIFFICULTY_CONFIG[difficulty];
  const tierLabel = TIER_NAMES[problem.level] ?? 'Unrated';
  const tags = problem.tags.slice(0, 5);

  function validate() {
    const e: typeof errors = {};
    if (!weekNumber.trim()) e.weekNumber = '주차를 입력하세요.';
    if (!deadline) {
      e.deadline = '마감일을 선택하세요.';
    } else if (new Date(deadline) < new Date()) {
      e.deadline = '과거 날짜는 선택할 수 없습니다.';
    }
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
          style={{ borderColor: 'var(--border)' }}
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
          <select
            value={weekNumber}
            onChange={(e) => { setWeekNumber(e.target.value); setDeadline(''); setErrors((er) => ({ ...er, weekNumber: undefined })); }}
            className="h-9 w-full rounded-btn border px-3 text-[13px] outline-none transition-[border-color] appearance-none bg-[length:16px] bg-[right_8px_center] bg-no-repeat"
            style={{
              borderColor: errors.weekNumber ? 'var(--error)' : 'var(--border)',
              color: weekNumber ? 'var(--text)' : 'var(--text-3)',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m4 6 4 4 4-4'/%3E%3C/svg%3E")`,
            }}
            onFocus={(e) => !errors.weekNumber && (e.currentTarget.style.borderColor = 'var(--primary)')}
            onBlur={(e) => (e.currentTarget.style.borderColor = errors.weekNumber ? 'var(--error)' : 'var(--border)')}
          >
            <option value="" disabled>주차를 선택하세요</option>
            {generateWeekOptions().map((w) => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>
          {errors.weekNumber && (
            <p className="text-[11px]" style={{ color: 'var(--error)' }}>{errors.weekNumber}</p>
          )}
        </div>

        {/* Deadline */}
        <div className="space-y-1.5">
          <FieldLabel>마감일 *</FieldLabel>
          <select
            value={deadline}
            onChange={(e) => { setDeadline(e.target.value); setErrors((er) => ({ ...er, deadline: undefined })); }}
            disabled={!weekNumber}
            className="h-9 w-full rounded-btn border px-3 text-[13px] outline-none transition-[border-color] appearance-none bg-[length:16px] bg-[right_8px_center] bg-no-repeat disabled:opacity-50"
            style={{
              borderColor: errors.deadline ? 'var(--error)' : 'var(--border)',
              color: deadline ? 'var(--text)' : 'var(--text-3)',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m4 6 4 4 4-4'/%3E%3C/svg%3E")`,
            }}
            onFocus={(e) => !errors.deadline && (e.currentTarget.style.borderColor = 'var(--primary)')}
            onBlur={(e) => (e.currentTarget.style.borderColor = errors.deadline ? 'var(--error)' : 'var(--border)')}
          >
            <option value="" disabled>{weekNumber ? '요일을 선택하세요' : '주차를 먼저 선택하세요'}</option>
            {weekNumber && getWeekDates(weekNumber).map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
          {errors.deadline && (
            <p className="text-[11px]" style={{ color: 'var(--error)' }}>{errors.deadline}</p>
          )}
        </div>
      </div>

      {/* Footer */}
      <div
        className="flex items-center justify-end gap-2 border-t px-5 py-3.5"
        style={{ borderColor: 'var(--border)' }}
      >
        <Btn variant="outline" size="md" onClick={onBack} disabled={isAdding}>뒤로</Btn>
        <Btn variant="primary" size="md" onClick={handleAdd} disabled={isAdding}>
          {isAdding ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          {isAdding ? '추가 중...' : '문제 추가'}
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

    const { difficulty, level: diffLevel } = toOurDiff(selected.level);
    const tagNames = selected.tags.slice(0, 5);

    setIsAdding(true);
    setAddError(null);

    try {
      const data: CreateProblemData = {
        title: selected.titleKo,
        weekNumber,
        difficulty: difficulty as CreateProblemData['difficulty'],
        level: diffLevel,
        deadline: new Date(deadline).toISOString(),
        tags: tagNames,
        sourceUrl: `https://www.acmicpc.net/problem/${selected.problemId}`,
        sourcePlatform: 'BOJ',
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
        sourcePlatform: created.sourcePlatform ?? 'BOJ',
        description: created.description ?? '',
      });
      handleClose();
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : '문제 추가에 실패했습니다.');
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