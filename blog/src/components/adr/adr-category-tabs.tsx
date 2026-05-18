/**
 * @file       adr-category-tabs.tsx
 * @domain     blog / adr
 * @layer      ui
 * @related    src/lib/adr/types.ts
 *
 * ADR 인덱스 카테고리 탭 — anchor 기반 (Permanent / Topic / Sprint).
 * 기존 blog CategoryTabs 와 별개로 ADR 전용.
 */
import type { AdrKind } from '@/lib/adr/types';

interface TabItem {
  kind: AdrKind;
  label: string;
  anchor: string;
  count: number;
}

interface AdrCategoryTabsProps {
  counts: Record<AdrKind, number>;
}

/** 탭 정의 목록을 구성한다. */
function buildTabs(counts: Record<AdrKind, number>): TabItem[] {
  return [
    { kind: 'permanent', label: '영구', anchor: '#permanent', count: counts.permanent },
    { kind: 'topic', label: '토픽', anchor: '#topics', count: counts.topic },
    { kind: 'sprint', label: 'Sprint', anchor: '#sprints', count: counts.sprint },
  ];
}

/** ADR 카테고리 anchor 탭을 렌더링한다. */
export function AdrCategoryTabs({ counts }: AdrCategoryTabsProps) {
  const tabs = buildTabs(counts);

  return (
    <nav
      aria-label="ADR 카테고리"
      className="flex gap-1 border-b border-border"
    >
      {tabs.map((tab) => (
        <a
          key={tab.kind}
          href={tab.anchor}
          className="relative px-4 py-2.5 text-sm font-medium text-text-muted transition-colors hover:text-brand"
        >
          {tab.label}
          <span className="ml-1 rounded-full bg-surface-muted px-1.5 py-0.5 text-xs text-text-subtle">
            {tab.count}
          </span>
        </a>
      ))}
    </nav>
  );
}
