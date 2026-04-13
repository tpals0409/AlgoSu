/**
 * @file       page.tsx
 * @domain     blog
 * @layer      app
 * @related    src/components/post-page.tsx, src/lib/posts.ts
 *
 * 영어 단일 포스트 — /en/posts/:slug 경로.
 */
import { PostPage } from '@/components/post-page';
import { getAllPosts } from '@/lib/posts';

interface Props {
  params: Promise<{ slug: string }>;
}

export const dynamicParams = false;

/** 빌드 시 영어 포스트 slug 목록을 생성한다. */
export async function generateStaticParams() {
  return getAllPosts('en').map((p) => ({ slug: p.slug }));
}

export default async function EnPostPage({ params }: Props) {
  const { slug } = await params;
  return <PostPage locale="en" slug={slug} />;
}
