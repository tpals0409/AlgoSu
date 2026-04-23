/**
 * @file Locale Layout — NextIntlClientProvider + 전체 프로바이더 래퍼
 * @domain i18n
 * @layer layout
 * @related src/app/layout.tsx, src/i18n/routing.ts, src/i18n/request.ts
 *
 * [locale] 세그먼트를 루트로 하는 레이아웃.
 * - NextIntlClientProvider: 클라이언트 컴포넌트에서 useTranslations() 사용 가능
 * - 기존 프로바이더(ThemeProvider, AuthProvider 등) 모두 이 레이아웃에서 제공
 * - Skip navigation, AdSense Script 포함
 */

import type { ReactNode } from 'react';
import Script from 'next/script';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { WebVitalsReporter } from '@/components/providers/WebVitalsReporter';
import { EventTrackerProvider } from '@/components/providers/EventTracker';
import { AuthProvider } from '@/contexts/AuthContext';
import { StudyProvider } from '@/contexts/StudyContext';
import { SWRProvider } from '@/components/providers/SWRProvider';
import { notFound } from 'next/navigation';

const adsenseEnabled = process.env.NEXT_PUBLIC_ADSENSE_ENABLED === 'true';
const adsenseClientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID ?? '';

interface LocaleLayoutProps {
  readonly children: ReactNode;
  /** Next.js 15 App Router: params는 Promise */
  readonly params: Promise<{ locale: string }>;
}

/**
 * Locale 레이아웃.
 *
 * params.locale 로 현재 언어를 확인하고,
 * 유효하지 않은 locale 요청은 Next.js notFound()로 처리한다.
 * getMessages()는 i18n/request.ts의 getRequestConfig에서 설정된
 * messages를 가져온다 — Phase B에서는 빈 객체, Phase C~에서 실제 번역 로드.
 */
export default async function LocaleLayout({
  children,
  params,
}: LocaleLayoutProps): Promise<ReactNode> {
  const { locale } = await params;

  // 유효하지 않은 locale → 404
  if (!(routing.locales as readonly string[]).includes(locale)) {
    notFound();
  }

  // next-intl 메시지 로드
  const messages = await getMessages();
  const t = await getTranslations({ locale, namespace: 'common' });

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-white focus:text-black"
      >
        {t('nav.skipNav')}
      </a>
      {adsenseEnabled && adsenseClientId && (
        <Script
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClientId}`}
          strategy="afterInteractive"
          crossOrigin="anonymous"
        />
      )}
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <WebVitalsReporter />
        <EventTrackerProvider />
        <AuthProvider>
          <StudyProvider>
            <SWRProvider>{children}</SWRProvider>
          </StudyProvider>
        </AuthProvider>
      </ThemeProvider>
    </NextIntlClientProvider>
  );
}
