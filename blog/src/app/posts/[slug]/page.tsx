import { notFound } from 'next/navigation';
import { getAllPosts, getPostBySlug } from '@/lib/posts';
import { renderMdx } from '@/lib/mdx';

interface Props {
  params: Promise<{ slug: string }>;
}

export const dynamicParams = false;

export async function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

export default async function PostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const content = await renderMdx(post.content);

  // 포스트 네비게이션 — getAllPosts()는 최신순 정렬이므로
  // index-1 이 더 최신(다음 글), index+1 이 더 오래된 글(이전 글).
  const posts = getAllPosts();
  const currentIndex = posts.findIndex((p) => p.slug === slug);
  const newerPost = currentIndex > 0 ? posts[currentIndex - 1] : null;
  const olderPost =
    currentIndex >= 0 && currentIndex < posts.length - 1
      ? posts[currentIndex + 1]
      : null;

  return (
    <article>
      <header className="mb-10 border-b border-border pb-8">
        <h1 className="mb-4 text-4xl font-bold leading-tight tracking-tight">
          {post.meta.title}
        </h1>
        <time className="text-sm text-text-muted">{post.meta.date}</time>
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
      <div className="prose prose-gray dark:prose-invert max-w-none">
        {content}
      </div>

      {/* 포스트 네비게이션 — 블로그 홈 + 이전/다음 글 */}
      <nav
        aria-label="포스트 네비게이션"
        className="mt-16 border-t border-border pt-8"
      >
        <a
          href="/"
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-text-muted hover:text-brand"
        >
          <span aria-hidden>←</span>
          <span>블로그 홈</span>
        </a>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {newerPost ? (
            <a
              href={`/posts/${newerPost.slug}`}
              aria-label="더 최신 포스트"
              className="group block rounded-lg border border-border bg-surface p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brand hover:shadow-md focus-visible:outline-none"
            >
              <span className="block text-xs font-medium uppercase tracking-wide text-text-subtle">
                ← 새 글
              </span>
              <span className="mt-2 block text-base font-semibold leading-snug text-text transition-colors group-hover:text-brand">
                {newerPost.title}
              </span>
              <time className="mt-2 block text-xs text-text-muted">
                {newerPost.date}
              </time>
            </a>
          ) : (
            <div aria-hidden className="hidden sm:block" />
          )}
          {olderPost ? (
            <a
              href={`/posts/${olderPost.slug}`}
              aria-label="이전 포스트"
              className="group block rounded-lg border border-border bg-surface p-5 text-right shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brand hover:shadow-md focus-visible:outline-none"
            >
              <span className="block text-xs font-medium uppercase tracking-wide text-text-subtle">
                지난 글 →
              </span>
              <span className="mt-2 block text-base font-semibold leading-snug text-text transition-colors group-hover:text-brand">
                {olderPost.title}
              </span>
              <time className="mt-2 block text-xs text-text-muted">
                {olderPost.date}
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
