/**
 * @file       category-tabs.tsx
 * @domain     blog
 * @layer      ui
 * @related    src/lib/i18n.ts, src/lib/posts.ts, src/components/post-list-with-filter.tsx
 *
 * 수평 카테고리 탭 — 활성 탭 하단에 brand 2px bar 인디케이터.
 * 글이 1편 이상 존재하는 카테고리만 동적으로 탭에 표시한다(graceful skip).
 * 7분류 카탈로그(CATEGORY_CATALOG)를 기반으로 탭 순서를 보장한다.
 */
'use client';

import type { Category } from '@/lib/posts';
import type { DictKey, Locale } from '@/lib/i18n';
import { t } from '@/lib/i18n';

/**
 * 7분류 카테고리 카탈로그 — value + i18n labelKey 매핑.
 * 순서가 탭 표시 순서를 결정한다.
 */
const CATEGORY_CATALOG: readonly { value: Category; labelKey: DictKey }[] = [
  { value: 'ai-agent', labelKey: 'categoryAiAgent' },
  { value: 'cicd', labelKey: 'categoryCicd' },
  { value: 'architecture', labelKey: 'categoryArchitecture' },
  { value: 'backend', labelKey: 'categoryBackend' },
  { value: 'platform', labelKey: 'categoryPlatform' },
  { value: 'frontend', labelKey: 'categoryFrontend' },
  { value: 'retrospective', labelKey: 'categoryRetrospective' },
] as const;

interface CategoryTabsProps {
  /** 현재 활성 카테고리 */
  activeCategory: Category | 'all';
  /** 탭 변경 콜백 */
  onCategoryChange: (category: Category | 'all') => void;
  /** 현재 locale */
  locale: Locale;
  /** 글이 1편 이상 존재하는 카테고리 집합 — 이 집합에 없는 카테고리는 탭 미표시 */
  availableCategories: ReadonlySet<Category>;
}

/**
 * 수평 카테고리 탭을 렌더링한다.
 * 'all' 탭은 항상 표시하고, 나머지는 availableCategories에 포함된 것만 표시한다.
 * 활성 탭 하단에 brand 색상 2px bar 인디케이터를 표시한다.
 */
export function CategoryTabs({
  activeCategory,
  onCategoryChange,
  locale,
  availableCategories,
}: CategoryTabsProps) {
  /** 표시할 탭 목록 — 'all' 고정 선행 + 존재하는 카테고리만 */
  const visibleTabs = CATEGORY_CATALOG.filter(({ value }) =>
    availableCategories.has(value),
  );

  return (
    <div role="tablist" aria-label={t(locale, 'categoryAll')} className="flex gap-1 border-b border-border">
      {/* 전체 탭 — 항상 표시 */}
      <button
        role="tab"
        aria-selected={activeCategory === 'all'}
        tabIndex={activeCategory === 'all' ? 0 : -1}
        onClick={() => onCategoryChange('all')}
        className={[
          'relative px-4 py-2.5 text-sm font-medium transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
          activeCategory === 'all'
            ? 'text-brand'
            : 'text-text-muted hover:text-text',
        ].join(' ')}
      >
        {t(locale, 'categoryAll')}
        {activeCategory === 'all' && (
          <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 bg-brand" />
        )}
      </button>

      {/* 존재하는 카테고리 탭만 렌더 */}
      {visibleTabs.map(({ value, labelKey }) => {
        const isActive = activeCategory === value;
        return (
          <button
            key={value}
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onCategoryChange(value)}
            className={[
              'relative px-4 py-2.5 text-sm font-medium transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
              isActive
                ? 'text-brand'
                : 'text-text-muted hover:text-text',
            ].join(' ')}
          >
            {t(locale, labelKey)}
            {/* 활성 탭 하단 인디케이터 — 2px brand bar */}
            {isActive && (
              <span
                aria-hidden="true"
                className="absolute inset-x-0 bottom-0 h-0.5 bg-brand"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
