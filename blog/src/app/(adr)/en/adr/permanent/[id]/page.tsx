/**
 * @file       page.tsx
 * @domain     blog / adr
 * @layer      app
 * @related    src/app/(adr)/adr/permanent/[id]/page.tsx, src/components/adr/adr-detail-view.tsx
 *
 * 영구 ADR 상세 페이지 (영문) — /en/adr/permanent/:id 경로.
 */
import { notFound } from 'next/navigation';
import { getAllAdrs } from '@/lib/adr/loader';
import { buildAdrIndex, getSubgraph } from '@/lib/adr/index-builder';
import { AdrDetailView } from '@/components/adr/adr-detail-view';

interface Props {
  params: Promise<{ id: string }>;
}

export const dynamicParams = false;

/** 빌드 시 영구 ADR id 목록을 생성한다. */
export async function generateStaticParams() {
  return getAllAdrs()
    .filter((d) => d.meta.kind === 'permanent')
    .map((d) => ({ id: d.meta.slug }));
}

/** 영문 영구 ADR 상세 페이지를 렌더링한다. */
export default async function EnPermanentDetailPage({ params }: Props) {
  const { id } = await params;
  const docs = getAllAdrs();
  const doc = docs.find(
    (d) => d.meta.kind === 'permanent' && d.meta.slug === id,
  );

  if (!doc) notFound();

  const fullGraph = buildAdrIndex(docs).graph;
  const miniGraph = getSubgraph(fullGraph, doc.meta.id);

  return <AdrDetailView doc={doc} miniGraph={miniGraph} locale="en" />;
}
