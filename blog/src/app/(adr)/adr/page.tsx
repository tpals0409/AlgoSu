/**
 * @file       page.tsx
 * @domain     blog / adr
 * @layer      app
 * @related    src/lib/adr/loader.ts, src/components/adr/adr-landing-view.tsx
 *
 * ADR 큐레이션 랜딩 페이지 — /adr 경로. 전체 목록은 /adr/archive로 분리(Sprint 186).
 */
import { getAllAdrs } from '@/lib/adr/loader';
import { buildAdrIndex } from '@/lib/adr/index-builder';
import { AdrLandingView } from '@/components/adr/adr-landing-view';

/** ADR 큐레이션 랜딩 페이지를 렌더링한다. */
export default function AdrLandingPage() {
  const docs = getAllAdrs();
  const index = buildAdrIndex(docs);

  return <AdrLandingView index={index} />;
}
