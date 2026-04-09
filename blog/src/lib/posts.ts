import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const CONTENT_DIR = path.join(process.cwd(), 'content');

export interface PostMeta {
  slug: string;
  title: string;
  date: string;
  excerpt: string;
  tags: string[];
  source?: string;
  // 동일 date 내에서 표시 순서를 결정하는 보조 필드.
  // 값이 클수록 최신(상단). 누락 시 0으로 간주.
  order?: number;
}

function readMdxFiles(dir: string): { slug: string; content: string; data: Record<string, unknown> }[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.mdx'))
    .map((filename) => {
      const raw = fs.readFileSync(path.join(dir, filename), 'utf-8');
      const { data, content } = matter(raw);
      return { slug: filename.replace(/\.mdx$/, ''), content, data };
    });
}

export function getAllPosts(): PostMeta[] {
  const files = readMdxFiles(path.join(CONTENT_DIR, 'adr'));
  return files
    .map(({ slug, data }) => ({
      slug,
      title: (data.title as string) ?? slug,
      date: (data.date as string) ?? '',
      excerpt: (data.excerpt as string) ?? '',
      tags: (data.tags as string[]) ?? [],
      source: data.source as string | undefined,
      order: typeof data.order === 'number' ? (data.order as number) : undefined,
    }))
    .sort((a, b) => {
      if (a.date !== b.date) return a.date > b.date ? -1 : 1;
      return (b.order ?? 0) - (a.order ?? 0);
    });
}

export function getPostBySlug(slug: string) {
  const filePath = path.join(CONTENT_DIR, 'adr', `${slug}.mdx`);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = matter(raw);
  return { meta: { slug, ...data } as PostMeta, content };
}

