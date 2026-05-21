/**
 * @file       about-page.tsx
 * @domain     blog
 * @layer      ui
 * @related    src/lib/i18n.ts, src/components/about/about-hero.tsx,
 *             src/components/about/skill-groups.tsx
 *
 * About 페이지 — 자기소개(Hero) → 핵심 역량(SkillGroups) 순으로 구성한다.
 * (ko)/about/page.tsx·en/about/page.tsx가 locale prop으로 공유 → KO/EN 동시.
 */
import type { Locale } from '@/lib/i18n';
import { AboutHero } from '@/components/about/about-hero';
import { SkillGroups } from '@/components/about/skill-groups';

interface AboutPageProps {
  locale: Locale;
}

/** locale별 About 페이지를 렌더링한다. */
export function AboutPage({ locale }: AboutPageProps) {
  return (
    <div className="space-y-14 sm:space-y-16">
      <AboutHero locale={locale} />
      <SkillGroups locale={locale} />
    </div>
  );
}
