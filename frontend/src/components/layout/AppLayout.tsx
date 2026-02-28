import type { ReactNode } from 'react';
import { TopNav } from '@/components/layout/TopNav';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
  readonly children: ReactNode;
  readonly className?: string;
}

export function AppLayout({ children, className }: AppLayoutProps): ReactNode {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopNav />
      <main
        className={cn(
          'mx-auto w-full max-w-screen-xl flex-1 px-4 py-6 sm:px-6 lg:px-8',
          className,
        )}
      >
        {children}
      </main>
      <footer className="border-t border-border py-4 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} AlgoSu. All rights reserved.
      </footer>
    </div>
  );
}
