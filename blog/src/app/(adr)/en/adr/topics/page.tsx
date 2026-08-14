/**
 * @file       page.tsx
 * @domain     blog / adr
 * @layer      app
 * @related    src/app/(adr)/adr/topics/page.tsx, src/components/adr/adr-meta-list.tsx
 *
 * 토픽 ADR 전체 목록 페이지 (영문) — /en/adr/topics 경로. 사이드바 Topics 진입점(Sprint 266).
 */
import { getAllAdrs } from '@/lib/adr/loader';
import { AdrMetaList } from '@/components/adr/adr-meta-list';

/** 영문 토픽 ADR 전체 목록 페이지를 렌더링한다. */
export default function EnTopicsListPage() {
  const topics = getAllAdrs('en')
    .filter((d) => d.meta.kind === 'topic')
    .map((d) => d.meta)
    .sort((a, b) => a.slug.localeCompare(b.slug));

  return <AdrMetaList items={topics} titleKey="sectionTopic" locale="en" />;
}
