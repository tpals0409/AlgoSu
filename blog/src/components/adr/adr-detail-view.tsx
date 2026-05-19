/**
 * @file       adr-detail-view.tsx
 * @domain     blog / adr
 * @layer      ui
 * @related    src/lib/adr/types.ts, adr-toc.tsx, adr-meta-sidebar.tsx
 *
 * ADR 상세 3-column 레이아웃 — 좌 TOC / 중앙 본문 / 우 메타사이드바(미니 그래프 포함).
 * locale='en' + !meta.hasEnTranslation 일 때만 "Content in Korean" 배너 + 한국어 원문 링크 표시.
 * 영문판 본문이 존재하는 ADR(docs/adr-en/<path> 있음)은 배너 없이 영문 본문만 렌더.
 */
import type { AdjacencyList, AdrDoc, AdrMeta } from '@/lib/adr/types';
import { renderAdrMdx } from '@/lib/adr/markdown';
import { buildUrl } from '@/lib/adr/index-builder';
import { getCanonicalSectionIndices } from '@/lib/adr/parser';
import { type Locale, t } from '@/lib/i18n';
import { AdrToc } from './adr-toc';
import { AdrMetaSidebar } from './adr-meta-sidebar';
import { AdrHero } from './adr-hero';
import { AdrPhaseStrip } from './adr-phase-strip';
import { AdrDecisionsGrid } from './adr-decisions-grid';
import { AdrLessonsCallout } from './adr-lessons-callout';
import { AdrCarryoverCallout } from './adr-carryover-callout';

interface AdrDetailViewProps {
  doc: AdrDoc;
  prevSprint?: number;
  nextSprint?: number;
  miniGraph?: AdjacencyList;
  locale?: Locale;
}

/** 영문판일 때 본문 위에 표시되는 "한국어 전용 본문" 배너를 렌더링한다. */
function KoreanOnlyBanner({ meta }: { meta: AdrMeta }) {
  const koHref = buildUrl(meta, 'ko') + '/';

  return (
    <aside
      role="note"
      className="mb-6 rounded-lg border border-callout-info-border bg-callout-info-bg p-4 text-sm text-callout-info-fg"
    >
      <p className="mb-2">{t('en', 'contentKoreanOnly')}</p>
      <a href={koHref} className="font-medium text-brand hover:underline">
        {t('en', 'viewOriginalKr')}
      </a>
    </aside>
  );
}

/** ADR 상세 3-column 레이아웃을 렌더링한다. */
export async function AdrDetailView({
  doc,
  prevSprint,
  nextSprint,
  miniGraph,
  locale = 'ko',
}: AdrDetailViewProps) {
  // strip된 본문 우선 — lessons/carryover/PR 표 중복 차단.
  // graceful degradation: parser가 strip 실패 시 bodyMarkdownForProse === bodyMarkdown.
  const proseSource = doc.bodyMarkdownForProse ?? doc.bodyMarkdown;
  const content = await renderAdrMdx(proseSource, locale);

  // TOC에서 callout으로 들어낸 섹션의 anchor를 제거하여 404 anchor 방지(Sprint 163 R2 P2-1).
  // 동시에 callout root <aside id={anchorId}>로 H2 anchorId 이어받아 TOC 링크 동작 유지.
  const lessonsIndices =
    doc.lessons && doc.lessons.length > 0
      ? getCanonicalSectionIndices(doc.sections, 'lessons')
      : undefined;
  const carryoverIndices =
    doc.carryover && doc.carryover.length > 0
      ? getCanonicalSectionIndices(doc.sections, 'carryover')
      : undefined;

  const strippedIndexSet = new Set<number>([
    ...(lessonsIndices ?? []),
    ...(carryoverIndices ?? []),
  ]);
  const visibleSections =
    strippedIndexSet.size > 0
      ? doc.sections.filter((_, i) => !strippedIndexSet.has(i))
      : doc.sections;

  // callout root에 부여할 H2 anchorId (H3 sub-section의 anchor는 callout 안에 흡수)
  const lessonsAnchorId =
    lessonsIndices !== undefined
      ? doc.sections[lessonsIndices[0]].anchorId
      : undefined;
  const carryoverAnchorId =
    carryoverIndices !== undefined
      ? doc.sections[carryoverIndices[0]].anchorId
      : undefined;

  return (
    <div className="flex gap-8">
      {/* 좌측 TOC */}
      <AdrToc sections={visibleSections} locale={locale} />

      {/* 중앙 본문 */}
      <article className="min-w-0 max-w-3xl flex-1">
        <h1 className="mb-6 text-3xl font-bold text-text">{doc.meta.title}</h1>
        {locale === 'en' && !doc.meta.hasEnTranslation && (
          <KoreanOnlyBanner meta={doc.meta} />
        )}
        <AdrHero doc={doc} locale={locale} />
        <AdrPhaseStrip phases={doc.phases} locale={locale} />
        <AdrDecisionsGrid decisions={doc.decisions} locale={locale} />
        <div className="prose max-w-none">{content}</div>
        <AdrLessonsCallout
          lessons={doc.lessons}
          anchorId={lessonsAnchorId}
          locale={locale}
        />
        <AdrCarryoverCallout
          carryover={doc.carryover}
          anchorId={carryoverAnchorId}
          locale={locale}
        />
      </article>

      {/* 우측 메타사이드바 */}
      <AdrMetaSidebar
        doc={doc}
        prevSprint={prevSprint}
        nextSprint={nextSprint}
        miniGraph={miniGraph}
        locale={locale}
      />
    </div>
  );
}
