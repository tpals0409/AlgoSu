import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AlgoSu Tech Blog',
  description: 'AlgoSu 프로젝트의 아키텍처 결정과 기술 여정을 기록합니다.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-surface text-text antialiased">
        <header className="border-b border-border">
          <nav className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
            <a href="/" className="text-xl font-bold text-brand">
              AlgoSu Tech
            </a>
            <div className="flex gap-6 text-sm">
              <a href="/" className="hover:text-brand">Posts</a>
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-3xl px-6 py-10">{children}</main>
        <footer className="border-t border-border py-8 text-center text-sm text-text-muted">
          AlgoSu Team
        </footer>
      </body>
    </html>
  );
}
