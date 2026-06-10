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
import { FileText, Settings, Trash2 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { BackBtn } from '@/components/ui/BackBtn';
import { Skeleton } from '@/components/ui/Skeleton';
import { InlineSpinner } from '@/components/ui/LoadingSpinner';
import { useStudy } from '@/contexts/StudyContext';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useRequireStudy } from '@/hooks/useRequireStudy';
import { useBojSearch } from '@/hooks/useBojSearch';
import { useProgrammersSearch } from '@/hooks/useProgrammersSearch';
import { useLanguageToggle } from '@/hooks/useLanguageToggle';
import { problemApi, type Problem, type UpdateProblemData } from '@/lib/api';
import { LANGUAGE_VALUES } from '@/lib/constants';
import {
  type ProblemFormState,
  type ProblemFormErrors,
  validateProblemForm,
} from '@/lib/problem-form-utils';
import { getCurrentWeekLabel } from '@/lib/utils';
import { PlatformSearchSection } from './_components/PlatformSearchSection';
import { BasicInfoSection } from './_components/BasicInfoSection';
import { StatusDifficultySection } from './_components/StatusDifficultySection';
import { DeadlineSection } from './_components/DeadlineSection';
import { LanguageSection } from './_components/LanguageSection';

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

  // ─── STATE ──────────────────────────────

  const [problem, setProblem] = useState<Problem | null>(null);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [form, setForm] = useState<EditFormState>({
    title: '',
    description: '',
    difficulty: '',
    deadline: '',
    allowedLanguages: [...LANGUAGE_VALUES],
    sourceUrl: '',
    sourcePlatform: 'BOJ',
    status: '',
    category: 'ALGORITHM',
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
    [activePlatform, bojApplied, programmersApplied, handleBojReset, handleProgrammersReset, t],
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
        const platform = (data.sourcePlatform as 'BOJ' | 'PROGRAMMERS') || 'BOJ';
        setActivePlatform(platform);
        setForm({
          title: data.title ?? '',
          description: data.description ?? '',
          difficulty: data.difficulty ?? '',
          deadline: data.deadline ?? '',
          allowedLanguages: data.allowedLanguages?.length ? data.allowedLanguages : [...LANGUAGE_VALUES],
          sourceUrl: data.sourceUrl ?? '',
          sourcePlatform: platform,
          status: data.status ?? 'ACTIVE',
          category: data.category ?? 'ALGORITHM',
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
  }, [isAuthenticated, currentStudyId, problemId, t]);

  // ─── HANDLERS ─────────────────────────────

  const handleChange = useCallback(
    (field: keyof EditFormState) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setForm((prev) => ({
          ...prev,
          [field]: e.target.value,
        }));
        setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
      },
    [],
  );

  const handleDateSelect = useCallback((iso: string) => {
    setForm((prev) => ({ ...prev, deadline: iso }));
    setFieldErrors((prev) => ({ ...prev, deadline: undefined }));
  }, []);

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
        if (form.deadline) {
          const newDeadline = new Date(form.deadline).toISOString();
          const newWeekNumber = getCurrentWeekLabel(new Date(form.deadline));
          if (newDeadline !== problem.deadline) data.deadline = newDeadline;
          if (newWeekNumber !== (problem.weekNumber ?? '')) data.weekNumber = newWeekNumber;
        }
        if (JSON.stringify(form.allowedLanguages) !== JSON.stringify(problem.allowedLanguages ?? [])) {
          data.allowedLanguages = form.allowedLanguages;
        }
        if (form.sourceUrl.trim() !== (problem.sourceUrl ?? '')) data.sourceUrl = form.sourceUrl.trim();
        if (form.sourcePlatform.trim() !== (problem.sourcePlatform ?? '')) data.sourcePlatform = form.sourcePlatform.trim() as UpdateProblemData['sourcePlatform'];
        if (form.status !== problem.status) data.status = form.status as UpdateProblemData['status'];
        if (form.category !== (problem.category ?? 'ALGORITHM')) data.category = form.category as UpdateProblemData['category'];

        await problemApi.update(problemId, data);
        router.push(`/problems/${problemId}`);
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : t('edit.error.submitFailed'));
      } finally {
        setIsSubmitting(false);
      }
    },
    [form, problem, problemId, router, t],
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
  }, [problemId, router, t]);

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
        <PlatformSearchSection
          activePlatform={activePlatform}
          onPlatformChange={handlePlatformChange}
          bojQuery={bojQuery}
          setBojQuery={setBojQuery}
          bojSearching={bojSearching}
          bojError={bojError}
          setBojError={setBojError}
          bojResult={bojResult}
          bojApplied={bojApplied}
          handleBojSearch={handleBojSearch}
          handleBojKeyDown={handleBojKeyDown}
          handleBojReset={handleBojReset}
          programmersQuery={programmersQuery}
          setProgrammersQuery={setProgrammersQuery}
          programmersSearching={programmersSearching}
          programmersError={programmersError}
          setProgrammersError={setProgrammersError}
          programmersResult={programmersResult}
          programmersApplied={programmersApplied}
          handleProgrammersSearch={handleProgrammersSearch}
          handleProgrammersKeyDown={handleProgrammersKeyDown}
          handleProgrammersReset={handleProgrammersReset}
          isSubmitting={isSubmitting}
        />

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
              <BasicInfoSection
                form={form}
                onChange={handleChange}
                fieldErrors={fieldErrors}
                disabled={isSubmitting}
                searchApplied={bojApplied || programmersApplied}
              />

              <StatusDifficultySection
                form={form}
                onChange={handleChange}
                disabled={isSubmitting}
                searchApplied={bojApplied || programmersApplied}
              />

              {/* 마감 & 상태 섹션 헤더 */}
              <div className="flex items-center gap-2 pt-3 border-t border-border">
                <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary-soft text-primary">
                  <Settings className="h-3.5 w-3.5" />
                </div>
                <span className="text-sm font-semibold text-text">{t('edit.deadlineSettings')}</span>
              </div>

              <DeadlineSection
                form={form}
                onChange={handleChange}
                fieldErrors={fieldErrors}
                onDateSelect={handleDateSelect}
                disabled={isSubmitting}
              />

              <LanguageSection
                allowedLanguages={form.allowedLanguages}
                onToggle={handleLanguageToggle}
                disabled={isSubmitting}
              />

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
