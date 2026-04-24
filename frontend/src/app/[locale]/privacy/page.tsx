/**
 * @file 개인정보처리방침 페이지 (i18n 적용)
 * @domain legal
 * @layer page
 * @related LegalLayout, /terms, messages/legal.json
 */

import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { LegalLayout } from '@/components/layout/LegalLayout';

// ─── TYPES ──────────────────────────────

interface PageProps {
  readonly params: Promise<{ locale: string }>;
}

// ─── METADATA ───────────────────────────

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'legal' });

  return {
    title: t('privacy.meta.title'),
    description: t('privacy.meta.description'),
  };
}

// ─── HELPERS ────────────────────────────

/** 섹션 제목 스타일 */
function SectionTitle({ children }: { readonly children: ReactNode }) {
  return (
    <h2 className="mb-3 mt-10 text-lg font-bold text-text first:mt-0">
      {children}
    </h2>
  );
}

// ─── RENDER ─────────────────────────────

export default async function PrivacyPage({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'legal' });

  return (
    <LegalLayout>
      <article className="space-y-4 text-[14px] leading-relaxed text-text-2">
        <h1 className="mb-8 text-[26px] font-bold tracking-tight text-text">
          {t('privacy.heading')}
        </h1>

        <p>{t('privacy.intro')}</p>

        <p className="text-[12px] text-text-3">
          {t('privacy.effectiveDate')}
        </p>

        <SectionTitle>{t('privacy.section1.title')}</SectionTitle>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>{t('privacy.section1.socialLogin')}</strong></li>
          <li><strong>{t('privacy.section1.github')}</strong></li>
          <li><strong>{t('privacy.section1.usage')}</strong></li>
          <li><strong>{t('privacy.section1.auto')}</strong></li>
        </ul>

        <SectionTitle>{t('privacy.section2.title')}</SectionTitle>
        <ul className="list-disc space-y-1 pl-5">
          <li>{t('privacy.section2.item1')}</li>
          <li>{t('privacy.section2.item2')}</li>
          <li>{t('privacy.section2.item3')}</li>
          <li>{t('privacy.section2.item4')}</li>
          <li>{t('privacy.section2.item5')}</li>
        </ul>

        <SectionTitle>{t('privacy.section3.title')}</SectionTitle>
        <p>{t('privacy.section3.body')}</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>{t('privacy.section3.item1')}</li>
          <li>{t('privacy.section3.item2')}</li>
        </ul>

        <SectionTitle>{t('privacy.section4.title')}</SectionTitle>
        <p>{t('privacy.section4.body')}</p>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>{t('privacy.section4.adsense')}</strong></li>
          <li><strong>{t('privacy.section4.github')}</strong></li>
          <li>{t('privacy.section4.legal')}</li>
        </ul>

        <SectionTitle>{t('privacy.section5.title')}</SectionTitle>
        <p>{t('privacy.section5.body')}</p>

        <SectionTitle>{t('privacy.section6.title')}</SectionTitle>
        <ul className="list-disc space-y-1 pl-5">
          <li>{t('privacy.section6.item1')}</li>
          <li>{t('privacy.section6.item2')}</li>
          <li>{t('privacy.section6.item3')}</li>
        </ul>
        <p>{t('privacy.section6.body')}</p>

        <SectionTitle>{t('privacy.section7.title')}</SectionTitle>
        <ul className="list-disc space-y-1 pl-5">
          <li>{t('privacy.section7.team')}</li>
          <li>{t('privacy.section7.email')}</li>
        </ul>

        <SectionTitle>{t('privacy.section8.title')}</SectionTitle>
        <p>{t('privacy.section8.body')}</p>
      </article>
    </LegalLayout>
  );
}
