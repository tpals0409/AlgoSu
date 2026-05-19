/**
 * @file       adr-lessons-callout.tsx
 * @domain     blog / adr
 * @layer      ui
 * @related    src/lib/adr/types.ts, src/lib/i18n.ts
 *
 * ADR 교훈 wrapper callout — lessons 섹션 raw markdown(H2 제거 + 인접 H3 포함)을
 * warn 톤 박스에 감싸 시각 강조. content 100% 보존을 위해 list-entry 변환 대신
 * 본문 prose 그대로 렌더(Sprint 163 R7 P2 결정).
 */
import type { ReactNode } from 'react';
import { type Locale, t } from '@/lib/i18n';

interface AdrLessonsCalloutProps {
  /** lessons 섹션 raw markdown 을 renderAdrMdx로 컴파일한 ReactNode */
  children?: ReactNode;
  /** TOC anchor 호환 — strip된 lessons H2 anchorId */
  anchorId?: string;
  locale?: Locale;
}

/** ADR 교훈 callout wrapper를 렌더링한다. */
export function AdrLessonsCallout({
  children,
  anchorId,
  locale = 'ko',
}: AdrLessonsCalloutProps) {
  if (!children) return null;

  return (
    <aside
      id={anchorId}
      role="note"
      aria-label={t(locale, 'lessonsTitle')}
      className="mb-6 rounded-lg border border-callout-warn-border bg-callout-warn-bg p-4 scroll-mt-24"
    >
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-callout-warn-fg">
        <span aria-hidden="true">💡</span>
        <span>{t(locale, 'lessonsTitle')}</span>
      </div>
      <div className="prose max-w-none prose-headings:text-callout-warn-fg prose-p:text-callout-warn-fg/90 prose-li:text-callout-warn-fg/90 prose-strong:text-callout-warn-fg">
        {children}
      </div>
    </aside>
  );
}
