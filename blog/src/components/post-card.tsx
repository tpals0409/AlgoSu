/**
 * @file       post-card.tsx
 * @domain     blog
 * @layer      ui
 * @related    src/components/home-page.tsx
 *
 * 포스트 목록에서 단일 포스트를 카드 형태로 표시하는 컴포넌트.
 */

interface PostCardProps {
  slug: string;
  title: string;
  date: string;
  excerpt: string;
  tags: string[];
  basePath?: string;
}

/** 포스트 카드 링크를 렌더링한다. */
export function PostCard({ slug, title, date, excerpt, tags, basePath = '' }: PostCardProps) {
  return (
    <a
      href={`${basePath}/posts/${slug}`}
      className="group block rounded-lg border border-border bg-surface p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brand hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
    >
      <time className="mb-2 block text-xs font-medium uppercase tracking-wide text-text-subtle">
        {date}
      </time>
      <h2 className="mb-3 text-xl font-bold leading-snug transition-colors group-hover:text-brand">
        {title}
      </h2>
      {excerpt && (
        <p className="line-clamp-2 text-sm leading-relaxed text-text-muted">
          {excerpt}
        </p>
      )}
      {tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-brand"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </a>
  );
}
