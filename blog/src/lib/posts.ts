/**
 * @file       posts.ts
 * @domain     blog
 * @layer      lib
 * @related    src/lib/i18n.ts, content/posts/, content/posts-en/
 *
 * MDX 포스트 파일시스템 읽기 — locale별 콘텐츠 디렉토리 분기.
 * Category union type: 'journey' (성장/여정) | 'challenge' (문제해결/삽질)
 */
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import type { Locale } from '@/lib/i18n';

/** 포스트 분류 카테고리 — 2분류 체계 */
export type Category = 'journey' | 'challenge';

/** 유효한 Category 값 집합 — 타입 가드에 활용 */
const VALID_CATEGORIES: ReadonlySet<string> = new Set<Category>(['journey', 'challenge']);

/**
 * frontmatter의 category 값을 안전하게 파싱한다.
 * 유효하지 않은 값은 fallback('journey')으로 치환한다.
 */
function parseCategory(raw: unknown): Category {
  if (typeof raw === 'string' && VALID_CATEGORIES.has(raw)) {
    return raw as Category;
  }
  return 'journey';
}

const CONTENT_DIR = path.join(process.cwd(), 'content');

/** Locale에 대응하는 콘텐츠 하위 디렉토리. */
const LOCALE_SUBDIR: Record<Locale, string> = {
  ko: 'posts',
  en: 'posts-en',
};

export interface PostMeta {
  slug: string;
  title: string;
  date: string;
  excerpt: string;
  tags: string[];
  /** 포스트 카테고리 — 성장 여정(journey) 또는 문제 해결(challenge) */
  category: Category;
  source?: string;
  // 동일 date 내에서 표시 순서를 결정하는 보조 필드.
  // 값이 클수록 최신(상단). 누락 시 slug 알파벳순 결정적 정렬.
  order?: number;
  /** 시리즈 이름 — 같은 시리즈의 포스트를 그룹화 */
  series?: string;
  /** 시리즈 내 순서 (1-based) — 누락 시 date 기반 자동 정렬 */
  seriesOrder?: number;
}

/**
 * 지정 디렉토리 내 모든 .mdx 파일을 읽어 파싱 결과를 반환한다.
 * @param dir - 대상 디렉토리 절대 경로
 */
function readMdxFiles(
  dir: string,
): { slug: string; content: string; data: Record<string, unknown> }[] {
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

/**
 * 지정 locale의 전체 포스트 목록을 최신순으로 반환한다.
 *
 * 정렬 우선순위:
 * 1. date 내림차순 (최신 먼저)
 * 2. 동일 date 내 — order 명시 포스트가 상단 (order desc)
 * 3. order 미명시 포스트끼리는 slug 알파벳순 (결정적 보조 정렬)
 *
 * @param locale - 대상 언어 (기본값: 'ko')
 */
export function getAllPosts(locale: Locale = 'ko'): PostMeta[] {
  const subdir = LOCALE_SUBDIR[locale];
  const files = readMdxFiles(path.join(CONTENT_DIR, subdir));
  return files
    .map(({ slug, data }) => ({
      slug,
      title: (data.title as string) ?? slug,
      date: (data.date as string) ?? '',
      excerpt: (data.excerpt as string) ?? '',
      tags: (data.tags as string[]) ?? [],
      category: parseCategory(data.category),
      source: data.source as string | undefined,
      order: typeof data.order === 'number' ? (data.order as number) : undefined,
      series: typeof data.series === 'string' ? data.series : undefined,
      seriesOrder: typeof data.seriesOrder === 'number' ? data.seriesOrder : undefined,
    }))
    .sort((a, b) => {
      if (a.date !== b.date) return a.date > b.date ? -1 : 1;
      if (a.order != null && b.order != null) return b.order - a.order;
      if (a.order != null) return -1;
      if (b.order != null) return 1;
      return a.slug.localeCompare(b.slug);
    });
}

/**
 * 특정 시리즈에 속한 포스트를 seriesOrder 오름차순으로 반환한다.
 * @param series - 시리즈 이름
 * @param locale - 대상 언어
 */
export function getSeriesPosts(series: string, locale: Locale = 'ko'): PostMeta[] {
  return getAllPosts(locale)
    .filter((p) => p.series === series)
    .sort((a, b) => (a.seriesOrder ?? 0) - (b.seriesOrder ?? 0));
}

/**
 * slug에 해당하는 단일 포스트를 반환한다.
 * @param slug   - 포스트 슬러그 (파일명에서 .mdx 제외)
 * @param locale - 대상 언어 (기본값: 'ko')
 */
export function getPostBySlug(slug: string, locale: Locale = 'ko') {
  const subdir = LOCALE_SUBDIR[locale];
  const filePath = path.join(CONTENT_DIR, subdir, `${slug}.mdx`);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = matter(raw);
  return { meta: { slug, ...data } as PostMeta, content };
}
