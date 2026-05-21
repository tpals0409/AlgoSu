/**
 * @file       skill-groups.tsx
 * @domain     blog
 * @layer      ui
 * @related    src/lib/site-content.ts, src/lib/i18n.ts, src/components/about-page.tsx
 *
 * About 핵심 역량 — 기술 스택 그룹 카드. 그룹 라벨(i18n) + 기술 태그(고유명사).
 * 데이터는 site-content의 ABOUT_SKILL_GROUPS SSOT에서 가져온다.
 */
import type { Locale } from '@/lib/i18n';
import { t } from '@/lib/i18n';
import { ABOUT_SKILL_GROUPS } from '@/lib/site-content';

interface SkillGroupsProps {
  locale: Locale;
}

/** 핵심 역량 그룹 5종을 반응형 그리드로 렌더링한다(데스크탑 2열 / 모바일 1열). */
export function SkillGroups({ locale }: SkillGroupsProps) {
  return (
    <section aria-labelledby="about-skills-title">
      <h2
        id="about-skills-title"
        className="mb-4 font-heading text-lg font-semibold text-text"
      >
        {t(locale, 'aboutSkillsTitle')}
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {ABOUT_SKILL_GROUPS.map((group) => (
          <div
            key={group.id}
            className="rounded-card border border-border bg-surface-elevated p-5 shadow-soft"
          >
            <p className="text-sm font-semibold text-text">{t(locale, group.labelKey)}</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {group.items.map((item) => (
                <li
                  key={item}
                  className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-text-muted"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
