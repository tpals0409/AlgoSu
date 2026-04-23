/**
 * @file Landing 페이지 (Server Component — 메타데이터 + 클라이언트 위임)
 * @domain common
 * @layer page
 * @related LandingContent, HomeRedirect, HeroButtons, FeatureCards
 *
 * generateMetadata로 로케일별 title/description을 분기하고,
 * 클라이언트 렌더링은 LandingContent 컴포넌트에 위임한다.
 */

import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { LandingContent } from '@/components/landing/LandingContent';

// ─── TYPES ──────────────────────────────

interface PageProps {
  readonly params: Promise<{ locale: string }>;
}

// ─── METADATA ───────────────────────────

/**
 * 로케일별 Landing 메타데이터 생성.
 * messages/{locale}/landing.json의 meta.title, meta.description 키를 사용한다.
 */
export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'landing' });

  return {
    title: t('meta.title'),
    description: t('meta.description'),
  };
}

// ─── RENDER ─────────────────────────────

/**
 * Landing 페이지 서버 컴포넌트.
 * 클라이언트 사이드 인터랙션(테마 토글, InView 애니메이션 등)은
 * LandingContent에서 처리한다.
 */
export default function LandingPage(): ReactNode {
  return <LandingContent />;
}
