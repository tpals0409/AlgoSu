/**
 * @file       home-page.tsx
 * @domain     blog
 * @layer      ui
 * @related    src/lib/i18n.ts, src/lib/posts.ts, src/components/post-card.tsx
 *
 * 블로그 홈 페이지의 공유 UI — locale에 따라 문자열과 포스트 목록을 분기한다.
 */
import type { Locale } from '@/lib/i18n';
import { t, getBasePath } from '@/lib/i18n';
import { getAllPosts } from '@/lib/posts';
import { PostCard } from '@/components/post-card';

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
        <ul className="space-y-6">
          {posts.map((post) => (
            <li key={post.slug}>
              <PostCard {...post} basePath={basePath} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
