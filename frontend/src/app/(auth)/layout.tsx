import type { ReactNode } from 'react';

interface AuthLayoutProps {
  readonly children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps): ReactNode {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-1.5 justify-center" style={{ fontWeight: 700, fontSize: '20px', letterSpacing: '-0.5px' }}>
          <span className="shrink-0 rounded-full bg-primary-500" style={{ width: '8px', height: '8px' }} aria-hidden />
          <h1 className="text-foreground">AlgoSu</h1>
        </div>
        <p className="mt-1 text-muted-foreground" style={{ fontSize: '12px' }}>알고리즘 스터디 플랫폼</p>
      </div>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
