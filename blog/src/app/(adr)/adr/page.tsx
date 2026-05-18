/**
 * @file       page.tsx
 * @domain     blog / adr
 * @layer      app
 * @related    src/lib/adr/loader.ts, src/components/adr/adr-index-view.tsx
 *
 * ADR 인덱스 페이지 — /adr 경로.
 */
import { getAllAdrs } from '@/lib/adr/loader';
import { buildAdrIndex } from '@/lib/adr/index-builder';
import { AdrIndexView } from '@/components/adr/adr-index-view';

/** ADR 인덱스 페이지를 렌더링한다. */
export default function AdrIndexPage() {
  const docs = getAllAdrs();
  const index = buildAdrIndex(docs);

  return <AdrIndexView index={index} />;
}
