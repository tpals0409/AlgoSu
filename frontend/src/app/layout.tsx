import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Script from 'next/script';
import '@/app/globals.css';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { WebVitalsReporter } from '@/components/providers/WebVitalsReporter';
import { EventTrackerProvider } from '@/components/providers/EventTracker';
import { AuthProvider } from '@/contexts/AuthContext';
import { StudyProvider } from '@/contexts/StudyContext';

const adsenseEnabled = process.env.NEXT_PUBLIC_ADSENSE_ENABLED === 'true';
const adsenseClientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID ?? '';

export const metadata: Metadata = {
  title: {
    default: 'AlgoSu',
    template: '%s | AlgoSu',
  },
  description: '알고리즘 스터디 플랫폼',
  icons: {
    icon: [
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
};

interface RootLayoutProps {
  readonly children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps): ReactNode {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="font-sans">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-white focus:text-black"
        >
          콘텐츠로 건너뛰기
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
              {children}
            </StudyProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
