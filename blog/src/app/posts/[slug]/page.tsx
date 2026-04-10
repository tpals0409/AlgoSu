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
      <header className="mb-8">
        <h1 className="mb-2 text-3xl font-bold">{post.meta.title}</h1>
        <time className="text-sm text-text-muted">{post.meta.date}</time>
        {post.meta.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {post.meta.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-brand-soft px-3 py-0.5 text-xs text-brand"
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
