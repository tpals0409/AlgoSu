/**
 * @file 문제 생성 페이지 (v2.1 UI 통일 리팩토링 + React Hook Form + Zod)
 * @domain problem
 * @layer page
 * @related problemApi, solvedacApi, programmersApi, studyApi, useBojSearch, useProgrammersSearch
 */

'use client';

import { useState, useCallback, type ReactNode } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { CheckCircle2, Search, ExternalLink, Plus, FileText, Clock, X } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { BackBtn } from '@/components/ui/BackBtn';
import { DifficultyBadge } from '@/components/ui/DifficultyBadge';
import { InlineSpinner, LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useStudy } from '@/contexts/StudyContext';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useRequireStudy } from '@/hooks/useRequireStudy';
import { useBojSearch } from '@/hooks/useBojSearch';
import { useProgrammersSearch } from '@/hooks/useProgrammersSearch';
import { problemApi, studyApi, type CreateProblemData } from '@/lib/api';
import { DIFFICULTIES, DIFFICULTY_LABELS, LANGUAGES, LANGUAGE_VALUES } from '@/lib/constants';
import type { Difficulty } from '@/lib/constants';
import {
  type ProblemFormState,
  labelClass,
  selectClass,
  textareaClass,
  getCurrentWeekLabel,
  getWeekOptions,
  getWeekDates,
} from '@/lib/problem-form-utils';
import { problemCreateSchema, type ProblemCreateFormData } from '@/lib/schemas/problem';

// ─── RENDER ───────────────────────────────

/**
 * 문제 생성 페이지
 * @domain problem
 * @guard ADMIN-only
 */
export default function ProblemCreatePage(): ReactNode {
  const router = useRouter();
  const { isReady } = useRequireAuth();
  useRequireStudy();
  const { currentStudyId, currentStudyRole, incrementProblemsVersion } = useStudy();
  const t = useTranslations('problems');
  const tErrors = useTranslations('errors');

  // ─── FORM (React Hook Form + Zod) ──────

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProblemCreateFormData>({
    resolver: zodResolver(problemCreateSchema),
    defaultValues: {
      title: '',
      description: '',
      difficulty: '',
      weekNumber: getCurrentWeekLabel(),
      deadline: '',
      allowedLanguages: [...LANGUAGE_VALUES],
      sourceUrl: '',
      sourcePlatform: 'PROGRAMMERS',
    },
  });

  const weekNumber = watch('weekNumber');
  const allowedLanguages = watch('allowedLanguages');

  // ─── STATE (검색 등 비-폼 상태) ────────

  const [activePlatform, setActivePlatform] = useState<'BOJ' | 'PROGRAMMERS'>('PROGRAMMERS');

  const [, setFormProxy] = useState<ProblemFormState>(() => ({
    title: '',
    description: '',
    difficulty: '',
    weekNumber: getCurrentWeekLabel(),
    deadline: '',
    allowedLanguages: [...LANGUAGE_VALUES],
    sourceUrl: '',
    sourcePlatform: 'PROGRAMMERS',
  }));
  const [created, setCreated] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ─── BOJ SEARCH HOOK ──────────────────

  const setFormAndSync = useCallback(
    (updater: React.SetStateAction<ProblemFormState>) => {
      setFormProxy((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        if (next.title !== prev.title) setValue('title', next.title);
        if (next.difficulty !== prev.difficulty) setValue('difficulty', next.difficulty);
        if (next.sourceUrl !== prev.sourceUrl) setValue('sourceUrl', next.sourceUrl);
        if (next.sourcePlatform !== prev.sourcePlatform) setValue('sourcePlatform', next.sourcePlatform);
        return next;
      });
    },
    [setValue],
  );

  const dummySetFieldErrors = useCallback(() => {}, []);

  const {
    bojQuery, setBojQuery, bojSearching, bojError, setBojError,
    bojResult, bojApplied, handleBojSearch, handleBojKeyDown, handleBojReset: originalBojReset,
  } = useBojSearch(setFormAndSync, dummySetFieldErrors);

  const handleBojReset = useCallback(() => {
    originalBojReset();
    setValue('title', '');
    setValue('difficulty', '');
    setValue('sourceUrl', '');
    setValue('sourcePlatform', 'BOJ');
  }, [originalBojReset, setValue]);

  // ─── PROGRAMMERS SEARCH HOOK ──────────

  const {
    programmersQuery, setProgrammersQuery, programmersSearching, programmersError, setProgrammersError,
    programmersResult, programmersApplied, handleProgrammersSearch, handleProgrammersKeyDown,
    handleProgrammersReset: originalProgrammersReset,
  } = useProgrammersSearch(setFormAndSync, dummySetFieldErrors);

  const handleProgrammersReset = useCallback(() => {
    originalProgrammersReset();
    setValue('title', '');
    setValue('difficulty', '');
    setValue('sourceUrl', '');
    setValue('sourcePlatform', 'PROGRAMMERS');
  }, [originalProgrammersReset, setValue]);

  // ─── LANGUAGE TOGGLE ──────────────────

  const handleLanguageToggle = useCallback(
    (langValue: string) => {
      const current = allowedLanguages;
      const next = current.includes(langValue)
        ? current.filter((l) => l !== langValue)
        : [...current, langValue];
      setValue('allowedLanguages', next);
    },
    [allowedLanguages, setValue],
  );

  // ─── SUBMIT ───────────────────────────

  const onSubmit = async (formData: ProblemCreateFormData): Promise<void> => {
    setSubmitError(null);

    const isApplied = activePlatform === 'BOJ' ? bojApplied : programmersApplied;
    if (!isApplied) {
      const errorMsg = activePlatform === 'BOJ'
        ? t('create.error.bojRequired')
        : t('create.error.programmersRequired');
      if (activePlatform === 'BOJ') { setBojError(errorMsg); }
      else { setProgrammersError(errorMsg); }
      return;
    }

    const activeResult = activePlatform === 'BOJ' ? bojResult : programmersResult;

    try {
      const data: CreateProblemData = {
        title: formData.title.trim(),
        weekNumber: formData.weekNumber.trim(),
      };
      if (formData.description?.trim()) data.description = formData.description.trim();
      if (formData.difficulty) data.difficulty = formData.difficulty as CreateProblemData['difficulty'];
      if (activeResult?.level) data.level = activeResult.level;
      if (formData.deadline) data.deadline = new Date(formData.deadline).toISOString();
      if (formData.allowedLanguages.length > 0) data.allowedLanguages = formData.allowedLanguages;
      if (activeResult?.tags?.length) data.tags = activeResult.tags;
      if (formData.sourceUrl?.trim()) data.sourceUrl = formData.sourceUrl.trim();
      if (formData.sourcePlatform?.trim()) data.sourcePlatform = formData.sourcePlatform.trim() as CreateProblemData['sourcePlatform'];

      const createdProblem = await problemApi.create(data);

      if (currentStudyId) {
        const notifyWithRetry = async (retries = 2): Promise<void> => {
          try {
            await studyApi.notifyProblemCreated(currentStudyId, {
              problemId: createdProblem.id,
              problemTitle: createdProblem.title,
              weekNumber: data.weekNumber,
            });
          } catch {
            if (retries > 0) {
              await new Promise((r) => setTimeout(r, 1000));
              await notifyWithRetry(retries - 1);
            } else {
              // 알림 전송은 부가 기능이므로 최종 실패 시 무시 (문제 생성은 이미 완료됨)
            }
          }
        };
        void notifyWithRetry();
      }

      incrementProblemsVersion();
      setCreated(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : t('create.error.submitFailed'));
    }
  };

  // ─── GUARDS ─────────────────────────────

  if (!isReady) {
    return (
      <AppLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <LoadingSpinner size="lg" color="primary" />
        </div>
      </AppLayout>
    );
  }

  if (currentStudyRole !== 'ADMIN') {
    return (
      <AppLayout>
        <div className="space-y-4">
          <Alert variant="error">{t('create.error.adminOnly')}</Alert>
          <BackBtn label={t('form.backToList')} href="/problems" />
        </div>
      </AppLayout>
    );
  }

  // ─── SUCCESS ────────────────────────────

  if (created) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-[640px]">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="flex items-center justify-center rounded-full bg-success-soft p-4">
                <CheckCircle2 className="h-8 w-8 text-success" aria-hidden />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-text">{t('create.success.title')}</p>
                <p className="mt-1 text-[11px] text-text-3">
                  {t('create.success.description')}
                </p>
              </div>
              <div className="flex gap-3 mt-2">
                <Button variant="ghost" size="md" onClick={() => router.push('/problems')}>
                  {t('create.success.goToList')}
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => {
                    reset({
                      title: '',
                      description: '',
                      difficulty: '',
                      weekNumber: getCurrentWeekLabel(),
                      deadline: '',
                      allowedLanguages: [...LANGUAGE_VALUES],
                      sourceUrl: '',
                      sourcePlatform: 'PROGRAMMERS',
                    });
                    setFormProxy({
                      title: '',
                      description: '',
                      difficulty: '',
                      weekNumber: getCurrentWeekLabel(),
                      deadline: '',
                      allowedLanguages: [...LANGUAGE_VALUES],
                      sourceUrl: '',
                      sourcePlatform: 'PROGRAMMERS',
                    });
                    setCreated(false);
                    originalBojReset();
                    originalProgrammersReset();
                    setActivePlatform('PROGRAMMERS');
                    setSubmitError(null);
                  }}
                >
                  {t('create.success.createAnother')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  // ─── FORM ───────────────────────────────

  return (
    <AppLayout>
      <div className="mx-auto max-w-[640px] space-y-4">
        {/* 뒤로가기 */}
        <BackBtn label={t('form.backToList')} href="/problems" className="-ml-1" />

        {/* 페이지 타이틀 */}
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-text">{t('create.heading')}</h1>
          <p className="mt-0.5 text-xs text-text-3">{t('create.subheading')}</p>
        </div>

        {/* 카드 1: 문제 검색 (필수) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary-soft text-primary">
                <Search className="h-3.5 w-3.5" />
              </div>
              {activePlatform === 'BOJ' ? t('form.searchTitle.boj') : t('form.searchTitle.programmers')}
              <span className="text-error text-[11px]">{t('form.required')}</span>
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
                  onClick={() => setActivePlatform(p)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                      e.preventDefault();
                      setActivePlatform(activePlatform === 'BOJ' ? 'PROGRAMMERS' : 'BOJ');
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
                      pattern="[0-9]*"
                      placeholder={t('form.searchPlaceholder.boj')}
                      value={bojQuery}
                      onChange={(e) => { setBojQuery(e.target.value); setBojError(null); }}
                      onKeyDown={handleBojKeyDown}
                      disabled={bojSearching || bojApplied}
                      className="w-full h-[40px] pl-8 pr-3 rounded-badge border border-border bg-input-bg text-text text-xs outline-none transition-[border-color] duration-150 placeholder:text-text-3 focus:border-primary disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </div>
                  {bojApplied ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="md"
                      onClick={handleBojReset}
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
                      disabled={bojSearching || !bojQuery.trim()}
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
                      aria-label={t('form.bojViewAriaLabel')}
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
                      disabled={programmersSearching || programmersApplied}
                      className="w-full h-[40px] pl-8 pr-3 rounded-badge border border-border bg-input-bg text-text text-xs outline-none transition-[border-color] duration-150 placeholder:text-text-3 focus:border-primary disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </div>
                  {programmersApplied ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="md"
                      onClick={handleProgrammersReset}
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
                      disabled={programmersSearching || !programmersQuery.trim()}
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
                      aria-label={t('form.programmersViewAriaLabel')}
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

        {/* 카드 2: 기본 정보 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary-soft text-primary">
                <FileText className="h-3.5 w-3.5" />
              </div>
              {t('form.basicInfo')}
            </CardTitle>
          </CardHeader>
          <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate>
            <CardContent className="space-y-4">
              <Input
                label={t('create.titleLabel')}
                placeholder={t('create.titlePlaceholder')}
                {...register('title')}
                error={errors.title?.message ? tErrors(errors.title.message) : undefined}
                readOnly
                tabIndex={-1}
                className="cursor-default opacity-70"
              />

              <div className="flex flex-col">
                <label htmlFor="create-description" className={labelClass}>{t('form.descriptionLabel')}</label>
                <textarea
                  id="create-description"
                  placeholder={t('form.descriptionPlaceholder')}
                  {...register('description')}
                  disabled={isSubmitting}
                  rows={4}
                  className={textareaClass}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col">
                  <label htmlFor="create-difficulty" className={labelClass}>{t('form.difficultyLabel')}</label>
                  <select
                    id="create-difficulty"
                    {...register('difficulty')}
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
                  <label htmlFor="create-weekNumber" className={labelClass}>
                    {t('form.weekLabel')} <span className="text-error text-[11px]">{t('form.required')}</span>
                  </label>
                  <Controller
                    name="weekNumber"
                    control={control}
                    render={({ field }) => (
                      <select
                        id="create-weekNumber"
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          setValue('deadline', '');
                        }}
                        disabled={isSubmitting}
                        aria-required
                        className={`${selectClass} ${errors.weekNumber ? 'border-error' : ''}`}
                      >
                        {getWeekOptions().map((w) => (
                          <option key={w} value={w}>{w}</option>
                        ))}
                      </select>
                    )}
                  />
                  {errors.weekNumber?.message && (
                    <p className="mt-1 text-[11px] text-error">{tErrors(errors.weekNumber.message)}</p>
                  )}
                </div>
              </div>
            </CardContent>

            {/* 마감 & 설정 */}
            <div className="px-4 sm:px-6 pb-4 sm:pb-6 space-y-4">
              <div className="flex items-center gap-2 pt-2">
                <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary-soft text-primary">
                  <Clock className="h-3.5 w-3.5" />
                </div>
                <span className="text-sm font-semibold text-text">{t('create.deadlineSettings')}</span>
              </div>

              <div className="flex flex-col">
                <label htmlFor="create-deadline" className={labelClass}>
                  {t('form.deadlineLabel')} <span className="text-error text-[11px]">{t('form.required')}</span>
                </label>
                <select
                  id="create-deadline"
                  {...register('deadline')}
                  disabled={isSubmitting}
                  aria-required
                  className={`${selectClass} ${errors.deadline ? 'border-error' : ''}`}
                >
                  <option value="" disabled>{t('form.deadlinePlaceholder')}</option>
                  {getWeekDates(weekNumber).map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
                {errors.deadline?.message && (
                  <p className="mt-1 text-[11px] text-error">{tErrors(errors.deadline.message)}</p>
                )}
              </div>

              <div className="flex flex-col">
                <span className={labelClass}>{t('form.allowedLanguages')}</span>
                <div className="flex flex-wrap gap-1.5">
                  {LANGUAGES.map((lang) => {
                    const selected = allowedLanguages.includes(lang.value);
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
                {...register('sourceUrl')}
                readOnly
                tabIndex={-1}
                className="cursor-default opacity-70"
              />

              <Input
                label={t('form.sourcePlatform')}
                {...register('sourcePlatform')}
                readOnly
                tabIndex={-1}
                className="cursor-default opacity-70"
              />
            </div>

            {/* 에러 */}
            {submitError && (
              <div className="px-5 pb-3">
                <Alert variant="error" onClose={() => setSubmitError(null)}>
                  {submitError}
                </Alert>
              </div>
            )}

            <CardFooter className="flex gap-3">
              <Button
                type="button"
                variant="ghost"
                size="md"
                className="flex-1"
                disabled={isSubmitting}
                onClick={() => router.back()}
              >
                {t('form.cancel')}
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                className="flex-1"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <InlineSpinner />
                    {t('create.submitting')}
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    {t('create.submitButton')}
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
