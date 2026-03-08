import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@/app/globals.css';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { WebVitalsReporter } from '@/components/providers/WebVitalsReporter';
import { AuthProvider } from '@/contexts/AuthContext';
import { StudyProvider } from '@/contexts/StudyContext';

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
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <WebVitalsReporter />
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
