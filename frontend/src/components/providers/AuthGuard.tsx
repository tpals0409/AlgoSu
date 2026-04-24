/**
 * @file Authentication guard Provider
 * @domain common
 * @layer component
 * @related src/i18n/routing.ts, src/middleware.ts, src/app/[locale]/layout.tsx
 *
 * Verifies authentication state before rendering children.
 * Redirects unauthenticated users to /login, displays Skeleton while loading.
 *
 * Uses next-intl usePathname to strip locale prefix from the path,
 * passing a locale-neutral route as the redirect parameter
 * to ensure post-login return works correctly.
 *
 * @constraint Requires NextIntlClientProvider context — only works under [locale] segment.
 *   createNavigation(routing).usePathname() internally calls useLocale(),
 *   which throws a runtime error if NextIntlClientProvider is not in the tree.
 *   Do not use outside app/layout.tsx (root) or the [locale] subtree.
 */

'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter, usePathname } from '@/i18n/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/Skeleton';

interface AuthGuardProps {
  readonly children: ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps): ReactNode {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      const redirect = encodeURIComponent(pathname);
      router.replace(`/login?redirect=${redirect}`);
    }
  }, [isLoading, isAuthenticated, router, pathname]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
        <Skeleton variant="rect" width={320} height={40} />
        <Skeleton variant="text" lines={3} className="w-80" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
