/**
 * @file       page.tsx
 * @domain     blog
 * @layer      app
 * @related    src/components/home-page.tsx
 *
 * 영어 블로그 홈 — /en 경로.
 */
import { HomePage } from '@/components/home-page';

export default function EnHomePage() {
  return <HomePage locale="en" />;
}
