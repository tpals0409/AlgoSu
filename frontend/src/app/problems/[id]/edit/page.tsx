'use client';

import { useState, useEffect, useCallback, use, type FormEvent, type ReactNode, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, CheckCircle2, AlertCircle, Search, ExternalLink, Trash2 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { DifficultyBadge } from '@/components/ui/DifficultyBadge';
import { LoadingSpinner, InlineSpinner } from '@/components/ui/LoadingSpinner';
import { useStudy } from '@/contexts/StudyContext';
import { problemApi, solvedacApi, type Problem, type UpdateProblemData, type SolvedacProblemInfo } from '@/lib/api';
import { DIFFICULTIES, DIFFICULTY_LABELS, LANGUAGES, LANGUAGE_VALUES, PROBLEM_STATUSES, PROBLEM_STATUS_LABELS } from '@/lib/constants';

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

/** 주차 문자열("3월1주차")에서 해당 주의 월~일 날짜 목록 반환 */
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

/** ISO 날짜를 주차의 날짜 ISO 값으로 매칭 */
function matchDeadlineToWeekDate(deadline: string, weekLabel: string): string {
  const weekDates = getWeekDates(weekLabel);
  const deadlineDate = new Date(deadline);
  const deadlineDay = deadlineDate.getDate();
  const match = weekDates.find((d) => new Date(d.value).getDate() === deadlineDay);
  return match?.value ?? '';
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

function validateForm(form: FormState): FormErrors {
  const errors: FormErrors = {};
  if (!form.title.trim()) errors.title = '문제 제목을 입력해주세요.';
  if (!form.weekNumber.trim()) errors.weekNumber = '주차를 선택해주세요.';
  if (!form.deadline) errors.deadline = '마감일을 선택해주세요.';
  return errors;
}

/** 현재 월 기준 주차 옵션 생성 */
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

interface PageProps {
  readonly params: Promise<{ id: string }>;
}

export default function ProblemEditPage({ params }: PageProps): ReactNode {
  const { id: problemId } = use(params);
  const router = useRouter();
  const { currentStudyRole } = useStudy();

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

  // 백준 검색
  const [bojQuery, setBojQuery] = useState('');
  const [bojSearching, setBojSearching] = useState(false);
  const [bojError, setBojError] = useState<string | null>(null);
  const [bojResult, setBojResult] = useState<SolvedacProblemInfo | null>(null);
  const [bojApplied, setBojApplied] = useState(false);

  // 범용 토스트
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [toastFading, setToastFading] = useState(false);
  const [cardShake, setCardShake] = useState(false);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setToastFading(false);
    if (type === 'error') {
      setCardShake(true);
      setTimeout(() => setCardShake(false), 600);
    }
  }, []);

  useEffect(() => {
    if (!toast) return;
    const fadeTimer = setTimeout(() => setToastFading(true), 3000);
    const removeTimer = setTimeout(() => { setToast(null); setToastFading(false); }, 3300);
    return () => { clearTimeout(fadeTimer); clearTimeout(removeTimer); };
  }, [toast]);

  // 문제 데이터 로드
  useEffect(() => {
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
        // 기존에 sourceUrl이 있으면 BOJ 적용 상태로 표시
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
  }, [problemId]);

  // ADMIN 권한 체크
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

  if (isPageLoading) {
    return (
      <AppLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <LoadingSpinner size="lg" label="문제를 불러오는 중..." />
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

  const handleBojSearch = async (): Promise<void> => {
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
      showToast('문제 정보가 적용되었습니다');
    } catch (err: unknown) {
      setBojError(err instanceof Error ? err.message : '검색에 실패했습니다.');
    } finally {
      setBojSearching(false);
    }
  };

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
      if (isSelected && prev.allowedLanguages.length <= 1) {
        showToast('최소 1개 이상 선택해야 합니다.', 'error');
        return prev;
      }
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

    const errors = validateForm(form);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const firstError = Object.values(errors)[0];
      if (firstError) showToast(firstError, 'error');
      return;
    }

    // ACTIVE → CLOSED 변경 시 확인 다이얼로그
    if (problem.status === 'ACTIVE' && form.status === 'CLOSED') {
      const confirmed = window.confirm('문제를 마감하면 더 이상 제출할 수 없습니다. 계속하시겠습니까?');
      if (!confirmed) return;
    }

    // DRAFT → ACTIVE 변경 시 확인 다이얼로그
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
      router.push('/problems');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      showToast(msg || '문제 수정에 실패했습니다. 다시 시도해주세요.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-lg">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/problems/${problemId}`)}
          className="mb-4 -ml-1"
        >
          <ChevronLeft />
          문제 상세
        </Button>

        <Card className={cardShake ? 'animate-shake' : ''} style={cardShake ? { boxShadow: '0 0 0 3px rgba(148, 126, 176, 0.4)' } : undefined}>
          <CardHeader>
            <CardTitle>문제 수정</CardTitle>
            <CardDescription>문제 정보를 수정합니다.</CardDescription>

            {/* 백준 문제 검색 */}
            <div className="mt-3 space-y-2">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text3" aria-hidden />
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="백준 문제번호로 검색"
                    value={bojQuery}
                    onChange={(e) => setBojQuery(e.target.value)}
                    onKeyDown={handleBojKeyDown}
                    disabled={bojSearching || isSubmitting}
                    className="w-full pl-8 pr-3 py-2 rounded-btn border border-border bg-bg2 text-text1 text-xs outline-none transition-[border-color] duration-150 placeholder:text-text3 focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ padding: '8px 12px 8px 30px', fontSize: '12px' }}
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={bojSearching || isSubmitting || !bojQuery.trim()}
                  onClick={() => void handleBojSearch()}
                >
                  {bojSearching ? <InlineSpinner /> : '검색'}
                </Button>
              </div>
              {bojError && (
                <p className="text-[11px] text-[var(--color-error)]">{bojError}</p>
              )}
              {bojResult && (
                <div className="flex items-center gap-2.5 rounded-btn bg-bg2 px-3 py-2 animate-fade-in">
                  <span className="text-xs font-mono text-text3">#{bojResult.problemId}</span>
                  <span className="text-xs font-medium text-text1 truncate">{bojResult.title}</span>
                  {bojResult.difficulty && (
                    <DifficultyBadge difficulty={bojResult.difficulty} level={bojResult.level} showDot={false} />
                  )}
                  <a
                    href={bojResult.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto shrink-0 text-text3 hover:text-primary-500 transition-colors"
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
                      className="inline-block rounded-full bg-bg2 px-2 py-0.5 text-[10px] text-text3"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
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

              {/* 설명 */}
              <div className="flex flex-col">
                <label
                  htmlFor="input-description"
                  className="text-[11px] font-medium text-text2 mb-[5px]"
                >
                  설명 (선택)
                </label>
                <textarea
                  id="input-description"
                  value={form.description}
                  onChange={handleChange('description')}
                  disabled={isSubmitting}
                  rows={4}
                  className="w-full px-3 py-2 rounded-btn border border-border bg-bg2 text-text1 text-xs outline-none transition-[border-color] duration-150 placeholder:text-text3 focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-50 resize-y"
                  style={{ padding: '8px 12px', fontSize: '12px' }}
                />
              </div>

              {/* 난이도 + 주차 2열 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col">
                  <label
                    htmlFor="input-difficulty"
                    className="text-[11px] font-medium text-text2 mb-[5px]"
                  >
                    난이도
                  </label>
                  <select
                    id="input-difficulty"
                    value={form.difficulty}
                    onChange={handleChange('difficulty')}
                    disabled={isSubmitting || bojApplied}
                    className="w-full px-3 py-2 rounded-btn border border-border bg-bg2 text-text1 text-xs outline-none transition-[border-color] duration-150 focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ padding: '8px 12px', fontSize: '12px' }}
                  >
                    <option value="">선택 안 함</option>
                    {DIFFICULTIES.map((d) => (
                      <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col">
                  <label
                    htmlFor="input-weekNumber"
                    className="text-[11px] font-medium text-text2 mb-[5px]"
                  >
                    주차
                  </label>
                  <select
                    id="input-weekNumber"
                    value={form.weekNumber}
                    onChange={handleChange('weekNumber')}
                    disabled={isSubmitting}
                    className={`w-full px-3 py-2 rounded-btn border bg-bg2 text-text1 text-xs outline-none transition-[border-color] duration-150 focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-50 ${fieldErrors.weekNumber ? 'border-[var(--color-error)]' : 'border-border'}`}
                    style={{ padding: '8px 12px', fontSize: '12px' }}
                  >
                    {getWeekOptions().map((w) => (
                      <option key={w} value={w}>{w}</option>
                    ))}
                  </select>
                  {fieldErrors.weekNumber && (
                    <p className="mt-1 text-[11px] text-[var(--color-error)]">{fieldErrors.weekNumber}</p>
                  )}
                </div>
              </div>

              {/* 마감일 */}
              <div className="flex flex-col">
                <label
                  htmlFor="input-deadline"
                  className="text-[11px] font-medium text-text2 mb-[5px]"
                >
                  마감일
                </label>
                <select
                  id="input-deadline"
                  value={form.deadline}
                  onChange={handleChange('deadline')}
                  disabled={isSubmitting}
                  className={`w-full px-3 py-2 rounded-btn border bg-bg2 text-text1 text-xs outline-none transition-[border-color] duration-150 focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-50 ${fieldErrors.deadline ? 'border-[var(--color-error)]' : 'border-border'}`}
                  style={{ padding: '8px 12px', fontSize: '12px' }}
                >
                  <option value="" disabled>요일을 선택하세요</option>
                  {getWeekDates(form.weekNumber).map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
                {fieldErrors.deadline && (
                  <p className="mt-1 text-[11px] text-[var(--color-error)]">{fieldErrors.deadline}</p>
                )}
              </div>

              {/* 상태 */}
              <div className="flex flex-col">
                <label
                  htmlFor="input-status"
                  className="text-[11px] font-medium text-text2 mb-[5px]"
                >
                  상태
                </label>
                <select
                  id="input-status"
                  value={form.status}
                  onChange={handleChange('status')}
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 rounded-btn border border-border bg-bg2 text-text1 text-xs outline-none transition-[border-color] duration-150 focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ padding: '8px 12px', fontSize: '12px' }}
                >
                  {PROBLEM_STATUSES.map((s) => (
                    <option key={s} value={s}>{PROBLEM_STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </div>

              {/* 허용 언어 필 토글 */}
              <div className="flex flex-col">
                <span className="text-[11px] font-medium text-text2 mb-[5px]">
                  허용 언어 (선택)
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {LANGUAGES.map((lang) => {
                    const selected = form.allowedLanguages.includes(lang.value);
                    return (
                      <button
                        key={lang.value}
                        type="button"
                        onClick={() => handleLanguageToggle(lang.value)}
                        disabled={isSubmitting}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-medium border transition-colors duration-150 ${
                          selected
                            ? 'bg-main/15 text-main border-main/30'
                            : 'bg-bg2 text-text3 border-border line-through'
                        } disabled:cursor-not-allowed disabled:opacity-50`}
                      >
                        {lang.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 출처 URL */}
              <Input
                label="출처 URL"
                value={form.sourceUrl}
                onChange={handleChange('sourceUrl')}
                disabled={isSubmitting || bojApplied}
              />

              {/* 출처 플랫폼 */}
              <Input
                label="출처 플랫폼"
                value={form.sourcePlatform}
                onChange={handleChange('sourcePlatform')}
                disabled
              />
            </CardContent>

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
                onClick={async () => {
                  const confirmed = window.confirm(
                    '정말 이 문제를 삭제하시겠습니까? 관련 제출 기록도 함께 삭제됩니다.',
                  );
                  if (!confirmed) return;

                  setIsDeleting(true);
                  try {
                    await problemApi.delete(problemId);
                    router.replace('/problems');
                  } catch {
                    showToast('문제 삭제에 실패했습니다.', 'error');
                    setIsDeleting(false);
                  }
                }}
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

        {/* 토스트 */}
        {toast && (
          <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] transition-opacity duration-300 ${toastFading ? 'opacity-0' : 'opacity-100 animate-fade-in'}`}>
            <div className="flex items-center gap-2 rounded-card border border-border bg-surface px-4 py-2.5 shadow-modal">
              {toast.type === 'error'
                ? <AlertCircle className="h-3.5 w-3.5 text-[var(--color-error)] shrink-0" aria-hidden />
                : <CheckCircle2 className="h-3.5 w-3.5 text-[var(--color-success)] shrink-0" aria-hidden />}
              <span className="text-[12px] font-medium text-foreground">
                {toast.message}
              </span>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
