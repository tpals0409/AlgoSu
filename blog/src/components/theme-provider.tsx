/**
 * @file       theme-provider.tsx
 * @domain     blog
 * @layer      ui
 * @related    src/app/layout.tsx, src/components/theme-toggle.tsx
 *
 * next-themes의 ThemeProvider를 감싸는 Client 컴포넌트.
 * App Router의 RootLayout(Server Component)에서 Context를 쓰려면
 * 반드시 Client Wrapper를 통해 주입해야 합니다.
 * globals.css의 :root / .dark CSS variable은 Sprint 72에서 완성되어 있고,
 * 본 Provider는 `class` attribute 전략으로 <html>에 `dark` 클래스를 토글합니다.
 */
'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ReactNode } from 'react';

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
