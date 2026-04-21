/**
 * @file       post-page.tsx
 * @domain     blog
 * @layer      ui
 * @related    src/lib/i18n.ts, src/lib/posts.ts, src/lib/mdx.ts
 *
 * 단일 포스트 상세 페이지의 공유 UI — locale에 따라 네비게이션 문자열을 분기한다.
 */
import { notFound } from 'next/navigation';
import type { Locale } from '@/lib/i18n';
import { t, getBasePath } from '@/lib/i18n';
import { getAllPosts, getPostBySlug, getSeriesPosts } from '@/lib/posts';
import { renderMdx } from '@/lib/mdx';

interface PostPageProps {
  locale: Locale;
  slug: string;
}

/** locale별 단일 포스트 상세 페이지를 렌더링한다. */
export async function PostPage({ locale, slug }: PostPageProps) {
  const post = getPostBySlug(slug, locale);
  if (!post) notFound();

  const content = await renderMdx(post.content);
  const basePath = getBasePath(locale);

  const posts = getAllPosts(locale);
  const currentIndex = posts.findIndex((p) => p.slug === slug);
  const newerPost = currentIndex > 0 ? posts[currentIndex - 1] : null;
  const olderPost =
    currentIndex >= 0 && currentIndex < posts.length - 1
      ? posts[currentIndex + 1]
      : null;

  // 시리즈 네비게이션
  const seriesPosts = post.meta.series
    ? getSeriesPosts(post.meta.series, locale)
    : [];
  const seriesIndex = seriesPosts.findIndex((p) => p.slug === slug);
  const prevInSeries = seriesIndex > 0 ? seriesPosts[seriesIndex - 1] : null;
  const nextInSeries = seriesIndex >= 0 && seriesIndex < seriesPosts.length - 1
    ? seriesPosts[seriesIndex + 1]
    : null;

  return (
    <article>
      <header className="mb-10 border-b border-border pb-8">
        <h1 className="mb-4 text-4xl font-bold leading-tight tracking-tight">
          {post.meta.title}
        </h1>
        <time dateTime={post.meta.date} className="text-sm text-text-muted">{post.meta.date}</time>
        {post.meta.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-3">
            {post.meta.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-brand"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </header>
      <div className="prose prose-gray max-w-none">
        {content}
      </div>

      {seriesPosts.length > 1 && (
        <aside className="mt-12 rounded-lg border border-border bg-surface p-5">
          <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-3">
            {post.meta.series} 시리즈
          </h3>
          <ol className="space-y-1.5 text-sm">
            {seriesPosts.map((sp, i) => (
              <li key={sp.slug}>
                {sp.slug === slug ? (
                  <span className="font-medium text-brand">
                    {i + 1}. {sp.title}
                  </span>
                ) : (
                  <a
                    href={`${basePath}/posts/${sp.slug}`}
                    className="text-text-muted hover:text-brand transition-colors"
                  >
                    {i + 1}. {sp.title}
                  </a>
                )}
              </li>
            ))}
          </ol>
          {(prevInSeries || nextInSeries) && (
            <div className="mt-4 flex justify-between text-xs">
              {prevInSeries ? (
                <a href={`${basePath}/posts/${prevInSeries.slug}`} className="text-brand hover:underline">
                  &larr; {prevInSeries.title}
                </a>
              ) : <span />}
              {nextInSeries ? (
                <a href={`${basePath}/posts/${nextInSeries.slug}`} className="text-brand hover:underline">
                  {nextInSeries.title} &rarr;
                </a>
              ) : <span />}
            </div>
          )}
        </aside>
      )}

      <nav
        aria-label={t(locale, 'navPostLabel')}
        className="mt-16 border-t border-border pt-8"
      >
        <a
          href={basePath || '/'}
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-text-muted hover:text-brand"
        >
          <span aria-hidden>&larr;</span>
          <span>{t(locale, 'blogHome')}</span>
        </a>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {olderPost ? (
            <a
              href={`${basePath}/posts/${olderPost.slug}`}
              aria-label={t(locale, 'olderPost')}
              className="group block rounded-lg border border-border bg-surface p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brand hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            >
              <span className="block text-xs font-medium uppercase tracking-wide text-text-subtle">
                {t(locale, 'olderPost')}
              </span>
              <span className="mt-2 block text-base font-semibold leading-snug text-text transition-colors group-hover:text-brand">
                {olderPost.title}
              </span>
              <time dateTime={olderPost.date} className="mt-2 block text-xs text-text-muted">
                {olderPost.date}
              </time>
            </a>
          ) : (
            <div aria-hidden className="hidden sm:block" />
          )}
          {newerPost ? (
            <a
              href={`${basePath}/posts/${newerPost.slug}`}
              aria-label={t(locale, 'newerPost')}
              className="group block rounded-lg border border-border bg-surface p-5 text-right shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brand hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            >
              <span className="block text-xs font-medium uppercase tracking-wide text-text-subtle">
                {t(locale, 'newerPost')}
              </span>
              <span className="mt-2 block text-base font-semibold leading-snug text-text transition-colors group-hover:text-brand">
                {newerPost.title}
              </span>
              <time dateTime={newerPost.date} className="mt-2 block text-xs text-text-muted">
                {newerPost.date}
              </time>
            </a>
          ) : (
            <div aria-hidden className="hidden sm:block" />
          )}
        </div>
      </nav>
    </article>
  );
}
