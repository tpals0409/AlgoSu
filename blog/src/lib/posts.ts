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
}

export interface SprintMeta {
  number: number;
  title: string;
  date: string;
  status: string;
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
    }))
    .sort((a, b) => (a.date > b.date ? -1 : 1));
}

export function getPostBySlug(slug: string) {
  const filePath = path.join(CONTENT_DIR, 'adr', `${slug}.mdx`);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = matter(raw);
  return { meta: { slug, ...data } as PostMeta, content };
}

export function getAllSprints(): SprintMeta[] {
  const files = readMdxFiles(path.join(CONTENT_DIR, 'sprints'));
  return files
    .map(({ data }) => ({
      number: (data.sprint as number) ?? 0,
      title: (data.title as string) ?? '',
      date: (data.date as string) ?? '',
      status: (data.status as string) ?? '',
    }))
    .sort((a, b) => b.number - a.number);
}

export function getSprintByNumber(num: number) {
  const filePath = path.join(CONTENT_DIR, 'sprints', `sprint-${num}.mdx`);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = matter(raw);
  return { meta: { number: num, ...data } as SprintMeta, content };
}
