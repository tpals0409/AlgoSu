/**
 * @file       home-page.tsx
 * @domain     blog
 * @layer      ui
 * @related    src/lib/i18n.ts, src/lib/posts.ts,
 *             src/components/post-list-with-filter.tsx
 *
 * 블로그 홈 페이지의 공유 UI — Server Component.
 * getAllPosts()를 서버에서 호출한 뒤 PostListWithFilter(Client)에 전달한다.
 */
import type { Locale } from '@/lib/i18n';
import { t, getBasePath } from '@/lib/i18n';
import { getAllPosts } from '@/lib/posts';
import { PostListWithFilter } from '@/components/post-list-with-filter';

interface HomePageProps {
  locale: Locale;
}

/** locale별 블로그 홈 페이지를 렌더링한다. */
export function HomePage({ locale }: HomePageProps) {
  const posts = getAllPosts(locale);
  const basePath = getBasePath(locale);
  const adrHref = `${basePath}/adr/`;

  return (
    <div>
      <h1 className="mb-2 text-3xl font-bold">{t(locale, 'siteTitle')}</h1>
      <p className="mb-6 text-text-muted">{t(locale, 'siteDescription')}</p>

      {/* ADR 진입 CTA — Sprint 157. 블로그 글은 ADR을 인용하므로 SSOT로 안내. */}
      <a
        href={adrHref}
        className="mb-8 block rounded-lg border border-border bg-surface-elevated p-5 transition-shadow hover:shadow-md"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="mb-1 text-lg font-semibold text-text">
              {t(locale, 'homeAdrCtaTitle')}
            </h2>
            <p className="text-sm text-text-muted">
              {t(locale, 'homeAdrCtaDescription')}
            </p>
          </div>
          <span className="shrink-0 self-center text-sm font-medium text-brand">
            {t(locale, 'homeAdrCtaButton')}
          </span>
        </div>
      </a>

      {posts.length === 0 ? (
        <p className="text-text-subtle">{t(locale, 'noPosts')}</p>
      ) : (
        <PostListWithFilter posts={posts} basePath={basePath} locale={locale} />
      )}
    </div>
  );
}
