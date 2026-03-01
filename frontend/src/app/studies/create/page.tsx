'use client';

import { useState, useCallback, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
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
import { AppLayout } from '@/components/layout/AppLayout';
import { useStudy } from '@/contexts/StudyContext';
import { studyApi } from '@/lib/api';

interface FormState {
  name: string;
  description: string;
  githubRepo: string;
}

interface FormErrors {
  name?: string;
}

function validateForm(form: FormState): FormErrors {
  const errors: FormErrors = {};
  if (!form.name.trim()) {
    errors.name = '스터디 이름을 입력해주세요.';
  } else if (form.name.trim().length < 2) {
    errors.name = '스터디 이름은 2자 이상이어야 합니다.';
  }
  return errors;
}

export default function StudyCreatePage(): ReactNode {
  const router = useRouter();
  const { setCurrentStudy, studies, setStudies } = useStudy();

  const [form, setForm] = useState<FormState>({ name: '', description: '', githubRepo: '' });
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = useCallback(
    (field: keyof FormState) =>
      (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm((prev) => ({ ...prev, [field]: e.target.value }));
        setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
        setApiError(null);
      },
    [],
  );

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      const errors = validateForm(form);
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        return;
      }

      setIsLoading(true);
      setApiError(null);

      try {
        const created = await studyApi.create({
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          githubRepo: form.githubRepo.trim() || undefined,
        });

        const updated = [...studies, created];
        setStudies(updated);
        setCurrentStudy(created.id);
        router.push('/problems');
      } catch {
        setApiError('스터디 생성에 실패했습니다. 다시 시도해주세요.');
      } finally {
        setIsLoading(false);
      }
    },
    [form, studies, setStudies, setCurrentStudy, router],
  );

  return (
    <AppLayout>
      <div className="mx-auto max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle>새 스터디 만들기</CardTitle>
            <CardDescription>팀원들과 함께 알고리즘 문제를 풀어보세요.</CardDescription>
          </CardHeader>

          <form onSubmit={(e) => void handleSubmit(e)} noValidate>
            <CardContent className="space-y-4">
              {apiError && (
                <Alert variant="error" onClose={() => setApiError(null)}>
                  {apiError}
                </Alert>
              )}

              <Input
                label="스터디 이름"
                placeholder="예: 알고리즘 스터디 1기"
                value={form.name}
                onChange={handleChange('name')}
                error={fieldErrors.name}
                disabled={isLoading}
              />

              <Input
                label="설명 (선택)"
                placeholder="스터디에 대한 간단한 설명"
                value={form.description}
                onChange={handleChange('description')}
                disabled={isLoading}
              />

              <div>
                <Input
                  label="GitHub 레포지토리 (선택)"
                  placeholder="예: owner/repo-name"
                  value={form.githubRepo}
                  onChange={handleChange('githubRepo')}
                  disabled={isLoading}
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  연결하면 멤버들의 제출 코드가 GitHub에 자동으로 Push됩니다.
                </p>
              </div>
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
                  '스터디 만들기'
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </AppLayout>
  );
}
