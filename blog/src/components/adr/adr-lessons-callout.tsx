/**
 * @file       adr-lessons-callout.tsx
 * @domain     blog / adr
 * @layer      ui
 * @related    src/lib/adr/types.ts, src/lib/i18n.ts
 *
 * ADR 교훈 callout — lessons 섹션의 list item을 warn 톤 박스로 강조 렌더.
 * 본문 prose에서 strip된 항목을 시각 카드로 대체한다.
 */
import type { AdrLessonEntry } from '@/lib/adr/types';
import { type Locale, t } from '@/lib/i18n';

interface AdrLessonsCalloutProps {
  lessons?: AdrLessonEntry[];
  locale?: Locale;
}

/** 개별 교훈 항목을 렌더링한다. */
function LessonItem({ entry }: { entry: AdrLessonEntry }) {
  return (
    <li className="leading-relaxed">
      {entry.title && (
        <span className="font-semibold text-callout-warn-fg">
          {entry.title}
          <span aria-hidden="true">: </span>
        </span>
      )}
      <span className="text-callout-warn-fg/90">{entry.description}</span>
    </li>
  );
}

/** ADR 교훈 callout 박스를 렌더링한다. */
export function AdrLessonsCallout({
  lessons,
  locale = 'ko',
}: AdrLessonsCalloutProps) {
  if (!lessons || lessons.length === 0) return null;

  return (
    <aside
      role="note"
      aria-label={t(locale, 'lessonsTitle')}
      className="mb-6 rounded-lg border border-callout-warn-border bg-callout-warn-bg p-4"
    >
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-callout-warn-fg">
        <span aria-hidden="true">💡</span>
        <span>{t(locale, 'lessonsTitle')}</span>
      </div>
      <ul className="ml-1 list-disc space-y-2 pl-4 text-sm">
        {lessons.map((entry, i) => (
          <LessonItem key={i} entry={entry} />
        ))}
      </ul>
    </aside>
  );
}
