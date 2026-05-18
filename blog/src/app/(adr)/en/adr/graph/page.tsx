/**
 * @file       page.tsx
 * @domain     blog / adr
 * @layer      app
 * @related    src/app/(adr)/adr/graph/page.tsx, src/components/adr/adr-graph-view.tsx
 *
 * ADR 그래프 풀스크린 페이지 (영문) — /en/adr/graph/ 경로.
 */
import { getAllAdrs } from '@/lib/adr/loader';
import { buildAdrIndex } from '@/lib/adr/index-builder';
import { t } from '@/lib/i18n';
import { AdrGraphView } from '@/components/adr/adr-graph-view';

/** 그래프 페이지 메타데이터(영문)를 생성한다. */
export function generateMetadata() {
  return {
    title: `${t('en', 'graphPageTitle')} — AlgoSu`,
    description: t('en', 'graphMetaDescription'),
  };
}

/** 영문 ADR 그래프 풀스크린 페이지를 렌더링한다. */
export default function EnAdrGraphPage() {
  const docs = getAllAdrs('en');
  const index = buildAdrIndex(docs);

  return <AdrGraphView adjacency={index.graph} locale="en" />;
}
