import type { ReactNode } from 'react';
import Link from 'next/link';

export default function NotFound(): ReactNode {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <h1 className="text-6xl font-bold text-foreground">404</h1>
      <p className="mt-4 text-sm text-muted-foreground">
        페이지를 찾을 수 없습니다.
      </p>
      <Link
        href="/dashboard"
        className="mt-6 rounded-btn bg-primary-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-400"
      >
        대시보드로 돌아가기
      </Link>
    </div>
  );
}
