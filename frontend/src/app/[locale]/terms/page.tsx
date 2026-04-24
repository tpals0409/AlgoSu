/**
 * @file 이용약관 페이지 (i18n 적용)
 * @domain legal
 * @layer page
 * @related LegalLayout, /privacy, messages/legal.json
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
    title: t('terms.meta.title'),
    description: t('terms.meta.description'),
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

export default async function TermsPage({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'legal' });

  return (
    <LegalLayout>
      <article className="space-y-4 text-[14px] leading-relaxed text-text-2">
        <h1 className="mb-8 text-[26px] font-bold tracking-tight text-text">
          {t('terms.heading')}
        </h1>

        <p>{t('terms.intro')}</p>

        <p className="text-[12px] text-text-3">
          {t('terms.effectiveDate')}
        </p>

        <SectionTitle>{t('terms.article1.title')}</SectionTitle>
        <p>{t('terms.article1.body')}</p>

        <SectionTitle>{t('terms.article2.title')}</SectionTitle>
        <ul className="list-disc space-y-1 pl-5">
          <li>{t('terms.article2.item1')}</li>
          <li>{t('terms.article2.item2')}</li>
        </ul>

        <SectionTitle>{t('terms.article3.title')}</SectionTitle>
        <p>{t('terms.article3.body')}</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>{t('terms.article3.item1')}</li>
          <li>{t('terms.article3.item2')}</li>
          <li>{t('terms.article3.item3')}</li>
          <li>{t('terms.article3.item4')}</li>
          <li>{t('terms.article3.item5')}</li>
        </ul>

        <SectionTitle>{t('terms.article4.title')}</SectionTitle>
        <ul className="list-disc space-y-1 pl-5">
          <li>{t('terms.article4.item1')}</li>
          <li>{t('terms.article4.item2')}</li>
        </ul>

        <SectionTitle>{t('terms.article5.title')}</SectionTitle>
        <p>{t('terms.article5.body')}</p>

        <SectionTitle>{t('terms.article6.title')}</SectionTitle>
        <ul className="list-disc space-y-1 pl-5">
          <li>{t('terms.article6.item1')}</li>
          <li>{t('terms.article6.item2')}</li>
          <li>{t('terms.article6.item3')}</li>
        </ul>

        <SectionTitle>{t('terms.article7.title')}</SectionTitle>
        <p>{t('terms.article7.body')}</p>

        <SectionTitle>{t('terms.article8.title')}</SectionTitle>
        <p>{t('terms.article8.body')}</p>

        <SectionTitle>{t('terms.article9.title')}</SectionTitle>
        <p>{t('terms.article9.body')}</p>
      </article>
    </LegalLayout>
  );
}
