/**
 * @file       layout.tsx
 * @domain     blog
 * @layer      app
 * @related    src/app/globals.css, tailwind.config.ts
 *
 * 루트 레이아웃 — locale 비의존 셸. 라이트 모드 고정.
 * next/font로 디자인 시스템 폰트(heading/body/mono)를 CSS 변수로 노출한다.
 * Header/main/footer는 하위 route group 레이아웃에서 렌더링한다.
 */
import type { Metadata } from 'next';
import { Space_Grotesk, Inter, Noto_Sans_KR, JetBrains_Mono } from 'next/font/google';
import './globals.css';

/** 헤딩/디스플레이 — 기하학적 프리미엄 (Space Grotesk). */
const heading = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-heading',
  display: 'swap',
});

/** 본문 라틴 — 고가독 (Inter). */
const sans = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

/** 본문 한국어 — Noto Sans KR (라틴 폴백 뒤에서 한글 글리프 담당). */
const sansKr = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-sans-kr',
  display: 'swap',
});

/** 코드/수치 — JetBrains Mono. */
const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'AlgoSu Tech Blog',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const fontVars = `${heading.variable} ${sans.variable} ${sansKr.variable} ${mono.variable}`;

  return (
    <html lang="ko" className={fontVars}>
      <body className="min-h-screen bg-surface font-sans text-text antialiased">
        {children}
      </body>
    </html>
  );
}
