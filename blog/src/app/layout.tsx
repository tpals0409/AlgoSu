/**
 * @file       layout.tsx
 * @domain     blog
 * @layer      app
 * @related    src/components/theme-provider.tsx
 *
 * 루트 레이아웃 — locale 비의존 셸. ThemeProvider만 감싸고,
 * Header/main/footer는 하위 route group 레이아웃에서 렌더링한다.
 */
import type { Metadata } from 'next';
import { ThemeProvider } from '@/components/theme-provider';
import './globals.css';

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
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="min-h-screen bg-surface text-text antialiased">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
