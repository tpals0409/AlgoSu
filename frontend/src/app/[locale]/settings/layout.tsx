/**
 * @file Settings 레이아웃 — locale 분기 메타데이터
 * @domain settings
 * @layer layout
 * @related settings/page.tsx, messages/account.json
 *
 * getTranslations('account')로 settings.meta.title을 로케일별로 생성한다.
 */

import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';

interface SettingsLayoutProps {
  readonly children: ReactNode;
  readonly params: Promise<{ locale: string }>;
}

/**
 * Settings 그룹 메타데이터 — 로케일 분기.
 *
 * /ko/settings → "설정"
 * /en/settings → "Settings"
 */
export async function generateMetadata({
  params,
}: SettingsLayoutProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'account' });

  return {
    title: t('settings.meta.title'),
  };
}

export default function SettingsLayout({ children }: SettingsLayoutProps): ReactNode {
  return <>{children}</>;
}
