import { notFound } from 'next/navigation';
import { getAllSprints, getSprintByNumber } from '@/lib/posts';
import { renderMdx } from '@/lib/mdx';

export const dynamicParams = false;

export function generateStaticParams() {
  const sprints = getAllSprints();
  if (sprints.length === 0) {
    return [{ num: '_placeholder' }];
  }
  return sprints.map((s) => ({ num: String(s.number) }));
}

export default async function SprintPage({ params }: { params: Promise<{ num: string }> }) {
  const { num } = await params;
  if (num === '_placeholder') notFound();

  const n = parseInt(num, 10);
  const sprint = getSprintByNumber(n);
  if (!sprint) notFound();

  const content = await renderMdx(sprint.content);

  return (
    <article>
      <header className="mb-8">
        <h1 className="mb-2 text-3xl font-bold">
          Sprint {sprint.meta.number}: {sprint.meta.title}
        </h1>
        <time className="text-sm text-gray-500">{sprint.meta.date}</time>
      </header>
      <div className="prose prose-gray dark:prose-invert max-w-none">
        {content}
      </div>
    </article>
  );
}
