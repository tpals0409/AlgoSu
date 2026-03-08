/**
 * @file 문제 생성 페이지 (v2.1 UI 통일 리팩토링 + React Hook Form + Zod)
 * @domain problem
 * @layer page
 * @related problemApi, solvedacApi, studyApi, useBojSearch, useLanguageToggle
 */

'use client';

import { useState, useCallback, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Search, ExternalLink, Plus, FileText, Clock, X } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { BackBtn } from '@/components/ui/BackBtn';
import { DifficultyBadge } from '@/components/ui/DifficultyBadge';
import { InlineSpinner } from '@/components/ui/LoadingSpinner';
import { useStudy } from '@/contexts/StudyContext';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useRequireStudy } from '@/hooks/useRequireStudy';
import { useBojSearch } from '@/hooks/useBojSearch';
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
  useRequireAuth();
  useRequireStudy();
  const { currentStudyId, currentStudyRole } = useStudy();

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
      sourcePlatform: 'BOJ',
    },
  });

  const weekNumber = watch('weekNumber');
  const allowedLanguages = watch('allowedLanguages');

  // ─── STATE (BOJ 검색 등 비-폼 상태) ────

  const [, setFormProxy] = useState<ProblemFormState>(() => ({
    title: '',
    description: '',
    difficulty: '',
    weekNumber: getCurrentWeekLabel(),
    deadline: '',
    allowedLanguages: [...LANGUAGE_VALUES],
    sourceUrl: '',
    sourcePlatform: 'BOJ',
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

    if (!bojApplied) {
      setBojError('백준 문제를 검색해주세요.');
      return;
    }

    try {
      const data: CreateProblemData = {
        title: formData.title.trim(),
        weekNumber: formData.weekNumber.trim(),
      };
      if (formData.description?.trim()) data.description = formData.description.trim();
      if (formData.difficulty) data.difficulty = formData.difficulty as CreateProblemData['difficulty'];
      if (bojResult?.level) data.level = bojResult.level;
      if (formData.deadline) data.deadline = new Date(formData.deadline).toISOString();
      if (formData.allowedLanguages.length > 0) data.allowedLanguages = formData.allowedLanguages;
      if (bojResult?.tags?.length) data.tags = bojResult.tags;
      if (formData.sourceUrl?.trim()) data.sourceUrl = formData.sourceUrl.trim();
      if (formData.sourcePlatform?.trim()) data.sourcePlatform = formData.sourcePlatform.trim();

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

      setCreated(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : '문제 생성에 실패했습니다.');
    }
  };

  // ─── GUARDS ─────────────────────────────

  if (currentStudyRole !== 'ADMIN') {
    return (
      <AppLayout>
        <div className="space-y-4">
          <Alert variant="error">문제 생성은 관리자만 가능합니다.</Alert>
          <BackBtn label="문제 목록" href="/problems" />
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
                <p className="text-sm font-medium text-text">문제가 등록되었습니다!</p>
                <p className="mt-1 text-[11px] text-text-3">
                  추가로 문제를 등록하거나 목록으로 돌아갈 수 있습니다.
                </p>
              </div>
              <div className="flex gap-3 mt-2">
                <Button variant="ghost" size="md" onClick={() => router.push('/problems')}>
                  목록으로
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
                      sourcePlatform: 'BOJ',
                    });
                    setFormProxy({
                      title: '',
                      description: '',
                      difficulty: '',
                      weekNumber: getCurrentWeekLabel(),
                      deadline: '',
                      allowedLanguages: [...LANGUAGE_VALUES],
                      sourceUrl: '',
                      sourcePlatform: 'BOJ',
                    });
                    setCreated(false);
                    originalBojReset();
                    setSubmitError(null);
                  }}
                >
                  다시 등록
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
        <BackBtn label="문제 목록" href="/problems" className="-ml-1" />

        {/* 페이지 타이틀 */}
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-text">문제 추가</h1>
          <p className="mt-0.5 text-xs text-text-3">백준 문제를 검색하고 스터디에 추가하세요</p>
        </div>

        {/* 카드 1: 백준 검색 (필수) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary-soft text-primary">
                <Search className="h-3.5 w-3.5" />
              </div>
              백준 문제 검색
              <span className="text-error text-[11px]">필수</span>
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
                  pattern="[0-9]*"
                  placeholder="문제 번호 (예: 1000)"
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
                  연결 해제
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

        {/* 카드 2: 기본 정보 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary-soft text-primary">
                <FileText className="h-3.5 w-3.5" />
              </div>
              기본 정보
            </CardTitle>
          </CardHeader>
          <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate>
            <CardContent className="space-y-4">
              <Input
                label="제목"
                placeholder="백준 검색 시 자동 입력됩니다"
                {...register('title')}
                error={errors.title?.message}
                readOnly
                tabIndex={-1}
                className="cursor-default opacity-70"
              />

              <div className="flex flex-col">
                <label htmlFor="create-description" className={labelClass}>설명 (선택)</label>
                <textarea
                  id="create-description"
                  placeholder="문제에 대한 설명을 입력하세요"
                  {...register('description')}
                  disabled={isSubmitting}
                  rows={4}
                  className={textareaClass}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col">
                  <label htmlFor="create-difficulty" className={labelClass}>난이도</label>
                  <select
                    id="create-difficulty"
                    {...register('difficulty')}
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
                  <label htmlFor="create-weekNumber" className={labelClass}>
                    주차 <span className="text-error text-[11px]">필수</span>
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
                  {errors.weekNumber && (
                    <p className="mt-1 text-[11px] text-error">{errors.weekNumber.message}</p>
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
                <span className="text-sm font-semibold text-text">마감 & 설정</span>
              </div>

              <div className="flex flex-col">
                <label htmlFor="create-deadline" className={labelClass}>
                  마감일 <span className="text-error text-[11px]">필수</span>
                </label>
                <select
                  id="create-deadline"
                  {...register('deadline')}
                  disabled={isSubmitting}
                  aria-required
                  className={`${selectClass} ${errors.deadline ? 'border-error' : ''}`}
                >
                  <option value="" disabled>요일을 선택하세요</option>
                  {getWeekDates(weekNumber).map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
                {errors.deadline && (
                  <p className="mt-1 text-[11px] text-error">{errors.deadline.message}</p>
                )}
              </div>

              <div className="flex flex-col">
                <span className={labelClass}>허용 언어</span>
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
                label="출처 URL"
                {...register('sourceUrl')}
                readOnly
                tabIndex={-1}
                className="cursor-default opacity-70"
              />

              <Input
                label="출처 플랫폼"
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
                취소
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
                    생성 중...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    문제 생성
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
