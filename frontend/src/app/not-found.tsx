import type { ReactNode } from 'react';
import Link from 'next/link';

export default function NotFound(): ReactNode {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-4">
      <h1 className="text-6xl font-bold text-text">404</h1>
      <p className="mt-4 text-sm text-text-3">
        페이지를 찾을 수 없습니다.
      </p>
      <Link
        href="/dashboard"
        className="mt-6 rounded-btn bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:brightness-110"
      >
        대시보드로 돌아가기
      </Link>
    </div>
  );
}
