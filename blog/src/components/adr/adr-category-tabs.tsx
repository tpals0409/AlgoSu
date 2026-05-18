/**
 * @file       adr-category-tabs.tsx
 * @domain     blog / adr
 * @layer      ui
 * @related    src/lib/adr/types.ts, src/lib/i18n.ts
 *
 * ADR 인덱스 카테고리 탭 — anchor 기반 (Permanent / Topic / Sprint).
 * locale prop에 따라 라벨이 번역되고 anchor는 동일하게 유지된다.
 */
import type { AdrKind } from '@/lib/adr/types';
import { type Locale, t, type DictKey } from '@/lib/i18n';

interface TabItem {
  kind: AdrKind;
  labelKey: DictKey;
  anchor: string;
  count: number;
}

interface AdrCategoryTabsProps {
  counts: Record<AdrKind, number>;
  locale?: Locale;
}

/** 탭 정의 목록을 구성한다. */
function buildTabs(counts: Record<AdrKind, number>): TabItem[] {
  return [
    {
      kind: 'permanent',
      labelKey: 'kindPermanent',
      anchor: '#permanent',
      count: counts.permanent,
    },
    {
      kind: 'topic',
      labelKey: 'kindTopic',
      anchor: '#topics',
      count: counts.topic,
    },
    {
      kind: 'sprint',
      labelKey: 'kindSprint',
      anchor: '#sprints',
      count: counts.sprint,
    },
  ];
}

/** ADR 카테고리 anchor 탭을 렌더링한다. */
export function AdrCategoryTabs({
  counts,
  locale = 'ko',
}: AdrCategoryTabsProps) {
  const tabs = buildTabs(counts);

  return (
    <nav
      aria-label={t(locale, 'adrCategoryAriaLabel')}
      className="flex gap-1 border-b border-border"
    >
      {tabs.map((tab) => (
        <a
          key={tab.kind}
          href={tab.anchor}
          className="relative px-4 py-2.5 text-sm font-medium text-text-muted transition-colors hover:text-brand"
        >
          {t(locale, tab.labelKey)}
          <span className="ml-1 rounded-full bg-surface-muted px-1.5 py-0.5 text-xs text-text-subtle">
            {tab.count}
          </span>
        </a>
      ))}
    </nav>
  );
}
