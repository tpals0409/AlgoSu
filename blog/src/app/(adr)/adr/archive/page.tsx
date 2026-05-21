/**
 * @file       page.tsx
 * @domain     blog / adr
 * @layer      app
 * @related    src/components/adr/adr-index-view.tsx, src/app/(adr)/adr/page.tsx
 *
 * 전체 ADR 아카이브 — /adr/archive 경로. 큐레이션 랜딩(/adr)에서 분리한 전수 목록(Sprint 186).
 * 통계·타임라인·종류별 전체 목록·에이전트 분포를 무손실 제공한다.
 */
import { getAllAdrs } from '@/lib/adr/loader';
import { buildAdrIndex } from '@/lib/adr/index-builder';
import { AdrIndexView } from '@/components/adr/adr-index-view';
import { t } from '@/lib/i18n';

/** 전체 ADR 아카이브 페이지를 렌더링한다. */
export default function AdrArchivePage() {
  const docs = getAllAdrs();
  const index = buildAdrIndex(docs);

  return (
    <div className="space-y-6">
      <div>
        <a
          href="/adr/"
          className="text-sm font-medium text-brand hover:underline"
        >
          {t('ko', 'adrArchiveBackToCurated')}
        </a>
        <h1 className="mt-2 font-heading text-2xl font-bold text-text">
          {t('ko', 'adrArchiveTitle')}
        </h1>
      </div>
      <AdrIndexView index={index} />
    </div>
  );
}
