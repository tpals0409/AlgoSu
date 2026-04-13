/**
 * @file       page.tsx
 * @domain     blog
 * @layer      app
 * @related    src/components/home-page.tsx
 *
 * 한국어 블로그 홈 — / 경로.
 */
import { HomePage } from '@/components/home-page';

export default function KoHomePage() {
  return <HomePage locale="ko" />;
}
