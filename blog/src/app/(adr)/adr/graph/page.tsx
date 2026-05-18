/**
 * @file       page.tsx
 * @domain     blog / adr
 * @layer      app
 * @related    src/lib/adr/loader.ts, src/components/adr/adr-graph-view.tsx
 *
 * ADR 그래프 풀스크린 페이지 — /adr/graph/ 경로 (한국어).
 * 서버에서 AdjacencyList를 빌드하여 클라이언트 그래프로 전달한다.
 */
import { getAllAdrs } from '@/lib/adr/loader';
import { buildAdrIndex } from '@/lib/adr/index-builder';
import { t } from '@/lib/i18n';
import { AdrGraphView } from '@/components/adr/adr-graph-view';

/** 그래프 페이지 메타데이터를 생성한다. */
export function generateMetadata() {
  return {
    title: `${t('ko', 'graphPageTitle')} — AlgoSu`,
    description: t('ko', 'graphMetaDescription'),
  };
}

/** ADR 그래프 풀스크린 페이지를 렌더링한다. */
export default function AdrGraphPage() {
  const docs = getAllAdrs();
  const index = buildAdrIndex(docs);

  return <AdrGraphView adjacency={index.graph} locale="ko" />;
}
