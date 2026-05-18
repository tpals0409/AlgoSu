/**
 * @file       page.tsx
 * @domain     blog / adr
 * @layer      app
 * @related    src/app/(adr)/adr/page.tsx, src/components/adr/adr-index-view.tsx
 *
 * ADR 인덱스 페이지 (영문) — /en/adr 경로. locale='en' 으로 view 렌더.
 */
import { getAllAdrs } from '@/lib/adr/loader';
import { buildAdrIndex } from '@/lib/adr/index-builder';
import { AdrIndexView } from '@/components/adr/adr-index-view';

/** 영문 ADR 인덱스 페이지를 렌더링한다. */
export default function EnAdrIndexPage() {
  const docs = getAllAdrs('en');
  const index = buildAdrIndex(docs);

  return <AdrIndexView index={index} locale="en" />;
}
