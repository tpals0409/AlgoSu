/**
 * @file Root Layout — html/body 기반 최소 래퍼
 * @domain i18n
 * @layer layout
 * @related src/app/[locale]/layout.tsx, src/i18n/routing.ts
 *
 * Next.js App Router가 요구하는 루트 레이아웃.
 * getLocale()로 현재 locale을 읽어 <html lang> 속성을 동적으로 설정한다.
 * 모든 프로바이더와 UI 요소는 app/[locale]/layout.tsx에서 처리한다.
 */

import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { getLocale } from 'next-intl/server';
import '@/app/globals.css';

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

/**
 * 루트 레이아웃 — <html lang> 동적 설정 + globals.css 주입.
 * 모든 로케일 라우트는 app/[locale]/layout.tsx가 감싸므로
 * 이 레이아웃은 최소한의 HTML 구조만 제공한다.
 */
export default async function RootLayout({
  children,
}: RootLayoutProps): Promise<ReactNode> {
  const locale = await getLocale();
  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="font-sans">{children}</body>
    </html>
  );
}
