/**
 * @file       page.tsx
 * @domain     blog
 * @layer      app
 * @related    src/components/post-page.tsx, src/lib/posts.ts
 *
 * 한국어 단일 포스트 — /posts/:slug 경로.
 */
import { PostPage } from '@/components/post-page';
import { getAllPosts } from '@/lib/posts';

interface Props {
  params: Promise<{ slug: string }>;
}

export const dynamicParams = false;

/** 빌드 시 한국어 포스트 slug 목록을 생성한다. */
export async function generateStaticParams() {
  return getAllPosts('ko').map((p) => ({ slug: p.slug }));
}

export default async function KoPostPage({ params }: Props) {
  const { slug } = await params;
  return <PostPage locale="ko" slug={slug} />;
}
