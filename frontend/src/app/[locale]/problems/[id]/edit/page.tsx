/**
 * @file 문제 수정 페이지 (v2.1 UI 통일 리팩토링 + 플랫폼 토글)
 * @domain problem
 * @layer page
 * @related problemApi, solvedacApi, programmersApi, useBojSearch, useProgrammersSearch, useLanguageToggle
 */

'use client';

import { useState, useEffect, useCallback, use, type FormEvent, type ReactNode } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
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
import { useProgrammersSearch } from '@/hooks/useProgrammersSearch';
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
  const { currentStudyId, currentStudyRole } = useStudy();
  const t = useTranslations('problems');
  const tErrors = useTranslations('errors');

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

  // ─── PLATFORM STATE ─────────────────────

  const [activePlatform, setActivePlatform] = useState<'BOJ' | 'PROGRAMMERS'>('BOJ');

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

  const {
    programmersQuery, setProgrammersQuery, programmersSearching, programmersError, setProgrammersError,
    programmersResult, programmersApplied, handleProgrammersSearch, handleProgrammersKeyDown,
    handleProgrammersReset,
  } = useProgrammersSearch(setFormBase, setFieldErrors);

  const handleLanguageToggle = useLanguageToggle(setFormBase);

  /** 플랫폼 전환 핸들러 -- 검색 결과가 적용된 상태면 경고 */
  const handlePlatformChange = useCallback(
    (newPlatform: 'BOJ' | 'PROGRAMMERS') => {
      if (newPlatform === activePlatform) return;
      if (bojApplied || programmersApplied) {
        if (!window.confirm(t('edit.confirm.platformChange'))) return;
        handleBojReset();
        handleProgrammersReset();
      }
      setActivePlatform(newPlatform);
    },
    [activePlatform, bojApplied, programmersApplied, handleBojReset, handleProgrammersReset],
  );

  // ─── EFFECTS ────────────────────────────

  useEffect(() => {
    if (!isAuthenticated || !currentStudyId) return;
    let cancelled = false;

    const load = async (): Promise<void> => {
      setIsPageLoading(true);
      setLoadError(null);
      try {
        const data = await problemApi.findById(problemId);
        if (cancelled) return;
        setProblem(data);
        const weekNumber = String(data.weekNumber ?? '');
        const platform = (data.sourcePlatform as 'BOJ' | 'PROGRAMMERS') || 'BOJ';
        setActivePlatform(platform);
        setForm({
          title: data.title ?? '',
          description: data.description ?? '',
          difficulty: data.difficulty ?? '',
          weekNumber,
          deadline: data.deadline ? matchDeadlineToWeekDate(data.deadline, weekNumber) : '',
          allowedLanguages: data.allowedLanguages?.length ? data.allowedLanguages : [...LANGUAGE_VALUES],
          sourceUrl: data.sourceUrl ?? '',
          sourcePlatform: platform,
          status: data.status ?? 'ACTIVE',
        });
      } catch (err: unknown) {
        if (!cancelled) {
          setLoadError((err as Error).message ?? t('edit.error.loadFailed'));
        }
      } finally {
        if (!cancelled) setIsPageLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [isAuthenticated, currentStudyId, problemId]);

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
        const confirmed = window.confirm(t('edit.confirm.closeActive'));
        if (!confirmed) return;
      }

      if (problem.status === 'DRAFT' && form.status === 'ACTIVE') {
        const confirmed = window.confirm(t('edit.confirm.activateDraft'));
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
        if (form.sourcePlatform.trim() !== (problem.sourcePlatform ?? '')) data.sourcePlatform = form.sourcePlatform.trim() as UpdateProblemData['sourcePlatform'];
        if (form.status !== problem.status) data.status = form.status as UpdateProblemData['status'];

        await problemApi.update(problemId, data);
        router.push(`/problems/${problemId}`);
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : t('edit.error.submitFailed'));
      } finally {
        setIsSubmitting(false);
      }
    },
    [form, problem, problemId, router],
  );

  const handleDelete = useCallback(async (): Promise<void> => {
    const confirmed = window.confirm(t('edit.confirm.delete'));
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      await problemApi.delete(problemId);
      router.replace('/problems');
    } catch {
      setSubmitError(t('edit.error.deleteFailed'));
      setIsDeleting(false);
    }
  }, [problemId, router]);

  // ─── GUARDS ─────────────────────────────

  if (currentStudyRole !== 'ADMIN') {
    return (
      <AppLayout>
        <div className="space-y-4">
          <Alert variant="error">{t('edit.error.adminOnly')}</Alert>
          <BackBtn label={t('form.backToList')} href="/problems" />
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
          <Alert variant="error">{loadError ?? t('edit.error.notFound')}</Alert>
          <BackBtn label={t('form.backToList')} href="/problems" />
        </div>
      </AppLayout>
    );
  }

  // ─── FORM ───────────────────────────────

  return (
    <AppLayout>
      <div className="mx-auto max-w-[640px] space-y-4">
        {/* 뒤로가기 */}
        <BackBtn label={t('edit.backLabel')} href={`/problems/${problemId}`} className="-ml-1" />

        {/* 페이지 타이틀 */}
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-text">{t('edit.heading')}</h1>
          <p className="mt-0.5 text-xs text-text-3">{t('edit.subheading')}</p>
        </div>

        {/* 카드 1: 문제 검색 */}
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
              style={{ backgroundColor: 'var(--bg-alt)' }}
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
                  onClick={() => handlePlatformChange(p)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                      e.preventDefault();
                      handlePlatformChange(activePlatform === 'BOJ' ? 'PROGRAMMERS' : 'BOJ');
                    }
                  }}
                  className="px-3 py-1.5 text-[12px] font-medium rounded-btn transition-all duration-150"
                  style={
                    activePlatform === p
                      ? { backgroundColor: 'var(--bg-card)', color: 'var(--primary)', boxShadow: '0 1px 2px rgba(0,0,0,0.08)' }
                      : { color: 'var(--text-3)' }
                  }
                >
                  {p === 'BOJ' ? t('form.platform.boj') : t('form.platform.programmers')}
                </button>
              ))}
            </div>

            <p className="text-[11px] text-text-3">
              {activePlatform === 'BOJ'
                ? t('form.searchDesc.boj')
                : t('form.searchDesc.programmers')}
            </p>

            {/* BOJ 검색 UI */}
            {activePlatform === 'BOJ' && (
              <>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-3 pointer-events-none" aria-hidden />
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder={t('edit.searchPlaceholderBoj')}
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
              </>
            )}

            {/* 프로그래머스 검색 UI */}
            {activePlatform === 'PROGRAMMERS' && (
              <>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-3 pointer-events-none" aria-hidden />
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder={t('form.searchPlaceholder.programmers')}
                      value={programmersQuery}
                      onChange={(e) => { setProgrammersQuery(e.target.value); setProgrammersError(null); }}
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
                      disabled={programmersSearching || isSubmitting || !programmersQuery.trim()}
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
                    <span className="text-xs font-mono text-text-3">#{programmersResult.problemId}</span>
                    <span className="text-xs font-medium text-text truncate">{programmersResult.title}</span>
                    {programmersResult.difficulty && (
                      <DifficultyBadge difficulty={programmersResult.difficulty as Difficulty} level={programmersResult.level} />
                    )}
                    <a
                      href={programmersResult.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto shrink-0 text-text-3 hover:text-primary transition-colors"
                      aria-label="프로그래머스에서 보기"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                )}

                {programmersResult && programmersResult.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {programmersResult.tags.map((tag) => (
                      <Badge key={tag} variant="muted">{tag}</Badge>
                    ))}
                  </div>
                )}
              </>
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
              {t('form.basicInfo')}
            </CardTitle>
          </CardHeader>

          <form onSubmit={(e) => void handleSubmit(e)} noValidate>
            <CardContent className="space-y-4">
              <Input
                label={t('edit.titleLabel')}
                value={form.title}
                onChange={handleChange('title')}
                error={fieldErrors.title ? tErrors(fieldErrors.title) : undefined}
                disabled={isSubmitting || bojApplied || programmersApplied}
              />

              <div className="flex flex-col">
                <label htmlFor="edit-description" className={labelClass}>{t('form.descriptionLabel')}</label>
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
                  <label htmlFor="edit-difficulty" className={labelClass}>{t('form.difficultyLabel')}</label>
                  <select
                    id="edit-difficulty"
                    value={form.difficulty}
                    onChange={handleChange('difficulty')}
                    disabled={isSubmitting || bojApplied || programmersApplied}
                    className={selectClass}
                  >
                    <option value="">{t('form.difficultyNone')}</option>
                    {DIFFICULTIES.map((d) => (
                      <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col">
                  <label htmlFor="edit-weekNumber" className={labelClass}>
                    {t('form.weekLabel')} <span className="text-error text-[11px]">{t('form.required')}</span>
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
                    <p className="mt-1 text-[11px] text-error">{tErrors(fieldErrors.weekNumber)}</p>
                  )}
                </div>
              </div>

              {/* 마감 & 상태 섹션 */}
              <div className="flex items-center gap-2 pt-3 border-t border-border">
                <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary-soft text-primary">
                  <Settings className="h-3.5 w-3.5" />
                </div>
                <span className="text-sm font-semibold text-text">{t('edit.deadlineSettings')}</span>
              </div>

              <div className="flex flex-col">
                <label htmlFor="edit-deadline" className={labelClass}>
                  {t('form.deadlineLabel')} <span className="text-error text-[11px]">{t('form.required')}</span>
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
                  <option value="" disabled>{t('form.deadlinePlaceholder')}</option>
                  {getWeekDates(form.weekNumber).map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
                {fieldErrors.deadline && (
                  <p className="mt-1 text-[11px] text-error">{tErrors(fieldErrors.deadline)}</p>
                )}
              </div>

              <div className="flex flex-col">
                <label htmlFor="edit-status" className={labelClass}>{t('edit.statusLabel')}</label>
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
                <span className={labelClass}>{t('form.allowedLanguages')}</span>
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
                label={t('form.sourceUrl')}
                value={form.sourceUrl}
                onChange={handleChange('sourceUrl')}
                disabled={isSubmitting || bojApplied || programmersApplied}
              />

              <Input
                label={t('form.sourcePlatform')}
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

            <CardFooter className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-between gap-3">
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="md"
                  disabled={isSubmitting || isDeleting}
                  onClick={() => router.back()}
                  className="flex-1 sm:flex-initial"
                >
                  {t('form.cancel')}
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={isSubmitting || isDeleting}
                  className="flex-1 sm:flex-initial"
                >
                  {isSubmitting ? (
                    <>
                      <InlineSpinner />
                      {t('edit.submitting')}
                    </>
                  ) : (
                    t('edit.submitButton')
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
                    {t('edit.deleting')}
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    {t('edit.deleteButton')}
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
