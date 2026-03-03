/**
 * @file 루트 레이아웃
 * @domain common
 * @layer page
 *
 * next/font/local로 Sora, Noto Sans KR, JetBrains Mono 로드 (빌드 타임 네트워크 의존 제거).
 * CSS 변수로 tailwind.config.ts fontFamily와 연동.
 */

import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import localFont from 'next/font/local';
import '@/app/globals.css';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { AuthProvider } from '@/contexts/AuthContext';
import { StudyProvider } from '@/contexts/StudyContext';

const sora = localFont({
  src: '../../public/fonts/sora-variable.woff2',
  variable: '--font-sora',
  display: 'swap',
  weight: '300 700',
});

const notoSansKR = localFont({
  src: '../../public/fonts/noto-sans-kr-variable.woff2',
  variable: '--font-noto',
  display: 'swap',
  weight: '300 700',
});

const jetbrainsMono = localFont({
  src: '../../public/fonts/jetbrains-mono-variable.woff2',
  variable: '--font-jetbrains',
  display: 'swap',
  weight: '400 500',
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
