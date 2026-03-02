/**
 * @file 루트 레이아웃
 * @domain common
 * @layer page
 *
 * next/font로 Sora, Noto Sans KR, JetBrains Mono 로드.
 * CSS 변수로 tailwind.config.ts fontFamily와 연동.
 */

import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Sora, Noto_Sans_KR, JetBrains_Mono } from 'next/font/google';
import '@/app/globals.css';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { AuthProvider } from '@/contexts/AuthContext';
import { StudyProvider } from '@/contexts/StudyContext';

const sora = Sora({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-sora',
  display: 'swap',
});

const notoSansKR = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-noto',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'AlgoSu',
    template: '%s | AlgoSu',
  },
  description: '알고리즘 스터디 플랫폼',
};

interface RootLayoutProps {
  readonly children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps): ReactNode {
  return (
    <html
      lang="ko"
      suppressHydrationWarning
      className={`${sora.variable} ${notoSansKR.variable} ${jetbrainsMono.variable}`}
    >
      <body className="font-sans">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
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
