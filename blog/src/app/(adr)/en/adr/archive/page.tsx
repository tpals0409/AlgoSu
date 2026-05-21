/**
 * @file       page.tsx
 * @domain     blog / adr
 * @layer      app
 * @related    src/app/(adr)/adr/archive/page.tsx, src/components/adr/adr-index-view.tsx
 *
 * 전체 ADR 아카이브 (영문) — /en/adr/archive 경로. locale='en'으로 전수 목록 렌더(Sprint 186).
 */
import { getAllAdrs } from '@/lib/adr/loader';
import { buildAdrIndex } from '@/lib/adr/index-builder';
import { AdrIndexView } from '@/components/adr/adr-index-view';
import { t } from '@/lib/i18n';

/** 영문 전체 ADR 아카이브 페이지를 렌더링한다. */
export default function EnAdrArchivePage() {
  const docs = getAllAdrs('en');
  const index = buildAdrIndex(docs);

  return (
    <div className="space-y-6">
      <div>
        <a
          href="/en/adr/"
          className="text-sm font-medium text-brand hover:underline"
        >
          {t('en', 'adrArchiveBackToCurated')}
        </a>
        <h1 className="mt-2 font-heading text-2xl font-bold text-text">
          {t('en', 'adrArchiveTitle')}
        </h1>
      </div>
      <AdrIndexView index={index} locale="en" />
    </div>
  );
}
