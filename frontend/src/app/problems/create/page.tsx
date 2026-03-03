/**
 * @file 문제 생성 페이지 (v2.1 UI 통일 리팩토링)
 * @domain problem
 * @layer page
 * @related problemApi, solvedacApi, studyApi, useBojSearch, useLanguageToggle
 */

'use client';

import { useState, useCallback, type FormEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
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
import { useLanguageToggle } from '@/hooks/useLanguageToggle';
import { problemApi, studyApi, type CreateProblemData } from '@/lib/api';
import { DIFFICULTIES, DIFFICULTY_LABELS, LANGUAGES, LANGUAGE_VALUES } from '@/lib/constants';
import type { Difficulty } from '@/lib/constants';
import {
  type ProblemFormState,
  type ProblemFormErrors,
  labelClass,
  selectClass,
  textareaClass,
  getCurrentWeekLabel,
  getWeekOptions,
  getWeekDates,
  validateProblemForm,
} from '@/lib/problem-form-utils';

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

  // ─── STATE ──────────────────────────────

  const [form, setForm] = useState<ProblemFormState>(() => ({
    title: '',
    description: '',
    difficulty: '',
    weekNumber: getCurrentWeekLabel(),
    deadline: '',
    allowedLanguages: [...LANGUAGE_VALUES],
    sourceUrl: '',
    sourcePlatform: 'BOJ',
  }));
  const [fieldErrors, setFieldErrors] = useState<ProblemFormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [created, setCreated] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ─── HOOKS ──────────────────────────────

  const {
    bojQuery, setBojQuery, bojSearching, bojError, setBojError,
    bojResult, bojApplied, handleBojSearch, handleBojKeyDown, handleBojReset,
  } = useBojSearch(setForm, setFieldErrors);

  const handleLanguageToggle = useLanguageToggle(setForm);

  // ─── HANDLERS ─────────────────────────────

  const handleChange = useCallback(
    (field: keyof ProblemFormState) =>
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
      setSubmitError(null);

      if (!bojApplied) {
        setBojError('백준 문제를 검색해주세요.');
        return;
      }

      const errors = validateProblemForm(form);
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        return;
      }

      setIsLoading(true);

      try {
        const data: CreateProblemData = {
          title: form.title.trim(),
          weekNumber: form.weekNumber.trim(),
        };
        if (form.description.trim()) data.description = form.description.trim();
        if (form.difficulty) data.difficulty = form.difficulty as CreateProblemData['difficulty'];
        if (bojResult?.level) data.level = bojResult.level;
        if (form.deadline) data.deadline = new Date(form.deadline).toISOString();
        if (form.allowedLanguages.length > 0) data.allowedLanguages = form.allowedLanguages;
        if (bojResult?.tags?.length) data.tags = bojResult.tags;
        if (form.sourceUrl.trim()) data.sourceUrl = form.sourceUrl.trim();
        if (form.sourcePlatform.trim()) data.sourcePlatform = form.sourcePlatform.trim();

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
                console.error('[ProblemCreate] 알림 전송 최종 실패');
              }
            }
          };
          void notifyWithRetry();
        }

        setCreated(true);
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : '문제 생성에 실패했습니다.');
      } finally {
        setIsLoading(false);
      }
    },
    [form, bojApplied, bojResult, currentStudyId, setBojError],
  );

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
                    setForm({
                      title: '',
                      description: '',
                      difficulty: '',
                      weekNumber: getCurrentWeekLabel(),
                      deadline: '',
                      allowedLanguages: [...LANGUAGE_VALUES],
                      sourceUrl: '',
                      sourcePlatform: 'BOJ',
                    });
                    setFieldErrors({});
                    setCreated(false);
                    handleBojReset();
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
          <form onSubmit={(e) => void handleSubmit(e)} noValidate>
            <CardContent className="space-y-4">
              <Input
                label="제목"
                placeholder="백준 검색 시 자동 입력됩니다"
                value={form.title}
                onChange={handleChange('title')}
                error={fieldErrors.title}
                disabled
              />

              <div className="flex flex-col">
                <label htmlFor="create-description" className={labelClass}>설명 (선택)</label>
                <textarea
                  id="create-description"
                  placeholder="문제에 대한 설명을 입력하세요"
                  value={form.description}
                  onChange={handleChange('description')}
                  disabled={isLoading}
                  rows={4}
                  className={textareaClass}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col">
                  <label htmlFor="create-difficulty" className={labelClass}>난이도</label>
                  <select
                    id="create-difficulty"
                    value={form.difficulty}
                    onChange={handleChange('difficulty')}
                    disabled={isLoading || bojApplied}
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
                  <select
                    id="create-weekNumber"
                    value={form.weekNumber}
                    onChange={handleChange('weekNumber')}
                    onBlur={handleBlur('weekNumber')}
                    disabled={isLoading}
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
            </CardContent>

            {/* 마감 & 설정 */}
            <div className="px-6 pb-6 space-y-4">
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
                  value={form.deadline}
                  onChange={handleChange('deadline')}
                  onBlur={handleBlur('deadline')}
                  disabled={isLoading}
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
                <span className={labelClass}>허용 언어</span>
                <div className="flex flex-wrap gap-1.5">
                  {LANGUAGES.map((lang) => {
                    const selected = form.allowedLanguages.includes(lang.value);
                    return (
                      <button
                        key={lang.value}
                        type="button"
                        onClick={() => handleLanguageToggle(lang.value)}
                        disabled={isLoading}
                        aria-pressed={selected}
                        className={`inline-flex items-center gap-1 text-[11px] font-medium px-3 py-1.5 rounded-badge border transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
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
                disabled
              />

              <Input
                label="출처 플랫폼"
                value={form.sourcePlatform}
                onChange={handleChange('sourcePlatform')}
                disabled
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
                disabled={isLoading}
                onClick={() => router.back()}
              >
                취소
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                className="flex-1"
                disabled={isLoading}
              >
                {isLoading ? (
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
