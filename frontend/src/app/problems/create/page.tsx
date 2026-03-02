'use client';

import { useState, useEffect, useCallback, type FormEvent, type ReactNode, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, CheckCircle2, AlertCircle, Search, ExternalLink } from 'lucide-react';
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
import { InlineSpinner } from '@/components/ui/LoadingSpinner';
import { useStudy } from '@/contexts/StudyContext';
import { problemApi, solvedacApi, studyApi, type CreateProblemData, type SolvedacProblemInfo } from '@/lib/api';
import { DIFFICULTIES, DIFFICULTY_LABELS, LANGUAGES, LANGUAGE_VALUES } from '@/lib/constants';

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
  allowedLanguages?: string;
}

/** 현재 날짜 기준 "X월Y주차" 문자열 생성 */
function getCurrentWeekLabel(date: Date = new Date()): string {
  const month = date.getMonth() + 1;
  const week = Math.ceil(date.getDate() / 7);
  return `${month}월${week}주차`;
}

/** 선택 가능한 주차 목록 생성 (이번 달 전체 + 다음 달 1주차) */
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

/** 주차 문자열("3월1주차")에서 해당 주의 월~일 날짜 목록 반환 */
function getWeekDates(weekLabel: string): { label: string; value: string }[] {
  const match = weekLabel.match(/^(\d+)월(\d+)주차$/);
  if (!match) return [];
  const month = Number(match[1]);
  const week = Number(match[2]);
  const now = new Date();
  const year = now.getFullYear();
  // 주차가 다음 달 1주차인 경우 연도 보정
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
  if (!form.title.trim()) {
    errors.title = '문제 제목을 입력해주세요.';
  }
  if (!form.weekNumber.trim()) {
    errors.weekNumber = '주차를 선택해주세요.';
  }
  if (!form.deadline) {
    errors.deadline = '마감일을 선택해주세요.';
  }
  return errors;
}

export default function ProblemCreatePage(): ReactNode {
  const router = useRouter();
  const { currentStudyId, currentStudyRole } = useStudy();

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
      // 검색 성공 시 즉시 폼 자동 채움
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

  // ADMIN 권한 체크
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

  const handleChange = (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const value = e.target.value;
      setForm((prev) => ({
        ...prev,
        [field]: value,
        // 주차 변경 시 마감일 초기화
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
      if (form.sourceUrl.trim()) data.sourceUrl = form.sourceUrl.trim();
      if (form.sourcePlatform.trim()) data.sourcePlatform = form.sourcePlatform.trim();

      const created = await problemApi.create(data);

      // 스터디 멤버에게 알림 전송 (실패해도 문제 생성은 완료)
      if (currentStudyId) {
        studyApi.notifyProblemCreated(currentStudyId, {
          problemId: created.id,
          problemTitle: created.title,
          weekNumber: data.weekNumber,
        }).catch(() => { /* 알림 실패는 무시 */ });
      }

      setCreated(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      showToast(msg || '문제 생성에 실패했습니다. 다시 시도해주세요.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-lg">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/problems')}
          className="mb-4 -ml-1"
        >
          <ChevronLeft />
          문제 목록
        </Button>

        {created ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="flex items-center justify-center rounded-full bg-[rgba(80,200,120,0.22)] p-4">
                <CheckCircle2 className="h-8 w-8 text-success" aria-hidden />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">문제가 등록되었습니다!</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  추가로 문제를 등록하거나 목록으로 돌아갈 수 있습니다.
                </p>
              </div>
              <div className="flex gap-3 mt-2">
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => router.push('/problems')}
                >
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
                  }}
                >
                  다시 등록
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
        <Card className={cardShake ? 'animate-shake' : ''} style={cardShake ? { boxShadow: '0 0 0 3px rgba(148, 126, 176, 0.4)' } : undefined}>
          <CardHeader>
            <CardTitle>새 문제 등록</CardTitle>
            <CardDescription>스터디에 새로운 알고리즘 문제를 추가합니다.</CardDescription>

            {/* 백준 문제 검색 — 헤더 영역에 통합 */}
            <div className="mt-3 space-y-2">
              <div className="relative flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text3 pointer-events-none" />
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="백준 문제번호로 검색"
                    value={bojQuery}
                    onChange={(e) => { setBojQuery(e.target.value); setBojError(null); }}
                    onKeyDown={handleBojKeyDown}
                    disabled={bojSearching}
                    className="w-full rounded-btn border border-border bg-bg2 text-text1 text-xs outline-none transition-[border-color] duration-150 placeholder:text-text3 focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ padding: '8px 12px 8px 30px', fontSize: '12px' }}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={bojSearching || !bojQuery.trim()}
                  onClick={() => void handleBojSearch()}
                  className="shrink-0"
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
                <div className="flex flex-wrap gap-1 -mt-0.5">
                  {bojResult.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] px-1.5 py-0.5 rounded-sm bg-bg3 text-text2"
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
                placeholder=""
                value={form.title}
                onChange={handleChange('title')}
                error={fieldErrors.title}
                disabled={isLoading || bojApplied}
              />

              {/* 설명 textarea */}
              <div className="flex flex-col">
                <label
                  htmlFor="input-description"
                  className="text-[11px] font-medium text-text2 mb-[5px]"
                >
                  설명 (선택)
                </label>
                <textarea
                  id="input-description"
                  placeholder="문제에 대한 설명을 입력하세요"
                  value={form.description}
                  onChange={handleChange('description')}
                  disabled={isLoading}
                  rows={4}
                  className="w-full px-3 py-2 rounded-btn border border-border bg-bg2 text-text1 text-xs outline-none transition-[border-color] duration-150 placeholder:text-text3 focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-50 resize-y"
                  style={{ padding: '8px 12px', fontSize: '12px' }}
                />
              </div>

              {/* 난이도 드롭다운 */}
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
                  disabled={isLoading || bojApplied}
                  className="w-full px-3 py-2 rounded-btn border border-border bg-bg2 text-text1 text-xs outline-none transition-[border-color] duration-150 focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ padding: '8px 12px', fontSize: '12px' }}
                >
                  <option value="">선택 안 함</option>
                  {DIFFICULTIES.map((d) => (
                    <option key={d} value={d}>
                      {DIFFICULTY_LABELS[d]}
                    </option>
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
                  disabled={isLoading}
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
                  disabled={isLoading}
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

              {/* 허용 언어 */}
              <div className="flex flex-col">
                <span className="text-[11px] font-medium text-text2 mb-[5px]">
                  허용 언어
                </span>
                <p className="text-[10px] text-muted-foreground mb-1.5">
                  탭하여 허용/해제할 수 있습니다.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {LANGUAGES.map((lang) => {
                    const selected = form.allowedLanguages.includes(lang.value);
                    return (
                      <button
                        key={lang.value}
                        type="button"
                        onClick={() => handleLanguageToggle(lang.value)}
                        disabled={isLoading}
                        className={`inline-flex items-center gap-1 text-[11px] font-medium leading-none px-2 py-[3px] rounded-[20px] transition-colors duration-150 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
                          selected
                            ? 'text-[var(--color-main)] bg-[rgba(148,126,176,0.22)]'
                            : 'text-[var(--color-sub)] bg-[rgba(163,165,195,0.12)] line-through'
                        }`}
                      >
                        {lang.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Input
                label="출처 URL"
                placeholder=""
                value={form.sourceUrl}
                onChange={handleChange('sourceUrl')}
                disabled={isLoading || bojApplied}
              />

              <Input
                label="출처 플랫폼"
                placeholder=""
                value={form.sourcePlatform}
                onChange={handleChange('sourcePlatform')}
                disabled
              />
            </CardContent>

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
                  '문제 등록'
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
        )}
      </div>

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
    </AppLayout>
  );
}
