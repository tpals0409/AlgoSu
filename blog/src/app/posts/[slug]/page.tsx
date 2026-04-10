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
    </article>
  );
}
