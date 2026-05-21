/**
 * @file       adr-detail-view.tsx
 * @domain     blog / adr
 * @layer      ui
 * @related    src/lib/adr/types.ts, adr-toc.tsx, adr-meta-sidebar.tsx
 *
 * ADR 상세 3-column 레이아웃 — 좌 TOC / 중앙 본문 / 우 메타사이드바.
 * locale='en' + !meta.hasEnTranslation 일 때만 "Content in Korean" 배너 + 한국어 원문 링크 표시.
 *
 * 본문 렌더는 sections 단위 chunk 방식 — lessons/carryover canonical을 만나면
 * prose 누적분을 flush 후 callout wrapper를 in-place 삽입한다(Sprint 163 R4 P2).
 * callout 안에는 해당 H2 그룹의 raw markdown(H2 헤딩 제거 + 인접 H3 포함)을 prose로
 * 렌더하여 본문 content 100% 보존(Sprint 163 R7 P2 — list 외 prose/H3 mixed 차단).
 */
import type { ReactNode } from 'react';
import type {
  AdrDoc,
  AdrMeta,
  AdrSection,
} from '@/lib/adr/types';
import { renderAdrMdx } from '@/lib/adr/markdown';
import { buildUrl } from '@/lib/adr/index-builder';
import {
  getCanonicalSectionIndices,
  stripPrTableLines,
} from '@/lib/adr/parser';
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

/**
 * canonical 그룹의 raw markdown 을 결합하되 H2 헤딩 라인은 제거한다.
 * callout wrapper가 자체 heading(`💡 교훈` / `📋 이월`) 을 그리므로 H2 중복 회피.
 */
function buildCalloutMarkdown(
  sections: AdrSection[],
  indices: number[],
): string {
  return indices
    .map((idx, pos) => {
      const sec = sections[idx];
      if (pos === 0 && sec.level === 2) {
        // 첫 H2 의 heading 라인만 제거
        return sec.rawMarkdown.replace(/^##\s+.+$/m, '').trim();
      }
      return sec.rawMarkdown;
    })
    .filter((s) => s.length > 0)
    .join('\n\n');
}

/**
 * 본문을 sections 단위 chunk로 렌더한다.
 * lessons/carryover H2 만나면 prose 누적 flush 후 callout wrapper를 그 위치에 삽입한다.
 * implementation H2의 PR 표는 stripPrTableLines로 정밀 제거(PhaseStrip 중복 차단).
 */
async function renderSectionChunks(
  doc: AdrDoc,
  locale: Locale,
  lessonsIndices: number[] | undefined,
  carryoverIndices: number[] | undefined,
  lessonsAnchorId: string | undefined,
  carryoverAnchorId: string | undefined,
): Promise<ReactNode[]> {
  const chunks: ReactNode[] = [];
  let proseBuffer: string[] = [];

  const lessonsIdxSet = new Set(lessonsIndices ?? []);
  const carryoverIdxSet = new Set(carryoverIndices ?? []);
  const hasLessons = doc.lessons && doc.lessons.length > 0;
  const hasCarryover = doc.carryover && doc.carryover.length > 0;

  const flushProse = async () => {
    if (proseBuffer.length === 0) return;
    const md = proseBuffer.join('\n\n').trim();
    proseBuffer = [];
    if (md.length === 0) return;
    const content = await renderAdrMdx(md, locale);
    chunks.push(
      <div
        key={`prose-${chunks.length}`}
        className="prose max-w-none"
      >
        {content}
      </div>,
    );
  };

  // preamble seed — 첫 H2 직전(보통 frontmatter-less ADR의 H1 + dash-list 메타)
  // H1은 상단에서 별도 렌더되므로 본문에서는 제거(R5 P2).
  if (doc.sections.length > 0) {
    const firstH2Idx = doc.bodyMarkdown.search(/^##\s+/m);
    if (firstH2Idx > 0) {
      const preamble = doc.bodyMarkdown
        .slice(0, firstH2Idx)
        .replace(/^#\s+.+$/m, '')
        .trim();
      if (preamble.length > 0) {
        proseBuffer.push(preamble);
      }
    }
  } else {
    const cleaned = doc.bodyMarkdown.replace(/^#\s+.+$/m, '').trim();
    if (cleaned.length > 0) proseBuffer.push(cleaned);
  }

  for (let i = 0; i < doc.sections.length; i++) {
    const sec = doc.sections[i];

    // lessons H2 — callout wrapper로 대체. 인접 H3 sub-section은 wrapper 안에 흡수
    if (sec.level === 2 && sec.canonical === 'lessons' && hasLessons) {
      await flushProse();
      const md = buildCalloutMarkdown(doc.sections, lessonsIndices ?? [i]);
      const content = md.length > 0 ? await renderAdrMdx(md, locale) : null;
      chunks.push(
        <AdrLessonsCallout
          key={`lessons-${i}`}
          anchorId={lessonsAnchorId}
          locale={locale}
        >
          {content}
        </AdrLessonsCallout>,
      );
      continue;
    }
    if (sec.level === 3 && hasLessons && lessonsIdxSet.has(i)) continue;

    // carryover H2 — callout wrapper로 대체. 인접 H3 sub-section도 wrapper 안에 흡수
    if (sec.level === 2 && sec.canonical === 'carryover' && hasCarryover) {
      await flushProse();
      const md = buildCalloutMarkdown(doc.sections, carryoverIndices ?? [i]);
      const content = md.length > 0 ? await renderAdrMdx(md, locale) : null;
      chunks.push(
        <AdrCarryoverCallout
          key={`carryover-${i}`}
          anchorId={carryoverAnchorId}
          locale={locale}
        >
          {content}
        </AdrCarryoverCallout>,
      );
      continue;
    }
    if (sec.level === 3 && hasCarryover && carryoverIdxSet.has(i)) continue;

    // implementation H2 — PR 표 라인 strip(PhaseStrip 카드 중복 차단)
    if (
      sec.level === 2 &&
      sec.canonical === 'implementation' &&
      doc.phases &&
      doc.phases.length > 0
    ) {
      proseBuffer.push(stripPrTableLines(sec.rawMarkdown));
      continue;
    }

    proseBuffer.push(sec.rawMarkdown);
  }

  await flushProse();
  return chunks;
}

/**
 * TOC에서 callout으로 흡수된 H3 sub-section 만 제거(H2는 anchor 매칭으로 callout 점프).
 * wrapper callout이 H3 raw markdown 까지 흡수하므로 callout 내부 anchor는 prose chunk에서
 * 자연 rehypeSlug 처리됨 → TOC에서는 중복 회피를 위해 흡수된 H3 indices 모두 제거.
 */
function filterTocSections(
  sections: AdrSection[],
  lessonsIndices: number[] | undefined,
  carryoverIndices: number[] | undefined,
): AdrSection[] {
  const strippedH3 = new Set<number>(
    [...(lessonsIndices ?? []), ...(carryoverIndices ?? [])].filter(
      (i) => sections[i].level === 3,
    ),
  );
  if (strippedH3.size === 0) return sections;
  return sections.filter((_, i) => !strippedH3.has(i));
}

/** ADR 상세 3-column 레이아웃을 렌더링한다. */
export async function AdrDetailView({
  doc,
  prevSprint,
  nextSprint,
  locale = 'ko',
}: AdrDetailViewProps) {
  const lessonsIndices =
    doc.lessons && doc.lessons.length > 0
      ? getCanonicalSectionIndices(doc.sections, 'lessons')
      : undefined;
  const carryoverIndices =
    doc.carryover && doc.carryover.length > 0
      ? getCanonicalSectionIndices(doc.sections, 'carryover')
      : undefined;

  const lessonsAnchorId = lessonsIndices
    ? doc.sections[lessonsIndices[0]].anchorId
    : undefined;
  const carryoverAnchorId = carryoverIndices
    ? doc.sections[carryoverIndices[0]].anchorId
    : undefined;

  const chunks = await renderSectionChunks(
    doc,
    locale,
    lessonsIndices,
    carryoverIndices,
    lessonsAnchorId,
    carryoverAnchorId,
  );
  const visibleSections = filterTocSections(
    doc.sections,
    lessonsIndices,
    carryoverIndices,
  );

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
        {chunks}
      </article>

      {/* 우측 메타사이드바 */}
      <AdrMetaSidebar
        doc={doc}
        prevSprint={prevSprint}
        nextSprint={nextSprint}
        locale={locale}
      />
    </div>
  );
}
