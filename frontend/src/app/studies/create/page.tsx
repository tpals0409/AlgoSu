/**
 * @file 스터디 생성 페이지 (v2 디자인 시스템 + React Hook Form + Zod)
 * @domain study
 * @layer page
 * @related StudyContext, studyApi, AppLayout
 */

'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Card,
  CardContent,
  CardFooter,
} from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { BackBtn } from '@/components/ui/BackBtn';
import { InlineSpinner } from '@/components/ui/LoadingSpinner';
import { AppLayout } from '@/components/layout/AppLayout';
import { useStudy } from '@/contexts/StudyContext';
import { studyApi } from '@/lib/api';
import { studyCreateSchema, type StudyCreateFormData } from '@/lib/schemas/study';

// ─── RENDER ──────────────────────────────

/**
 * 스터디 생성 폼 페이지
 * @domain study
 */
export default function StudyCreatePage(): ReactNode {
  const router = useRouter();
  const { setCurrentStudy, studies, setStudies } = useStudy();

  // ─── FORM ──────────────────────────────
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<StudyCreateFormData>({
    resolver: zodResolver(studyCreateSchema),
    defaultValues: {
      name: '',
      description: '',
      nickname: '',
    },
  });

  const [apiError, setApiError] = useState<string | null>(null);

  // ─── HANDLERS ──────────────────────────

  const onSubmit = async (data: StudyCreateFormData): Promise<void> => {
    setApiError(null);

    try {
      const created = await studyApi.create({
        name: data.name.trim(),
        description: data.description?.trim() || undefined,
        nickname: data.nickname.trim(),
      });

      const withRole = { ...created, role: 'ADMIN' as const };
      const updated = [...studies, withRole];
      setStudies(updated);
      setCurrentStudy(created.id);
      router.push(`/studies/${created.id}`);
    } catch {
      setApiError('스터디 생성에 실패했습니다. 다시 시도해주세요.');
    }
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-[640px] space-y-4">
        {/* 뒤로가기 */}
        <BackBtn label="스터디 목록" href="/studies" className="-ml-1" />

        {/* 페이지 타이틀 */}
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-text">새 스터디 만들기</h1>
          <p className="mt-0.5 text-xs text-text-3">팀원들과 함께 알고리즘 문제를 풀어보세요</p>
        </div>

        <Card>
          <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate>
            <CardContent className="space-y-4">
              {apiError && (
                <Alert variant="error" onClose={() => setApiError(null)}>
                  {apiError}
                </Alert>
              )}

              <Input
                label="스터디 이름"
                placeholder="예: 알고리즘 스터디 1기"
                {...register('name')}
                error={errors.name?.message}
                disabled={isSubmitting}
              />

              <Input
                label="닉네임"
                placeholder="스터디 내에서 사용할 닉네임"
                {...register('nickname')}
                error={errors.nickname?.message}
                disabled={isSubmitting}
              />

              <Input
                label="설명 (선택)"
                placeholder="스터디에 대한 간단한 설명"
                {...register('description')}
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
