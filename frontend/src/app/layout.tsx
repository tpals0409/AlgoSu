import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@/app/globals.css';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { AuthProvider } from '@/contexts/AuthContext';
import { StudyProvider } from '@/contexts/StudyContext';

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
    <html lang="ko" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
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
