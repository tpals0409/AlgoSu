/**
 * @file       category-tabs.tsx
 * @domain     blog
 * @layer      ui
 * @related    src/lib/i18n.ts, src/lib/posts.ts, src/components/home-page.tsx
 *
 * 토스 스타일 수평 카테고리 탭 — 활성 탭 하단에 brand 2px bar 인디케이터.
 * 전체 / 성장 여정 / 문제 해결 3개 탭을 렌더링한다.
 */
'use client';

import type { Category } from '@/lib/posts';
import type { Locale } from '@/lib/i18n';
import { t } from '@/lib/i18n';

/** 탭 항목 정의 — value와 i18n 사전 키를 연결한다. */
const TAB_ITEMS: readonly { value: Category | 'all'; labelKey: 'categoryAll' | 'categoryJourney' | 'categoryChallenge' }[] = [
  { value: 'all', labelKey: 'categoryAll' },
  { value: 'journey', labelKey: 'categoryJourney' },
  { value: 'challenge', labelKey: 'categoryChallenge' },
] as const;

interface CategoryTabsProps {
  /** 현재 활성 카테고리 */
  activeCategory: Category | 'all';
  /** 탭 변경 콜백 */
  onCategoryChange: (category: Category | 'all') => void;
  /** 현재 locale */
  locale: Locale;
}

/**
 * 수평 카테고리 탭을 렌더링한다.
 * 활성 탭 하단에 brand 색상 2px bar 인디케이터를 표시한다.
 */
export function CategoryTabs({ activeCategory, onCategoryChange, locale }: CategoryTabsProps) {
  return (
    <div role="tablist" aria-label={t(locale, 'categoryAll')} className="flex gap-1 border-b border-border">
      {TAB_ITEMS.map(({ value, labelKey }) => {
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
