/**
 * @file       start-here-section.tsx
 * @domain     blog
 * @layer      ui
 * @related    src/lib/posts.ts, src/lib/site-content.ts, src/lib/i18n.ts
 *
 * 홈 StartHere 섹션 — 첫 방문자가 전체 목록 없이 대표 글로 진입하도록 큐레이션.
 * 추천 슬러그(site-content)로 글 메타를 조회하고 "왜 읽어야 하나" 한 줄을 곁들인다.
 * Server Component — getAllPosts(locale)로 locale별 제목 조회.
 */
import type { Locale } from '@/lib/i18n';
import { t } from '@/lib/i18n';
import type { PostMeta } from '@/lib/posts';
import { getAllPosts } from '@/lib/posts';
import { START_HERE_POSTS } from '@/lib/site-content';

interface StartHereSectionProps {
  locale: Locale;
  /** locale별 링크 기준 경로 (en: '/en', ko: ''). */
  basePath: string;
}

/** 추천 글 1종(메타 + why-read). */
interface ResolvedStartHere {
  post: PostMeta;
  why: string;
}

/** 공통 focus ring. */
const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface';

/** StartHere 섹션을 렌더링한다. 해석된 추천 글이 없으면 렌더링하지 않는다. */
export function StartHereSection({ locale, basePath }: StartHereSectionProps) {
  const all = getAllPosts(locale);
  const items = START_HERE_POSTS.map((s): ResolvedStartHere | null => {
    const post = all.find((p) => p.slug === s.slug);
    return post ? { post, why: t(locale, s.whyKey) } : null;
  }).filter((x): x is ResolvedStartHere => x !== null);

  if (items.length === 0) return null;

  return (
    <section id="start-here" className="scroll-mt-24">
      <h2 className="font-heading text-xl font-bold tracking-tight text-text">
        {t(locale, 'startHereTitle')}
      </h2>
      <p className="mt-1.5 text-sm text-text-muted">{t(locale, 'startHereSubtitle')}</p>

      <ol className="mt-5 grid gap-3 sm:grid-cols-2">
        {items.map(({ post, why }, i) => (
          <li key={post.slug}>
            <a
              href={`${basePath}/posts/${post.slug}`}
              className={`group flex h-full gap-4 rounded-card border border-border bg-surface-elevated p-5 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-brand hover:shadow-lift ${FOCUS_RING}`}
            >
              <span
                aria-hidden
                className="font-heading text-lg font-bold tabular-nums text-brand"
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="min-w-0">
                <span className="block font-semibold leading-snug text-text transition-colors group-hover:text-brand line-clamp-2">
                  {post.title}
                </span>
                <span className="mt-1 block text-sm leading-relaxed text-text-muted line-clamp-2">
                  {why}
                </span>
              </span>
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}
