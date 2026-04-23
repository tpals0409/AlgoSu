import type { ReactNode } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';

export default function ProblemNotFound(): ReactNode {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-4">
      <Logo size={48} className="mb-6" />
      <h1 className="text-7xl font-bold text-primary">404</h1>
      <p className="mt-4 text-sm text-text-3">
        문제를 찾을 수 없습니다
      </p>
      <Link
        href="/problems"
        className="mt-6 rounded-btn bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:brightness-110"
      >
        문제 목록으로 돌아가기
      </Link>
    </div>
  );
}
