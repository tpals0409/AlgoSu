/**
 * @file       home-page.tsx
 * @domain     blog
 * @layer      ui
 * @related    src/lib/i18n.ts, src/lib/posts.ts, src/lib/adr/loader.ts,
 *             src/components/home/*, src/components/post-list-with-filter.tsx
 *
 * 블로그 홈 — 테크블로그 인덱스형 (Sprint 266).
 * 컴팩트 Hero → ADR 진입(한 줄) → 글 텍스트 인덱스 순으로 구성한다.
 * Server Component — posts/ADR 데이터를 빌드타임에 로드해 자식에 전달.
 * (ko)/page.tsx·en/page.tsx가 locale prop으로 공유 → KO/EN 동시.
 */
import type { Locale } from '@/lib/i18n';
import { t, getBasePath } from '@/lib/i18n';
import { getAllPosts } from '@/lib/posts';
import { getAllAdrs } from '@/lib/adr/loader';
import { PostListWithFilter } from '@/components/post-list-with-filter';
import { HomeHero } from '@/components/home/home-hero';
import { AdrIntroCard } from '@/components/home/adr-intro-card';

interface HomePageProps {
  locale: Locale;
}

/** locale별 블로그 홈(랜딩)을 렌더링한다. */
export function HomePage({ locale }: HomePageProps) {
  const posts = getAllPosts(locale);
  const basePath = getBasePath(locale);
  // ADR 총 개수는 빌드타임 동적 계산 — 성과 카드/ADR 소개의 stale 수치 차단.
  const adrCount = getAllAdrs().length;

  return (
    <div className="space-y-10 sm:space-y-12">
      <HomeHero
        locale={locale}
        basePath={basePath}
        adrCount={adrCount}
        postCount={posts.length}
      />

      <AdrIntroCard locale={locale} basePath={basePath} adrCount={adrCount} />

      <section>
        <h2 className="mb-5 font-heading text-xl font-bold tracking-tight text-text">
          {t(locale, 'recentPostsTitle')}
        </h2>
        {posts.length === 0 ? (
          <p className="text-text-subtle">{t(locale, 'noPosts')}</p>
        ) : (
          <PostListWithFilter posts={posts} basePath={basePath} locale={locale} />
        )}
      </section>
    </div>
  );
}
