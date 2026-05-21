/**
 * @file       page.tsx
 * @domain     blog / adr
 * @layer      app
 * @related    src/app/(adr)/adr/page.tsx, src/components/adr/adr-landing-view.tsx
 *
 * ADR 큐레이션 랜딩 페이지 (영문) — /en/adr 경로. locale='en' 으로 view 렌더(Sprint 186).
 */
import { getAllAdrs } from '@/lib/adr/loader';
import { buildAdrIndex } from '@/lib/adr/index-builder';
import { AdrLandingView } from '@/components/adr/adr-landing-view';

/** 영문 ADR 큐레이션 랜딩 페이지를 렌더링한다. */
export default function EnAdrLandingPage() {
  const docs = getAllAdrs('en');
  const index = buildAdrIndex(docs);

  return <AdrLandingView index={index} locale="en" />;
}
