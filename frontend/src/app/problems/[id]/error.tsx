'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

interface ErrorPageProps {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}

export default function ProblemDetailErrorPage({ reset }: ErrorPageProps): ReactNode {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-4">
      <h1 className="text-4xl font-bold text-text">문제 오류</h1>
      <p className="mt-4 text-sm text-text-3">
        문제 상세 정보를 불러올 수 없습니다.
      </p>
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-btn bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:brightness-110"
        >
          다시 시도
        </button>
        <Link
          href="/problems"
          className="rounded-btn border border-border px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-bg-2"
        >
          문제 목록으로
        </Link>
      </div>
    </div>
  );
}
