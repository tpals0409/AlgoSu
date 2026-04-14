/**
 * @file       layout.tsx
 * @domain     blog
 * @layer      app
 * @related    src/components/header.tsx
 *
 * 영어(en) route 레이아웃 — Header + main + footer.
 * document.documentElement.lang을 'en'으로 동적 전환한다.
 */
import type { Metadata } from 'next';
import { Header } from '@/components/header';

export const metadata: Metadata = {
  title: 'AlgoSu Tech Blog',
  description: 'Architecture decisions and engineering journey of AlgoSu.',
  alternates: {
    languages: { ko: '/' },
  },
};

export default function EnLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `document.documentElement.lang='en'`,
        }}
      />
      <Header locale="en" />
      <main className="mx-auto max-w-4xl px-6 py-10">{children}</main>
      <footer className="border-t border-border py-8 text-center text-sm text-text-muted">
        AlgoSu Team
      </footer>
    </>
  );
}
