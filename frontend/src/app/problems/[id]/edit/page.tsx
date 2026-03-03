/**
 * @file 문제 수정 페이지 (v2.1 UI 통일 리팩토링)
 * @domain problem
 * @layer page
 * @related problemApi, solvedacApi, useBojSearch, useLanguageToggle
 */

'use client';

import { useState, useEffect, useCallback, use, type FormEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ExternalLink, Trash2, FileText, Settings, X } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { BackBtn } from '@/components/ui/BackBtn';
import { DifficultyBadge } from '@/components/ui/DifficultyBadge';
import { Skeleton } from '@/components/ui/Skeleton';
import { InlineSpinner } from '@/components/ui/LoadingSpinner';
import { useStudy } from '@/contexts/StudyContext';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useRequireStudy } from '@/hooks/useRequireStudy';
import { useBojSearch } from '@/hooks/useBojSearch';
import { useLanguageToggle } from '@/hooks/useLanguageToggle';
import { problemApi, type Problem, type UpdateProblemData } from '@/lib/api';
import { DIFFICULTIES, DIFFICULTY_LABELS, LANGUAGES, LANGUAGE_VALUES, PROBLEM_STATUSES, PROBLEM_STATUS_LABELS } from '@/lib/constants';
import type { Difficulty } from '@/lib/constants';
import {
  type ProblemFormState,
  type ProblemFormErrors,
  labelClass,
  selectClass,
  textareaClass,
  getWeekOptions,
  getWeekDates,
  matchDeadlineToWeekDate,
  validateProblemForm,
} from '@/lib/problem-form-utils';

// ─── TYPES ────────────────────────────────

interface PageProps {
  readonly params: Promise<{ id: string }>;
}

interface EditFormState extends ProblemFormState {
  status: string;
}

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

  const [form, setForm] = useState<EditFormState>({
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
  const [fieldErrors, setFieldErrors] = useState<ProblemFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ─── HOOKS ──────────────────────────────

  const setFormBase = useCallback(
    (updater: React.SetStateAction<ProblemFormState>) => {
      setForm((prev) => {
        const base = typeof updater === 'function' ? updater(prev) : updater;
        return { ...prev, ...base };
      });
    },
    [],
  );

  const {
    bojQuery, setBojQuery, bojSearching, bojError, setBojError,
    bojResult, bojApplied, handleBojSearch, handleBojKeyDown, handleBojReset,
  } = useBojSearch(setFormBase, setFieldErrors);

  const handleLanguageToggle = useLanguageToggle(setFormBase);

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

  const handleChange = useCallback(
    (field: keyof EditFormState) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setForm((prev) => ({
          ...prev,
          [field]: e.target.value,
          ...(field === 'weekNumber' ? { deadline: '' } : {}),
        }));
        setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
      },
    [],
  );

  const handleBlur = useCallback(
    (field: keyof ProblemFormErrors) => () => {
      setFieldErrors((prev) => {
        const errors = validateProblemForm(form);
        return { ...prev, [field]: errors[field] };
      });
    },
    [form],
  );

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>): Promise<void> => {
      e.preventDefault();
      if (!problem) return;
      setSubmitError(null);

      const errors = validateProblemForm(form);
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
    },
    [form, problem, problemId, router],
  );

  const handleDelete = useCallback(async (): Promise<void> => {
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
  }, [problemId, router]);

  // ─── GUARDS ─────────────────────────────

  if (currentStudyRole !== 'ADMIN') {
    return (
      <AppLayout>
        <div className="space-y-4">
          <Alert variant="error">문제 수정은 관리자만 가능합니다.</Alert>
          <BackBtn label="문제 목록" href="/problems" />
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
          <BackBtn label="문제 목록" href="/problems" />
        </div>
      </AppLayout>
    );
  }

  // ─── FORM ───────────────────────────────

  return (
    <AppLayout>
      <div className="mx-auto max-w-[640px] space-y-4">
        {/* 뒤로가기 */}
        <BackBtn label="문제 상세" href={`/problems/${problemId}`} className="-ml-1" />

        {/* 페이지 타이틀 */}
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-text">문제 수정</h1>
          <p className="mt-0.5 text-xs text-text-3">문제 정보를 수정하거나 삭제할 수 있습니다</p>
        </div>

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
            <p className="text-[11px] text-text-3">
              문제 번호를 입력하면 제목, 난이도, 태그가 자동으로 입력됩니다.
            </p>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-3 pointer-events-none" aria-hidden />
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="백준 문제번호로 검색"
                  value={bojQuery}
                  onChange={(e) => { setBojQuery(e.target.value); setBojError(null); }}
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
                  연결 해제
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
                  {bojSearching ? <InlineSpinner /> : '검색'}
                </Button>
              )}
            </div>

            {bojError && (
              <p className="text-[11px] text-error">{bojError}</p>
            )}

            {bojResult && (
              <div className="flex items-center gap-2.5 rounded-badge bg-primary-soft border border-border px-3 py-2.5">
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
                  <Badge key={tag} variant="muted">{tag}</Badge>
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
              기본 정보
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
                  className={textareaClass}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    주차 <span className="text-error text-[11px]">필수</span>
                  </label>
                  <select
                    id="edit-weekNumber"
                    value={form.weekNumber}
                    onChange={handleChange('weekNumber')}
                    onBlur={handleBlur('weekNumber')}
                    disabled={isSubmitting}
                    aria-required
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
                  마감일 <span className="text-error text-[11px]">필수</span>
                </label>
                <select
                  id="edit-deadline"
                  value={form.deadline}
                  onChange={handleChange('deadline')}
                  onBlur={handleBlur('deadline')}
                  disabled={isSubmitting}
                  aria-required
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
                        aria-pressed={selected}
                        className={`inline-flex items-center gap-1 text-[11px] font-medium px-3 py-1.5 rounded-badge border transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                          selected
                            ? 'bg-primary-soft text-primary border-primary/30'
                            : 'bg-transparent text-text-3 border-border line-through'
                        }`}
                      >
                        {selected && (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden><polyline points="20 6 9 17 4 12"/></svg>
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
