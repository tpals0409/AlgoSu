'use client';

import * as React from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ThemeProviderProps } from 'next-themes';

/**
 * next-themes ThemeProvider 래퍼.
 * 추후 테마 로직 변경 시 단일 진입점에서 수정 가능.
 */
function ThemeProvider({ children, ...props }: ThemeProviderProps): React.ReactElement {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}

export { ThemeProvider };
