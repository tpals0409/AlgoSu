/**
 * @file       post-card.tsx
 * @domain     blog
 * @layer      ui
 * @related    src/components/home-page.tsx, src/components/post-list-with-filter.tsx
 *
 * 포스트 목록에서 단일 포스트를 카드 형태로 표시하는 컴포넌트.
 * 날짜 옆 카테고리 뱃지(journey/challenge)를 렌더링한다.
 */
import type { Category } from '@/lib/posts';
import type { Locale } from '@/lib/i18n';
import { t } from '@/lib/i18n';

/**
 * 카테고리별 뱃지 Tailwind 클래스 맵.
 * 완전한 문자열로 정의 — 동적 조합 시 Tailwind 퍼징 누락 방지.
 */
const CATEGORY_BADGE_CLASS: Record<Category, string> = {
  journey: 'bg-brand-soft text-brand',
  challenge: 'bg-amber-50 text-amber-700',
};

/**
 * 카테고리별 뱃지 레이블 i18n 키 맵.
 * t() 호출을 카드 내부에서 결정론적으로 선택한다.
 */
const CATEGORY_LABEL_KEY: Record<Category, 'categoryJourney' | 'categoryChallenge'> = {
  journey: 'categoryJourney',
  challenge: 'categoryChallenge',
};

interface PostCardProps {
  slug: string;
  title: string;
  date: string;
  excerpt: string;
  tags: string[];
  /** 포스트 카테고리 — 뱃지 색상/레이블에 사용 */
  category: Category;
  /** 현재 locale — 뱃지 레이블 현지화에 사용 */
  locale: Locale;
  basePath?: string;
}

/** 포스트 카드 링크를 렌더링한다. */
export function PostCard({
  slug,
  title,
  date,
  excerpt,
  tags,
  category,
  locale,
  basePath = '',
}: PostCardProps) {
  const badgeClass = CATEGORY_BADGE_CLASS[category];
  const badgeLabel = t(locale, CATEGORY_LABEL_KEY[category]);

  return (
    <a
      href={`${basePath}/posts/${slug}`}
      className="group block rounded-lg border border-border bg-surface p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brand hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
    >
      {/* 날짜 + 카테고리 뱃지 행 */}
      <div className="mb-2 flex items-center gap-2">
        <time dateTime={date} className="block text-xs font-medium uppercase tracking-wide text-text-subtle">
          {date}
        </time>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeClass}`}>
          {badgeLabel}
        </span>
      </div>

      <h2 className="mb-3 text-xl font-bold leading-snug transition-colors group-hover:text-brand">
        {title}
      </h2>

      {excerpt && (
        <p className="line-clamp-2 text-sm leading-relaxed text-text-muted">
          {excerpt}
        </p>
      )}

      {tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-brand"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </a>
  );
}
