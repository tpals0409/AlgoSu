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

  return (
    <div>
      <h1 className="mb-2 text-3xl font-bold">{t(locale, 'siteTitle')}</h1>
      <p className="mb-6 text-text-muted">{t(locale, 'siteDescription')}</p>

      {posts.length === 0 ? (
        <p className="text-text-subtle">{t(locale, 'noPosts')}</p>
      ) : (
        <PostListWithFilter posts={posts} basePath={basePath} locale={locale} />
      )}
    </div>
  );
}
