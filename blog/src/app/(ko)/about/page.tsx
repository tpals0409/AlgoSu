/**
 * @file       page.tsx
 * @domain     blog
 * @layer      app
 * @related    src/components/about-page.tsx
 *
 * 한국어 About 페이지 — /about 경로.
 */
import type { Metadata } from 'next';
import { AboutPage } from '@/components/about-page';

export const metadata: Metadata = {
  title: 'About — AlgoSu Tech Blog',
  description: 'AlgoSu를 만든 사람 — 김세민, Agentic AI Engineer & Builder.',
  alternates: {
    languages: { en: '/en/about' },
  },
};

export default function KoAboutPage() {
  return <AboutPage locale="ko" />;
}
