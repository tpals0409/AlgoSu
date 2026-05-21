/**
 * @file       page.tsx
 * @domain     blog
 * @layer      app
 * @related    src/components/about-page.tsx
 *
 * 영어 About 페이지 — /en/about 경로.
 */
import type { Metadata } from 'next';
import { AboutPage } from '@/components/about-page';

export const metadata: Metadata = {
  title: 'About — AlgoSu Tech Blog',
  description: 'The person behind AlgoSu — Semin Kim, Agentic AI Engineer & Builder.',
  alternates: {
    languages: { ko: '/about' },
  },
};

export default function EnAboutPage() {
  return <AboutPage locale="en" />;
}
