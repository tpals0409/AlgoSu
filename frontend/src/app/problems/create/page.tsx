/**
 * @file 문제 생성 페이지 (v2 전면 교체)
 * @domain problem
 * @layer page
 * @related problemApi, solvedacApi, studyApi, DifficultyBadge, Input, AppLayout
 */

'use client';

import { useState, useCallback, type FormEvent, type ReactNode, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, CheckCircle2, Search, ExternalLink, Plus, FileText, Clock } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { InlineSpinner } from '@/components/ui/LoadingSpinner';
import { useStudy } from '@/contexts/StudyContext';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { problemApi, solvedacApi, studyApi, type CreateProblemData, type SolvedacProblemInfo } from '@/lib/api';
import { DIFFICULTIES, DIFFICULTY_LABELS, LANGUAGES, LANGUAGE_VALUES } from '@/lib/constants';

// ─── TYPES ────────────────────────────────

interface FormState {
  title: string;
  description: string;
  difficulty: string;
  weekNumber: string;
  deadline: string;
  allowedLanguages: string[];
  sourceUrl: string;
  sourcePlatform: string;
}

interface FormErrors {
  title?: string;
  weekNumber?: string;
  deadline?: string;
}

// ─── HELPERS ──────────────────────────────

/**
 * 현재 날짜 기준 "X월Y주차" 문자열 생성
 * @domain problem
 */
function getCurrentWeekLabel(date: Date = new Date()): string {
  const month = date.getMonth() + 1;
  const week = Math.ceil(date.getDate() / 7);
  return `${month}월${week}주차`;
}

/**
 * 선택 가능한 주차 목록 생성
 * @domain problem
 */
function getWeekOptions(): string[] {
  const now = new Date();
  const month = now.getMonth() + 1;
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const totalWeeks = Math.ceil(lastDay / 7);
  const options: string[] = [];
  for (let w = 1; w <= totalWeeks; w++) {
    options.push(`${month}월${w}주차`);
  }
  const nextMonth = month === 12 ? 1 : month + 1;
  options.push(`${nextMonth}월1주차`);
  return options;
}

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

/**
 * 주차 문자열에서 해당 주의 날짜 목록 반환
 * @domain problem
 */
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

function validateForm(form: FormState): FormErrors {
  const errors: FormErrors = {};
  if (!form.title.trim()) errors.title = '문제 제목을 입력해주세요.';
  if (!form.weekNumber.trim()) errors.weekNumber = '주차를 선택해주세요.';
  if (!form.deadline) errors.deadline = '마감일을 선택해주세요.';
  return errors;
}

// ─── SELECT STYLE ─────────────────────────

const selectClass =
  'h-[40px] w-full px-3 pr-8 rounded-btn border border-border bg-input-bg text-text text-xs outline-none cursor-pointer transition-[border-color] duration-150 focus:border-primary disabled:cursor-not-allowed disabled:opacity-50 appearance-none' +
  " bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239C9A95%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22M6%209l6%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_10px_center]";

const labelClass = 'block text-[11px] font-medium text-text-2 mb-1.5';

// ─── RENDER ───────────────────────────────

/**
 * 문제 생성 페이지
 * @domain problem
 * @guard ADMIN-only
 */
export default function ProblemCreatePage(): ReactNode {
  const router = useRouter();
  useRequireAuth();
  const { currentStudyId, currentStudyRole } = useStudy();

  // ─── STATE ──────────────────────────────

  const [form, setForm] = useState<FormState>(() => ({
    title: '',
    description: '',
    difficulty: '',
    weekNumber: getCurrentWeekLabel(),
    deadline: '',
    allowedLanguages: [...LANGUAGE_VALUES],
    sourceUrl: '',
    sourcePlatform: 'BOJ',
  }));
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [created, setCreated] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // BOJ 검색
  const [bojQuery, setBojQuery] = useState('');
  const [bojSearching, setBojSearching] = useState(false);
  const [bojError, setBojError] = useState<string | null>(null);
  const [bojResult, setBojResult] = useState<SolvedacProblemInfo | null>(null);
  const [bojApplied, setBojApplied] = useState(false);

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
    setSubmitError(null);

    const errors = validateForm(form);
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
        studyApi.notifyProblemCreated(currentStudyId, {
          problemId: createdProblem.id,
          problemTitle: createdProblem.title,
          weekNumber: data.weekNumber,
        }).catch(() => {});
      }

      setCreated(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : '문제 생성에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // ─── GUARDS ─────────────────────────────

  if (currentStudyRole !== 'ADMIN') {
    return (
      <AppLayout>
        <div className="space-y-4">
          <Alert variant="error">문제 생성은 관리자만 가능합니다.</Alert>
          <Button variant="ghost" size="sm" onClick={() => router.push('/problems')}>
            <ChevronLeft />
            문제 목록
          </Button>
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
                    setBojQuery('');
                    setBojResult(null);
                    setBojError(null);
                    setBojApplied(false);
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
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/problems')}
          className="-ml-1"
        >
          <ChevronLeft />
          문제 목록
        </Button>

        {/* 페이지 타이틀 */}
        <div className="text-center">
          <h1 className="text-xl font-bold tracking-tight text-text">문제 추가</h1>
          <p className="mt-1 text-[13px] text-text-3">백준 문제를 검색하고 스터디에 추가하세요</p>
        </div>

        {/* 카드 1: 백준 검색 */}
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
                  pattern="[0-9]*"
                  placeholder="문제 번호 (예: 1000)"
                  value={bojQuery}
                  onChange={(e) => { setBojQuery(e.target.value); setBojError(null); }}
                  onKeyDown={handleBojKeyDown}
                  disabled={bojSearching}
                  className="w-full h-[40px] pl-8 pr-3 rounded-btn border border-border bg-input-bg text-text text-xs outline-none transition-[border-color] duration-150 placeholder:text-text-3 focus:border-primary disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
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
            </div>

            {bojError && (
              <p className="text-[11px] text-error">{bojError}</p>
            )}

            {bojResult && (
              <div className="flex items-center gap-2.5 rounded-btn bg-primary-soft border border-border px-3 py-2.5">
                <div className="flex items-center justify-center w-9 h-9 rounded-md bg-bg-card border border-border shrink-0">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-text truncate">{bojResult.title}</p>
                  <p className="text-[11px] text-text-3 mt-0.5">
                    #{bojResult.problemId}
                    {bojResult.difficulty && ` / ${bojResult.difficulty}`}
                  </p>
                </div>
                <a
                  href={bojResult.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-text-3 hover:text-primary transition-colors"
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
                placeholder="문제 제목"
                value={form.title}
                onChange={handleChange('title')}
                error={fieldErrors.title}
                disabled={isLoading || bojApplied}
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
                  className="w-full px-3 py-2 rounded-btn border border-border bg-input-bg text-text text-xs outline-none transition-[border-color] duration-150 placeholder:text-text-3 focus:border-primary disabled:cursor-not-allowed disabled:opacity-50 resize-y leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
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
                    주차 <span className="text-error text-[10px]">필수</span>
                  </label>
                  <select
                    id="create-weekNumber"
                    value={form.weekNumber}
                    onChange={handleChange('weekNumber')}
                    disabled={isLoading}
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

            {/* 카드 3: 마감 & 설정 (같은 폼 내) */}
            <div className="px-5 pb-5 space-y-4">
              <div className="flex items-center gap-2 pt-2">
                <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary-soft text-primary">
                  <Clock className="h-3.5 w-3.5" />
                </div>
                <span className="text-sm font-semibold text-text">마감 & 설정</span>
              </div>

              <div className="flex flex-col">
                <label htmlFor="create-deadline" className={labelClass}>
                  마감일 <span className="text-error text-[10px]">필수</span>
                </label>
                <select
                  id="create-deadline"
                  value={form.deadline}
                  onChange={handleChange('deadline')}
                  disabled={isLoading}
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
                disabled={isLoading || bojApplied}
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
                size="lg"
                className="flex-1"
                disabled={isLoading}
                onClick={() => router.back()}
              >
                취소
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="lg"
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
