/**
 * @file       page.tsx
 * @domain     blog / adr
 * @layer      app
 * @related    src/app/(adr)/adr/topics/[slug]/page.tsx, src/components/adr/adr-detail-view.tsx
 *
 * 토픽 ADR 상세 페이지 (영문) — /en/adr/topics/:slug 경로.
 */
import { notFound } from 'next/navigation';
import { getAllAdrs } from '@/lib/adr/loader';
import { buildAdrIndex, getSubgraph } from '@/lib/adr/index-builder';
import { AdrDetailView } from '@/components/adr/adr-detail-view';

interface Props {
  params: Promise<{ slug: string }>;
}

export const dynamicParams = false;

/** 빌드 시 토픽 ADR slug 목록을 생성한다. */
export async function generateStaticParams() {
  return getAllAdrs()
    .filter((d) => d.meta.kind === 'topic')
    .map((d) => ({ slug: d.meta.slug }));
}

/** 영문 토픽 ADR 상세 페이지를 렌더링한다. */
export default async function EnTopicDetailPage({ params }: Props) {
  const { slug } = await params;
  const docs = getAllAdrs();
  const doc = docs.find(
    (d) => d.meta.kind === 'topic' && d.meta.slug === slug,
  );

  if (!doc) notFound();

  const fullGraph = buildAdrIndex(docs).graph;
  const miniGraph = getSubgraph(fullGraph, doc.meta.id);

  return <AdrDetailView doc={doc} miniGraph={miniGraph} locale="en" />;
}
