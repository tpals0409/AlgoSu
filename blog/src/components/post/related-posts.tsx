/**
 * @file       related-posts.tsx
 * @domain     blog
 * @layer      ui
 * @related    src/components/post-page.tsx, src/lib/posts.ts
 *
 * 글 하단 "관련 글" 섹션 — 같은 시리즈/공유 태그 기반 추천 글을 카드로 렌더한다.
 * 선택 로직은 getRelatedPosts(posts.ts)에서 수행하고 여기서는 표시만 담당한다.
 */
import type { PostMeta } from '@/lib/posts';
import { type Locale, t, getBasePath } from '@/lib/i18n';

interface RelatedPostsProps {
  /** getRelatedPosts로 선별된 추천 글 목록. */
  posts: PostMeta[];
  locale: Locale;
}

/** 공통 focus ring (키보드 접근성). */
const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface';

/** 글의 관련 글 섹션을 렌더한다. 추천 글이 없으면 렌더하지 않는다. */
export function RelatedPosts({ posts, locale }: RelatedPostsProps) {
  if (posts.length === 0) return null;
  const basePath = getBasePath(locale);

  return (
    <section className="mt-12 border-t border-border pt-8">
      <h2 className="font-heading text-lg font-semibold text-text">
        {t(locale, 'relatedPostsTitle')}
      </h2>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <a
            key={post.slug}
            href={`${basePath}/posts/${post.slug}`}
            className={`group flex flex-col rounded-card border border-border bg-surface-elevated p-5 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-brand hover:shadow-lift ${FOCUS_RING}`}
          >
            <h3 className="font-heading text-base font-semibold leading-snug text-text transition-colors group-hover:text-brand">
              {post.title}
            </h3>
            <time dateTime={post.date} className="mt-2 block text-xs text-text-muted">
              {post.date}
            </time>
          </a>
        ))}
      </div>
    </section>
  );
}
