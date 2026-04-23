/**
 * @file next-themes ThemeProvider wrapper
 * @domain common
 * @layer component
 * @related AppLayout
 */
'use client';

import * as React from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ThemeProviderProps } from 'next-themes';

/**
 * next-themes ThemeProvider wrapper.
 * Single entry point for future theme logic changes.
 */
function ThemeProvider({ children, ...props }: ThemeProviderProps): React.ReactElement {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}

export { ThemeProvider };
