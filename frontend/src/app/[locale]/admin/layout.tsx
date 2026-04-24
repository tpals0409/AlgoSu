/**
 * @file Admin 영역 레이아웃 — Server Component
 * @domain admin
 * @layer layout
 * @related lib/server/admin-guard.ts, components/layout/AppLayout
 *
 * requireAdmin()이 비admin 요청을 redirect 처리하므로
 * children은 admin 인증이 통과된 경우에만 렌더된다.
 * Server Component이므로 admin UI 번들이 비admin 클라이언트에 전송되지 않는다.
 */

import type { ReactNode } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { requireAdmin } from '@/lib/server/admin-guard';

interface AdminLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

/**
 * Admin 레이아웃 — 서버사이드 권한 검증 후 AppLayout 렌더.
 * Next.js 15에서 params는 Promise 타입이므로 await로 추출.
 */
export default async function AdminLayout({
  children,
  params,
}: AdminLayoutProps) {
  const { locale } = await params;

  await requireAdmin(locale);

  return <AppLayout>{children}</AppLayout>;
}
