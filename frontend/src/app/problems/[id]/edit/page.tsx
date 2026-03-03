/**
 * @file 문제 수정 페이지 (v2 전면 교체)
 * @domain problem
 * @layer page
 * @related problemApi, solvedacApi, DifficultyBadge, Input, AppLayout
 */

'use client';

import { useState, useEffect, useCallback, use, type FormEvent, type ReactNode, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Search, ExternalLink, Trash2, FileText, Settings } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { DifficultyBadge } from '@/components/ui/DifficultyBadge';
import { Skeleton } from '@/components/ui/Skeleton';
import { InlineSpinner } from '@/components/ui/LoadingSpinner';
import { useStudy } from '@/contexts/StudyContext';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useRequireStudy } from '@/hooks/useRequireStudy';
import { problemApi, solvedacApi, type Problem, type UpdateProblemData, type SolvedacProblemInfo } from '@/lib/api';
import { DIFFICULTIES, DIFFICULTY_LABELS, LANGUAGES, LANGUAGE_VALUES, PROBLEM_STATUSES, PROBLEM_STATUS_LABELS } from '@/lib/constants';
import type { Difficulty } from '@/lib/constants';

// ─── TYPES ────────────────────────────────

interface PageProps {
  readonly params: Promise<{ id: string }>;
}

interface FormState {
  title: string;
  description: string;
  difficulty: string;
  weekNumber: string;
  deadline: string;
  allowedLanguages: string[];
  sourceUrl: string;
  sourcePlatform: string;
  status: string;
}

interface FormErrors {
  title?: string;
  weekNumber?: string;
  deadline?: string;
}

// ─── HELPERS ──────────────────────────────

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

function getWeekDates(weekLabel: string): { label: string; value: string }[] {
  const match = weekLabel.match(/^(\d+)월(\d+)주차$/);
  if (!match) return [];
  const month = Number(match[1]);
  const week = Number(match[2]);
  const now = new Date();
  const year = now.getFullYear();
  const adjustedYear = month < now.getMonth() + 1 && month === 1 ? year + 1 : year;

  const startDay = (week - 1) * 7 + 1;
  const lastDay = new Date(adjustedYear, month, 0).getDate();
  const endDay = Math.min(week * 7, lastDay);

  const dates: { label: string; value: string }[] = [];
  for (let d = startDay; d <= endDay; d++) {
    const date = new Date(adjustedYear, month - 1, d, 23, 59, 59);
    const dayName = DAY_NAMES[date.getDay()];
    dates.push({
      label: `${month}월 ${d}일 (${dayName})`,
      value: date.toISOString(),
    });
  }
  return dates;
}

function matchDeadlineToWeekDate(deadline: string, weekLabel: string): string {
  const weekDates = getWeekDates(weekLabel);
  const deadlineDate = new Date(deadline);
  const deadlineDay = deadlineDate.getDate();
  const match = weekDates.find((d) => new Date(d.value).getDate() === deadlineDay);
  return match?.value ?? '';
}

function getWeekOptions(): string[] {
  const now = new Date();
  const month = now.getMonth() + 1;
  const lastDay = new Date(now.getFullYear(), month, 0).getDate();
  const totalWeeks = Math.ceil(lastDay / 7);
  const options: string[] = [];
  for (let w = 1; w <= totalWeeks; w++) {
    options.push(`${month}월${w}주차`);
  }
  const nextMonth = month === 12 ? 1 : month + 1;
  options.push(`${nextMonth}월1주차`);
  return options;
}

function validateForm(form: FormState): FormErrors {
  const errors: FormErrors = {};
  if (!form.title.trim()) errors.title = '문제 제목을 입력해주세요.';
  if (!form.weekNumber.trim()) errors.weekNumber = '주차를 선택해주세요.';
  if (!form.deadline) errors.deadline = '마감일을 선택해주세요.';
  return errors;
}

// ─── STYLE CONSTANTS ─────────────────────

const selectClass =
  'h-[40px] w-full px-3 pr-8 rounded-btn border border-border bg-input-bg text-text text-xs outline-none cursor-pointer transition-[border-color] duration-150 focus:border-primary disabled:cursor-not-allowed disabled:opacity-50 appearance-none' +
  " bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239C9A95%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22M6%209l6%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_10px_center]";

const labelClass = 'block text-[11px] font-medium text-text-2 mb-1.5';

// ─── RENDER ───────────────────────────────

/**
 * 문제 수정 페이지
 * @domain problem
 * @guard ADMIN-only
 */
export default function ProblemEditPage({ params }: PageProps): ReactNode {
  const { id: problemId } = use(params);
  const router = useRouter();
  const { isAuthenticated } = useRequireAuth();
  useRequireStudy();
  const { currentStudyRole } = useStudy();

  // ─── STATE ──────────────────────────────

  const [problem, setProblem] = useState<Problem | null>(null);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>({
    title: '',
    description: '',
    difficulty: '',
    weekNumber: '',
    deadline: '',
    allowedLanguages: [...LANGUAGE_VALUES],
    sourceUrl: '',
    sourcePlatform: 'BOJ',
    status: '',
  });
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // BOJ 검색
  const [bojQuery, setBojQuery] = useState('');
  const [bojSearching, setBojSearching] = useState(false);
  const [bojError, setBojError] = useState<string | null>(null);
  const [bojResult, setBojResult] = useState<SolvedacProblemInfo | null>(null);
  const [bojApplied, setBojApplied] = useState(false);

  // ─── EFFECTS ────────────────────────────

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;

    const load = async (): Promise<void> => {
      setIsPageLoading(true);
      setLoadError(null);
      try {
        const data = await problemApi.findById(problemId);
        if (cancelled) return;
        setProblem(data);
        const weekNumber = String(data.weekNumber ?? '');
        setForm({
          title: data.title ?? '',
          description: data.description ?? '',
          difficulty: data.difficulty ?? '',
          weekNumber,
          deadline: data.deadline ? matchDeadlineToWeekDate(data.deadline, weekNumber) : '',
          allowedLanguages: data.allowedLanguages?.length ? data.allowedLanguages : [...LANGUAGE_VALUES],
          sourceUrl: data.sourceUrl ?? '',
          sourcePlatform: data.sourcePlatform || 'BOJ',
          status: data.status ?? 'ACTIVE',
        });
        if (data.sourceUrl) setBojApplied(true);
      } catch (err: unknown) {
        if (!cancelled) {
          setLoadError((err as Error).message ?? '문제를 불러오는 데 실패했습니다.');
        }
      } finally {
        if (!cancelled) setIsPageLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [isAuthenticated, problemId]);

  // ─── HANDLERS ─────────────────────────────

  const handleBojSearch = useCallback(async (): Promise<void> => {
    const id = Number(bojQuery.trim());
    if (!Number.isInteger(id) || id < 1) {
      setBojError('유효한 문제 번호를 입력해주세요.');
      return;
    }
    setBojSearching(true);
    setBojError(null);
    setBojResult(null);
    setBojApplied(false);
    try {
      const info = await solvedacApi.search(id);
      setBojResult(info);
      setForm((prev) => ({
        ...prev,
        title: info.title,
        difficulty: info.difficulty ?? '',
        sourceUrl: info.sourceUrl,
        sourcePlatform: 'BOJ',
      }));
      setFieldErrors((prev) => ({ ...prev, title: undefined }));
      setBojApplied(true);
    } catch (err: unknown) {
      setBojError(err instanceof Error ? err.message : '검색에 실패했습니다.');
    } finally {
      setBojSearching(false);
    }
  }, [bojQuery]);

  const handleBojKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void handleBojSearch();
    }
  };

  const handleChange = (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((prev) => ({
        ...prev,
        [field]: e.target.value,
        ...(field === 'weekNumber' ? { deadline: '' } : {}),
      }));
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    };

  const handleLanguageToggle = (lang: string) => {
    setForm((prev) => {
      const isSelected = prev.allowedLanguages.includes(lang);
      if (isSelected && prev.allowedLanguages.length <= 1) return prev;
      return {
        ...prev,
        allowedLanguages: isSelected
          ? prev.allowedLanguages.filter((l) => l !== lang)
          : [...prev.allowedLanguages, lang],
      };
    });
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!problem) return;
    setSubmitError(null);

    const errors = validateForm(form);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    if (problem.status === 'ACTIVE' && form.status === 'CLOSED') {
      const confirmed = window.confirm('문제를 마감하면 더 이상 제출할 수 없습니다. 계속하시겠습니까?');
      if (!confirmed) return;
    }

    if (problem.status === 'DRAFT' && form.status === 'ACTIVE') {
      const confirmed = window.confirm('문제를 활성화하면 멤버들이 이 문제를 보고 제출할 수 있습니다. 계속하시겠습니까?');
      if (!confirmed) return;
    }

    setIsSubmitting(true);

    try {
      const data: UpdateProblemData = {};
      if (form.title.trim() !== problem.title) data.title = form.title.trim();
      if (form.description.trim() !== (problem.description ?? '')) data.description = form.description.trim();
      if (form.difficulty !== (problem.difficulty ?? '')) data.difficulty = (form.difficulty || undefined) as UpdateProblemData['difficulty'];
      if (form.weekNumber.trim() !== (problem.weekNumber ?? '')) data.weekNumber = form.weekNumber.trim();
      if (form.deadline) {
        const newDeadline = new Date(form.deadline).toISOString();
        if (newDeadline !== problem.deadline) data.deadline = newDeadline;
      }
      if (JSON.stringify(form.allowedLanguages) !== JSON.stringify(problem.allowedLanguages ?? [])) {
        data.allowedLanguages = form.allowedLanguages;
      }
      if (form.sourceUrl.trim() !== (problem.sourceUrl ?? '')) data.sourceUrl = form.sourceUrl.trim();
      if (form.sourcePlatform.trim() !== (problem.sourcePlatform ?? '')) data.sourcePlatform = form.sourcePlatform.trim();
      if (form.status !== problem.status) data.status = form.status as UpdateProblemData['status'];

      await problemApi.update(problemId, data);
      router.push(`/problems/${problemId}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : '문제 수정에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (): Promise<void> => {
    const confirmed = window.confirm('정말 이 문제를 삭제하시겠습니까? 관련 제출 기록도 함께 삭제됩니다.');
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      await problemApi.delete(problemId);
      router.replace('/problems');
    } catch {
      setSubmitError('문제 삭제에 실패했습니다.');
      setIsDeleting(false);
    }
  };

  // ─── GUARDS ─────────────────────────────

  if (currentStudyRole !== 'ADMIN') {
    return (
      <AppLayout>
        <div className="space-y-4">
          <Alert variant="error">문제 수정은 관리자만 가능합니다.</Alert>
          <Button variant="ghost" size="sm" onClick={() => router.push('/problems')}>
            <ChevronLeft />
            문제 목록
          </Button>
        </div>
      </AppLayout>
    );
  }

  // ─── LOADING ────────────────────────────

  if (isPageLoading) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-[640px] space-y-4">
          <Skeleton height={20} width="30%" />
          <Skeleton height={200} />
          <Skeleton height={200} />
        </div>
      </AppLayout>
    );
  }

  if (loadError || !problem) {
    return (
      <AppLayout>
        <div className="space-y-4">
          <Alert variant="error">{loadError ?? '문제를 찾을 수 없습니다.'}</Alert>
          <Button variant="ghost" size="sm" onClick={() => router.push('/problems')}>
            <ChevronLeft />
            문제 목록
          </Button>
        </div>
      </AppLayout>
    );
  }

  // ─── FORM ───────────────────────────────

  return (
    <AppLayout>
      <div className="mx-auto max-w-[640px] space-y-4">
        {/* 뒤로가기 */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/problems/${problemId}`)}
          className="-ml-1"
        >
          <ChevronLeft />
          문제 상세
        </Button>

        {/* 카드 1: BOJ 검색 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary-soft text-primary">
                <Search className="h-3.5 w-3.5" />
              </div>
              백준 문제 검색
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-3 pointer-events-none" />
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="백준 문제번호로 검색"
                  value={bojQuery}
                  onChange={(e) => { setBojQuery(e.target.value); setBojError(null); }}
                  onKeyDown={handleBojKeyDown}
                  disabled={bojSearching || isSubmitting}
                  className="w-full h-[40px] pl-8 pr-3 rounded-btn border border-border bg-input-bg text-text text-xs outline-none transition-[border-color] duration-150 placeholder:text-text-3 focus:border-primary disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                size="md"
                disabled={bojSearching || isSubmitting || !bojQuery.trim()}
                onClick={() => void handleBojSearch()}
                className="shrink-0"
              >
                {bojSearching ? <InlineSpinner /> : '검색'}
              </Button>
            </div>

            {bojError && (
              <p className="text-[11px] text-error">{bojError}</p>
            )}

            {bojResult && (
              <div className="flex items-center gap-2.5 rounded-btn bg-primary-soft border border-border px-3 py-2.5">
                <span className="text-xs font-mono text-text-3">#{bojResult.problemId}</span>
                <span className="text-xs font-medium text-text truncate">{bojResult.title}</span>
                {bojResult.difficulty && (
                  <DifficultyBadge difficulty={bojResult.difficulty as Difficulty} level={bojResult.level} />
                )}
                <a
                  href={bojResult.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto shrink-0 text-text-3 hover:text-primary transition-colors"
                  aria-label="백준에서 보기"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            )}

            {bojResult && bojResult.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {bojResult.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-bg-alt px-2 py-0.5 text-[10px] font-medium text-text-2"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 카드 2: 기본 정보 + 설정 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary-soft text-primary">
                <FileText className="h-3.5 w-3.5" />
              </div>
              문제 수정
            </CardTitle>
          </CardHeader>

          <form onSubmit={(e) => void handleSubmit(e)} noValidate>
            <CardContent className="space-y-4">
              <Input
                label="문제 제목"
                value={form.title}
                onChange={handleChange('title')}
                error={fieldErrors.title}
                disabled={isSubmitting || bojApplied}
              />

              <div className="flex flex-col">
                <label htmlFor="edit-description" className={labelClass}>설명 (선택)</label>
                <textarea
                  id="edit-description"
                  value={form.description}
                  onChange={handleChange('description')}
                  disabled={isSubmitting}
                  rows={4}
                  className="w-full px-3 py-2 rounded-btn border border-border bg-input-bg text-text text-xs outline-none transition-[border-color] duration-150 placeholder:text-text-3 focus:border-primary disabled:cursor-not-allowed disabled:opacity-50 resize-y leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col">
                  <label htmlFor="edit-difficulty" className={labelClass}>난이도</label>
                  <select
                    id="edit-difficulty"
                    value={form.difficulty}
                    onChange={handleChange('difficulty')}
                    disabled={isSubmitting || bojApplied}
                    className={selectClass}
                  >
                    <option value="">선택 안 함</option>
                    {DIFFICULTIES.map((d) => (
                      <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col">
                  <label htmlFor="edit-weekNumber" className={labelClass}>
                    주차 <span className="text-error text-[10px]">필수</span>
                  </label>
                  <select
                    id="edit-weekNumber"
                    value={form.weekNumber}
                    onChange={handleChange('weekNumber')}
                    disabled={isSubmitting}
                    className={`${selectClass} ${fieldErrors.weekNumber ? 'border-error' : ''}`}
                  >
                    {getWeekOptions().map((w) => (
                      <option key={w} value={w}>{w}</option>
                    ))}
                  </select>
                  {fieldErrors.weekNumber && (
                    <p className="mt-1 text-[11px] text-error">{fieldErrors.weekNumber}</p>
                  )}
                </div>
              </div>

              {/* 마감 & 상태 섹션 */}
              <div className="flex items-center gap-2 pt-3 border-t border-border">
                <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary-soft text-primary">
                  <Settings className="h-3.5 w-3.5" />
                </div>
                <span className="text-sm font-semibold text-text">마감 & 상태</span>
              </div>

              <div className="flex flex-col">
                <label htmlFor="edit-deadline" className={labelClass}>
                  마감일 <span className="text-error text-[10px]">필수</span>
                </label>
                <select
                  id="edit-deadline"
                  value={form.deadline}
                  onChange={handleChange('deadline')}
                  disabled={isSubmitting}
                  className={`${selectClass} ${fieldErrors.deadline ? 'border-error' : ''}`}
                >
                  <option value="" disabled>요일을 선택하세요</option>
                  {getWeekDates(form.weekNumber).map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
                {fieldErrors.deadline && (
                  <p className="mt-1 text-[11px] text-error">{fieldErrors.deadline}</p>
                )}
              </div>

              <div className="flex flex-col">
                <label htmlFor="edit-status" className={labelClass}>상태</label>
                <select
                  id="edit-status"
                  value={form.status}
                  onChange={handleChange('status')}
                  disabled={isSubmitting}
                  className={selectClass}
                >
                  {PROBLEM_STATUSES.map((s) => (
                    <option key={s} value={s}>{PROBLEM_STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </div>

              {/* 허용 언어 */}
              <div className="flex flex-col">
                <span className={labelClass}>허용 언어</span>
                <div className="flex flex-wrap gap-1.5">
                  {LANGUAGES.map((lang) => {
                    const selected = form.allowedLanguages.includes(lang.value);
                    return (
                      <button
                        key={lang.value}
                        type="button"
                        onClick={() => handleLanguageToggle(lang.value)}
                        disabled={isSubmitting}
                        className={`inline-flex items-center gap-1 text-[11px] font-medium px-3 py-1.5 rounded-badge border transition-colors duration-150 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
                          selected
                            ? 'bg-primary-soft text-primary border-primary/30'
                            : 'bg-transparent text-text-3 border-border line-through'
                        }`}
                      >
                        {selected && (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                        )}
                        {lang.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Input
                label="출처 URL"
                value={form.sourceUrl}
                onChange={handleChange('sourceUrl')}
                disabled={isSubmitting || bojApplied}
              />

              <Input
                label="출처 플랫폼"
                value={form.sourcePlatform}
                onChange={handleChange('sourcePlatform')}
                disabled
              />
            </CardContent>

            {/* 에러 */}
            {submitError && (
              <div className="px-5 pb-3">
                <Alert variant="error" onClose={() => setSubmitError(null)}>
                  {submitError}
                </Alert>
              </div>
            )}

            <CardFooter className="flex items-center justify-between">
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="md"
                  disabled={isSubmitting || isDeleting}
                  onClick={() => router.back()}
                >
                  취소
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={isSubmitting || isDeleting}
                >
                  {isSubmitting ? (
                    <>
                      <InlineSpinner />
                      수정 중...
                    </>
                  ) : (
                    '수정 완료'
                  )}
                </Button>
              </div>
              <Button
                type="button"
                variant="danger"
                size="sm"
                disabled={isSubmitting || isDeleting}
                onClick={() => void handleDelete()}
              >
                {isDeleting ? (
                  <>
                    <InlineSpinner />
                    삭제 중...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    삭제
                  </>
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </AppLayout>
  );
}
