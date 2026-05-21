/**
 * @file       post-list-with-filter.tsx
 * @domain     blog
 * @layer      ui
 * @related    src/components/category-tabs.tsx, src/components/post-card.tsx,
 *             src/components/home-page.tsx, src/lib/posts.ts
 *
 * 카테고리 탭 필터 + 포스트 목록을 결합한 Client Component.
 * HomePage(Server)로부터 posts[]를 받아 클라이언트 측 필터 상태를 관리한다.
 */
'use client';

import { useMemo, useState } from 'react';
import type { Category, PostMeta } from '@/lib/posts';
import type { Locale } from '@/lib/i18n';
import { t } from '@/lib/i18n';
import { CategoryTabs } from '@/components/category-tabs';
import { PostCard } from '@/components/post-card';

interface PostListWithFilterProps {
  /** 서버에서 사전 로드된 전체 포스트 목록 */
  posts: PostMeta[];
  /** locale별 링크 기준 경로 (en: '/en', ko: '') */
  basePath: string;
  /** 현재 locale — 탭/뱃지 레이블 현지화에 사용 */
  locale: Locale;
}

/**
 * 카테고리 탭 필터와 포스트 카드 목록을 렌더링한다.
 * 활성 카테고리가 'all'이면 전체 포스트를, 아니면 해당 카테고리만 표시한다.
 * posts 배열에서 사용 중인 카테고리만 탭에 표시한다(graceful skip).
 */
export function PostListWithFilter({ posts, basePath, locale }: PostListWithFilterProps) {
  const [activeCategory, setActiveCategory] = useState<Category | 'all'>('all');

  /** 글이 1편 이상 존재하는 카테고리 집합 — 탭 표시 여부 결정에 사용 */
  const availableCategories = useMemo(
    () => new Set(posts.map((p) => p.category)),
    [posts],
  );

  const filteredPosts =
    activeCategory === 'all'
      ? posts
      : posts.filter((post) => post.category === activeCategory);

  return (
    <div>
      <div className="mb-6">
        <CategoryTabs
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
          locale={locale}
          availableCategories={availableCategories}
        />
      </div>

      {filteredPosts.length === 0 ? (
        <p className="text-text-subtle">{t(locale, 'noPosts')}</p>
      ) : (
        <ul className="space-y-6">
          {filteredPosts.map((post) => (
            <li key={post.slug}>
              <PostCard {...post} basePath={basePath} locale={locale} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
