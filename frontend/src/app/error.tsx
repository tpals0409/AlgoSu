'use client';

import type { ReactNode } from 'react';

interface ErrorPageProps {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}

export default function ErrorPage({ reset }: ErrorPageProps): ReactNode {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-4">
      <h1 className="text-4xl font-bold text-text">오류 발생</h1>
      <p className="mt-4 text-sm text-text-3">
        예기치 않은 오류가 발생했습니다.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-btn bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:brightness-110"
      >
        다시 시도
      </button>
    </div>
  );
}
