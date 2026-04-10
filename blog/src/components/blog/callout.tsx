/**
 * @file       callout.tsx
 * @domain     blog
 * @layer      ui
 * @related    src/components/mdx-components.tsx
 *
 * 본문 강조 박스. 4가지 톤(info/warn/success/danger).
 */
import type { ReactNode } from 'react';

type CalloutType = 'info' | 'warn' | 'success' | 'danger';

interface CalloutProps {
  type?: CalloutType;
  title?: string;
  children: ReactNode;
}

const STYLES: Record<CalloutType, { wrap: string; title: string; icon: string }> = {
  info: {
    wrap: 'bg-callout-info-bg border-callout-info-border text-callout-info-fg',
    title: 'text-callout-info-fg',
    icon: 'ℹ',
  },
  warn: {
    wrap: 'bg-callout-warn-bg border-callout-warn-border text-callout-warn-fg',
    title: 'text-callout-warn-fg',
    icon: '⚠',
  },
  success: {
    wrap: 'bg-callout-success-bg border-callout-success-border text-callout-success-fg',
    title: 'text-callout-success-fg',
    icon: '✓',
  },
  danger: {
    wrap: 'bg-callout-danger-bg border-callout-danger-border text-callout-danger-fg',
    title: 'text-callout-danger-fg',
    icon: '✕',
  },
};

export function Callout({ type = 'info', title, children }: CalloutProps) {
  const s = STYLES[type];
  return (
    <aside
      className={`my-6 rounded-lg border-l-4 border shadow-sm ${s.wrap} px-4 py-3 not-prose`}
      role="note"
    >
      {title && (
        <p className={`mb-1 flex items-center gap-2 font-semibold ${s.title}`}>
          <span aria-hidden>{s.icon}</span>
          <span>{title}</span>
        </p>
      )}
      <div className="text-sm leading-relaxed [&>p]:m-0 [&>p+p]:mt-2">{children}</div>
    </aside>
  );
}
