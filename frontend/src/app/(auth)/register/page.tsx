'use client';

import { useState, useCallback, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { InlineSpinner } from '@/components/ui/LoadingSpinner';
import { useAuth } from '@/contexts/AuthContext';

interface FormState {
  email: string;
  password: string;
  confirmPassword: string;
  username: string;
}

interface FormErrors {
  email?: string;
  password?: string;
  confirmPassword?: string;
  username?: string;
}

function validateForm(form: FormState): FormErrors {
  const errors: FormErrors = {};

  if (!form.username) {
    errors.username = '사용자 이름을 입력해주세요.';
  } else if (form.username.length < 2 || form.username.length > 20) {
    errors.username = '사용자 이름은 2~20자여야 합니다.';
  } else if (!/^[a-zA-Z0-9가-힣_]+$/.test(form.username)) {
    errors.username = '영문, 숫자, 한글, 밑줄(_)만 사용할 수 있습니다.';
  }

  if (!form.email) {
    errors.email = '이메일을 입력해주세요.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    errors.email = '올바른 이메일 형식이 아닙니다.';
  }

  if (!form.password) {
    errors.password = '비밀번호를 입력해주세요.';
  } else if (form.password.length < 8) {
    errors.password = '비밀번호는 8자 이상이어야 합니다.';
  }

  if (!form.confirmPassword) {
    errors.confirmPassword = '비밀번호 확인을 입력해주세요.';
  } else if (form.password !== form.confirmPassword) {
    errors.confirmPassword = '비밀번호가 일치하지 않습니다.';
  }

  return errors;
}

export default function RegisterPage(): ReactNode {
  const router = useRouter();
  const { register } = useAuth();

  const [form, setForm] = useState<FormState>({
    email: '',
    password: '',
    confirmPassword: '',
    username: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleChange = useCallback(
    (field: keyof FormState) =>
      (e: React.ChangeEvent<HTMLInputElement>): void => {
        setForm((prev) => ({ ...prev, [field]: e.target.value }));
        setErrors((prev) => ({ ...prev, [field]: undefined }));
        setApiError(null);
      },
    [],
  );

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>): Promise<void> => {
      e.preventDefault();

      const validationErrors = validateForm(form);
      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        return;
      }

      setIsLoading(true);
      setApiError(null);

      try {
        await register(form.email, form.password, form.username);
        router.push('/problems');
      } catch (err: unknown) {
        setApiError((err as Error).message ?? '회원가입에 실패했습니다. 다시 시도해주세요.');
      } finally {
        setIsLoading(false);
      }
    },
    [form, register, router],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>회원가입</CardTitle>
        <CardDescription>AlgoSu 계정을 만들고 스터디에 참여하세요.</CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit} noValidate>
        <CardContent className="space-y-4">
          {apiError && (
            <Alert variant="error" onClose={() => setApiError(null)}>
              {apiError}
            </Alert>
          )}

          <Input
            type="text"
            label="사용자 이름"
            placeholder="홍길동"
            value={form.username}
            onChange={handleChange('username')}
            error={errors.username}
            hint="영문, 숫자, 한글, 밑줄(_) 사용 가능 (2~20자)"
            autoComplete="username"
            disabled={isLoading}
          />

          <Input
            type="email"
            label="이메일"
            placeholder="you@example.com"
            value={form.email}
            onChange={handleChange('email')}
            error={errors.email}
            autoComplete="email"
            disabled={isLoading}
          />

          <Input
            type="password"
            label="비밀번호"
            placeholder="8자 이상 입력"
            value={form.password}
            onChange={handleChange('password')}
            error={errors.password}
            hint="8자 이상의 비밀번호를 설정하세요."
            autoComplete="new-password"
            disabled={isLoading}
          />

          <Input
            type="password"
            label="비밀번호 확인"
            placeholder="비밀번호 재입력"
            value={form.confirmPassword}
            onChange={handleChange('confirmPassword')}
            error={errors.confirmPassword}
            autoComplete="new-password"
            disabled={isLoading}
          />
        </CardContent>

        <CardFooter className="flex-col gap-3">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <InlineSpinner />
                가입 중...
              </>
            ) : (
              '회원가입'
            )}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            이미 계정이 있으신가요?{' '}
            <Link
              href="/login"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              로그인
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
