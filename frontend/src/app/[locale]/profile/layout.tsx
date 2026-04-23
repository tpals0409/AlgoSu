/**
 * @file Profile 레이아웃 — locale 분기 메타데이터
 * @domain identity
 * @layer layout
 * @related profile/page.tsx, messages/account.json
 *
 * getTranslations('account')로 profile.meta.title/description을 로케일별로 생성한다.
 */

import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';

interface ProfileLayoutProps {
  readonly children: ReactNode;
  readonly params: Promise<{ locale: string }>;
}

/**
 * Profile 그룹 메타데이터 — 로케일 분기.
 *
 * /ko/profile → "프로필"
 * /en/profile → "Profile"
 */
export async function generateMetadata({
  params,
}: ProfileLayoutProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'account' });

  return {
    title: t('profile.meta.title'),
    description: t('profile.meta.description'),
  };
}

export default function ProfileLayout({ children }: ProfileLayoutProps): ReactNode {
  return children;
}
