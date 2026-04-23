/**
 * @file Auth 레이아웃 — locale 분기 메타데이터
 * @domain identity
 * @layer layout
 * @related login/page.tsx, callback/page.tsx, messages/auth.json
 *
 * getTranslations('auth')로 meta.title/description을 로케일별로 생성한다.
 */

import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';

interface AuthLayoutProps {
  readonly children: ReactNode;
  readonly params: Promise<{ locale: string }>;
}

/**
 * Auth 그룹 메타데이터 — 로케일 분기.
 *
 * /ko/login → "로그인 — AlgoSu"
 * /en/login → "Log In — AlgoSu"
 */
export async function generateMetadata({
  params,
}: AuthLayoutProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });

  return {
    title: t('meta.title'),
    description: t('meta.description'),
  };
}

export default function AuthLayout({ children }: AuthLayoutProps): ReactNode {
  return <>{children}</>;
}
