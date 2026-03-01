'use client';

import { useState, useEffect, use, type FormEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
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
import { LoadingSpinner, InlineSpinner } from '@/components/ui/LoadingSpinner';
import { useStudy } from '@/contexts/StudyContext';
import { problemApi, type Problem, type UpdateProblemData } from '@/lib/api';

const DIFFICULTIES = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND'] as const;
const DIFFICULTY_LABELS: Record<string, string> = {
  BRONZE: '브론즈',
  SILVER: '실버',
  GOLD: '골드',
  PLATINUM: '플래티넘',
  DIAMOND: '다이아',
};

const STATUSES = ['ACTIVE', 'CLOSED', 'DRAFT'] as const;
const STATUS_LABELS: Record<string, string> = {
  ACTIVE: '진행 중',
  CLOSED: '종료',
  DRAFT: '초안',
};

const LANGUAGES = ['python', 'javascript', 'typescript', 'java', 'cpp', 'c', 'go', 'rust'] as const;

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
}

function validateForm(form: FormState): FormErrors {
  const errors: FormErrors = {};
  if (!form.title.trim()) {
    errors.title = '문제 제목을 입력해주세요.';
  }
  if (!form.weekNumber.trim()) {
    errors.weekNumber = '주차를 입력해주세요.';
  } else if (isNaN(Number(form.weekNumber)) || Number(form.weekNumber) < 1) {
    errors.weekNumber = '1 이상의 숫자를 입력해주세요.';
  }
  return errors;
}

function toLocalDatetimeString(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
    allowedLanguages: [],
    sourceUrl: '',
    sourcePlatform: '',
    status: '',
  });
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        setForm({
          title: data.title ?? '',
          description: data.description ?? '',
          difficulty: data.difficulty ?? '',
          weekNumber: String(data.weekNumber ?? ''),
          deadline: data.deadline ? toLocalDatetimeString(data.deadline) : '',
          allowedLanguages: data.allowedLanguages ?? [],
          sourceUrl: data.sourceUrl ?? '',
          sourcePlatform: data.sourcePlatform ?? '',
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
  }, [problemId]);

  // ADMIN 권한 체크
  if (currentStudyRole !== 'OWNER') {
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

  const handleChange = (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
      setApiError(null);
    };

  const handleLanguageToggle = (lang: string) => {
    setForm((prev) => ({
      ...prev,
      allowedLanguages: prev.allowedLanguages.includes(lang)
        ? prev.allowedLanguages.filter((l) => l !== lang)
        : [...prev.allowedLanguages, lang],
    }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();

    const errors = validateForm(form);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    // ACTIVE → CLOSED 변경 시 확인 다이얼로그
    if (problem.status === 'ACTIVE' && form.status === 'CLOSED') {
      const confirmed = window.confirm(
        '문제를 마감하면 더 이상 제출할 수 없습니다. 계속하시겠습니까?',
      );
      if (!confirmed) return;
    }

    setIsSubmitting(true);
    setApiError(null);

    try {
      const data: UpdateProblemData = {};
      if (form.title.trim() !== problem.title) data.title = form.title.trim();
      if (form.description.trim() !== (problem.description ?? '')) data.description = form.description.trim();
      if (form.difficulty !== (problem.difficulty ?? '')) data.difficulty = (form.difficulty || undefined) as UpdateProblemData['difficulty'];
      if (Number(form.weekNumber) !== problem.weekNumber) data.weekNumber = Number(form.weekNumber);
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
    } catch {
      setApiError('문제 수정에 실패했습니다. 다시 시도해주세요.');
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

        <Card>
          <CardHeader>
            <CardTitle>문제 수정</CardTitle>
            <CardDescription>문제 정보를 수정합니다.</CardDescription>
          </CardHeader>

          <form onSubmit={(e) => void handleSubmit(e)} noValidate>
            <CardContent className="space-y-4">
              {apiError && (
                <Alert variant="error" onClose={() => setApiError(null)}>
                  {apiError}
                </Alert>
              )}

              <Input
                label="문제 제목"
                placeholder="예: Two Sum"
                value={form.title}
                onChange={handleChange('title')}
                error={fieldErrors.title}
                disabled={isSubmitting}
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
                  disabled={isSubmitting}
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
                  난이도 (선택)
                </label>
                <select
                  id="input-difficulty"
                  value={form.difficulty}
                  onChange={handleChange('difficulty')}
                  disabled={isSubmitting}
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

              <Input
                label="주차"
                type="number"
                placeholder="예: 1"
                min={1}
                value={form.weekNumber}
                onChange={handleChange('weekNumber')}
                error={fieldErrors.weekNumber}
                disabled={isSubmitting}
              />

              <Input
                label="마감일 (선택)"
                type="datetime-local"
                value={form.deadline}
                onChange={handleChange('deadline')}
                disabled={isSubmitting}
              />

              {/* 상태 드롭다운 */}
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
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>

              {/* 허용 언어 체크박스 */}
              <div className="flex flex-col">
                <span className="text-[11px] font-medium text-text2 mb-[5px]">
                  허용 언어 (선택)
                </span>
                <div className="flex flex-wrap gap-2">
                  {LANGUAGES.map((lang) => (
                    <label
                      key={lang}
                      className="inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={form.allowedLanguages.includes(lang)}
                        onChange={() => handleLanguageToggle(lang)}
                        disabled={isSubmitting}
                        className="h-3.5 w-3.5 rounded border-border text-primary-500 focus:ring-ring"
                      />
                      <span className="text-xs text-text1">{lang}</span>
                    </label>
                  ))}
                </div>
              </div>

              <Input
                label="출처 URL (선택)"
                placeholder="예: https://www.acmicpc.net/problem/1000"
                value={form.sourceUrl}
                onChange={handleChange('sourceUrl')}
                disabled={isSubmitting}
              />

              <Input
                label="출처 플랫폼 (선택)"
                placeholder="예: BOJ, LeetCode, Programmers"
                value={form.sourcePlatform}
                onChange={handleChange('sourcePlatform')}
                disabled={isSubmitting}
              />
            </CardContent>

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
                    수정 중...
                  </>
                ) : (
                  '수정 완료'
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </AppLayout>
  );
}
