'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, CheckCircle2 } from 'lucide-react';
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
import { InlineSpinner } from '@/components/ui/LoadingSpinner';
import { useStudy } from '@/contexts/StudyContext';
import { problemApi, type CreateProblemData } from '@/lib/api';
import { DIFFICULTIES, DIFFICULTY_LABELS, LANGUAGES } from '@/lib/constants';

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

export default function ProblemCreatePage(): ReactNode {
  const router = useRouter();
  const { currentStudyRole } = useStudy();

  const [form, setForm] = useState<FormState>({
    title: '',
    description: '',
    difficulty: '',
    weekNumber: '',
    deadline: '',
    allowedLanguages: [],
    sourceUrl: '',
    sourcePlatform: '',
  });
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [created, setCreated] = useState(false);

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

    setIsLoading(true);
    setApiError(null);

    try {
      const data: CreateProblemData = {
        title: form.title.trim(),
        weekNumber: Number(form.weekNumber),
      };
      if (form.description.trim()) data.description = form.description.trim();
      if (form.difficulty) data.difficulty = form.difficulty as CreateProblemData['difficulty'];
      if (form.deadline) data.deadline = new Date(form.deadline).toISOString();
      if (form.allowedLanguages.length > 0) data.allowedLanguages = form.allowedLanguages;
      if (form.sourceUrl.trim()) data.sourceUrl = form.sourceUrl.trim();
      if (form.sourcePlatform.trim()) data.sourcePlatform = form.sourcePlatform.trim();

      await problemApi.create(data);
      setCreated(true);
    } catch {
      setApiError('문제 생성에 실패했습니다. 다시 시도해주세요.');
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
                      weekNumber: '',
                      deadline: '',
                      allowedLanguages: [],
                      sourceUrl: '',
                      sourcePlatform: '',
                    });
                    setFieldErrors({});
                    setApiError(null);
                    setCreated(false);
                  }}
                >
                  다시 등록
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
        <Card>
          <CardHeader>
            <CardTitle>새 문제 등록</CardTitle>
            <CardDescription>스터디에 새로운 알고리즘 문제를 추가합니다.</CardDescription>
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
                disabled={isLoading}
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
                  난이도 (선택)
                </label>
                <select
                  id="input-difficulty"
                  value={form.difficulty}
                  onChange={handleChange('difficulty')}
                  disabled={isLoading}
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

              <div>
                <Input
                  label="주차"
                  type="number"
                  placeholder="예: 1"
                  min={1}
                  value={form.weekNumber}
                  onChange={handleChange('weekNumber')}
                  error={fieldErrors.weekNumber}
                  disabled={isLoading}
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  스터디 진도를 나타내는 번호입니다.
                </p>
              </div>

              <Input
                label="마감일 (선택)"
                type="datetime-local"
                value={form.deadline}
                onChange={handleChange('deadline')}
                disabled={isLoading}
              />

              {/* 허용 언어 체크박스 */}
              <div className="flex flex-col">
                <span className="text-[11px] font-medium text-text2 mb-[5px]">
                  허용 언어 (선택)
                </span>
                <p className="text-[10px] text-muted-foreground mb-1.5">
                  선택하지 않으면 모든 언어가 허용됩니다.
                </p>
                <div className="flex flex-wrap gap-2">
                  {LANGUAGES.map((lang) => (
                    <label
                      key={lang.value}
                      className="inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={form.allowedLanguages.includes(lang.value)}
                        onChange={() => handleLanguageToggle(lang.value)}
                        disabled={isLoading}
                        className="h-3.5 w-3.5 rounded border-border text-primary-500 focus:ring-ring"
                      />
                      <span className="text-xs text-text1">{lang.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <Input
                label="출처 URL (선택)"
                placeholder="예: https://www.acmicpc.net/problem/1000"
                value={form.sourceUrl}
                onChange={handleChange('sourceUrl')}
                disabled={isLoading}
              />

              <Input
                label="출처 플랫폼 (선택)"
                placeholder="예: BOJ, LeetCode, Programmers"
                value={form.sourcePlatform}
                onChange={handleChange('sourcePlatform')}
                disabled={isLoading}
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
    </AppLayout>
  );
}
