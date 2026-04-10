interface PostCardProps {
  slug: string;
  title: string;
  date: string;
  excerpt: string;
  tags: string[];
}

export function PostCard({ slug, title, date, excerpt, tags }: PostCardProps) {
  return (
    <a
      href={`/posts/${slug}`}
      className="block rounded-lg border border-border p-5 transition hover:border-brand"
    >
      <h2 className="mb-1 text-lg font-semibold">{title}</h2>
      <time className="text-sm text-text-muted">{date}</time>
      {excerpt && <p className="mt-2 text-sm text-text-muted">{excerpt}</p>}
      {tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs text-brand"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </a>
  );
}
