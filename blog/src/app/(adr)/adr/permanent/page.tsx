/**
 * @file       page.tsx
 * @domain     blog / adr
 * @layer      app
 * @related    src/lib/adr/loader.ts, src/components/adr/adr-meta-list.tsx
 *
 * 영구 ADR 전체 목록 페이지 — /adr/permanent 경로. 사이드바 Permanent 진입점(Sprint 266).
 */
import { getAllAdrs } from '@/lib/adr/loader';
import { AdrMetaList } from '@/components/adr/adr-meta-list';

/** 영구 ADR 전체 목록 페이지를 렌더링한다. */
export default function PermanentListPage() {
  const permanent = getAllAdrs()
    .filter((d) => d.meta.kind === 'permanent')
    .map((d) => d.meta)
    .sort((a, b) => a.slug.localeCompare(b.slug));

  return <AdrMetaList items={permanent} titleKey="sectionPermanent" />;
}
