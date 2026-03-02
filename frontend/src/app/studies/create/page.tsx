/**
 * @file 스터디 생성 페이지 (v2 디자인 시스템)
 * @domain study
 * @layer page
 * @related StudyContext, studyApi, AppLayout
 */

'use client';

import { useState, useCallback, type FormEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
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

// ─── TYPES ───────────────────────────────

interface FormState {
  name: string;
  description: string;
  nickname: string;
}

interface FormErrors {
  name?: string;
  nickname?: string;
}

// ─── HELPERS ─────────────────────────────

/**
 * 폼 검증 — 스터디명(필수, 2자 이상), 닉네임(필수)
 * @domain study
 */
function validateForm(form: FormState): FormErrors {
  const errors: FormErrors = {};
  if (!form.name.trim()) {
    errors.name = '스터디 이름을 입력해주세요.';
  } else if (form.name.trim().length < 2) {
    errors.name = '스터디 이름은 2자 이상이어야 합니다.';
  }
  if (!form.nickname.trim()) {
    errors.nickname = '닉네임을 입력해주세요.';
  }
  return errors;
}

// ─── RENDER ──────────────────────────────

/**
 * 스터디 생성 폼 페이지
 * @domain study
 */
export default function StudyCreatePage(): ReactNode {
  const router = useRouter();
  const { setCurrentStudy, studies, setStudies } = useStudy();

  // ─── STATE ─────────────────────────────
  const [form, setForm] = useState<FormState>({
    name: '',
    description: '',
    nickname: '',
  });
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // ─── HANDLERS ──────────────────────────

  /**
   * 폼 필드 변경 핸들러
   * @domain study
   */
  const handleChange = useCallback(
    (field: keyof FormState) =>
      (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm((prev) => ({ ...prev, [field]: e.target.value }));
        setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
        setApiError(null);
      },
    [],
  );

  /**
   * 스터디 생성 제출
   * @domain study
   */
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
        });

        // 생성자는 자동 ADMIN
        const withRole = { ...created, role: 'ADMIN' as const };
        const updated = [...studies, withRole];
        setStudies(updated);
        setCurrentStudy(created.id);
        router.push(`/studies/${created.id}`);
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
        {/* 뒤로가기 */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/studies')}
          className="-ml-1 mb-4"
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
          스터디 목록
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>새 스터디 만들기</CardTitle>
            <CardDescription>
              팀원들과 함께 알고리즘 문제를 풀어보세요.
            </CardDescription>
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
                label="닉네임"
                placeholder="스터디 내에서 사용할 닉네임"
                value={form.nickname}
                onChange={handleChange('nickname')}
                error={fieldErrors.nickname}
                disabled={isLoading}
              />

              <Input
                label="설명 (선택)"
                placeholder="스터디에 대한 간단한 설명"
                value={form.description}
                onChange={handleChange('description')}
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
