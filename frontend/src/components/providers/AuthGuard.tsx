/**
 * @file 인증 가드 Provider
 * @domain common
 * @layer component
 * @related src/i18n/routing.ts, src/middleware.ts, src/app/[locale]/layout.tsx
 *
 * 자식 렌더링 전 인증 상태를 검증한다.
 * 미인증 시 /login으로 리디렉트, 로딩 중 Skeleton 표시.
 *
 * next-intl usePathname을 사용하여 locale prefix를 제거한 경로를
 * redirect 파라미터로 전달 — locale 중립 경로로 로그인 후 복귀 보장.
 *
 * @constraint NextIntlClientProvider 컨텍스트 필수 — [locale] 세그먼트 하위에서만 동작.
 *   createNavigation(routing).usePathname()은 내부적으로 useLocale()을 호출하며,
 *   NextIntlClientProvider가 상위 트리에 없으면 런타임 에러가 발생한다.
 *   app/layout.tsx(root) 또는 [locale] 트리 밖에서 사용 금지.
 */

'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { createNavigation } from 'next-intl/navigation';
import { routing } from '@/i18n/routing';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/Skeleton';

/**
 * locale prefix를 제거한 경로를 반환하는 next-intl 탐색 헬퍼.
 * /en/dashboard → /dashboard, /dashboard → /dashboard
 */
const { usePathname } = createNavigation(routing);

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
