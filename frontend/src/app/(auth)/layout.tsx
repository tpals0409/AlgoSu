import type { ReactNode } from 'react';

interface AuthLayoutProps {
  readonly children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps): ReactNode {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-4">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-1.5 justify-center font-bold text-xl tracking-tight">
          <span className="shrink-0 rounded-full bg-primary w-2 h-2" aria-hidden />
          <h1 className="text-text">AlgoSu</h1>
        </div>
        <p className="mt-1 text-text-3 text-xs">알고리즘 스터디 플랫폼</p>
      </div>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
