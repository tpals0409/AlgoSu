/**
 * @file       adr-card.tsx
 * @domain     blog / adr
 * @layer      ui
 * @related    src/lib/adr/types.ts, status-badge.tsx, impact-badge.tsx
 *
 * ADR 인덱스 카드 — 제목, 상태/영향도 뱃지, 날짜, 에이전트 미리보기.
 */
import type { AdrMeta, AdrKind } from '@/lib/adr/types';
import { buildUrl } from '@/lib/adr/index-builder';
import { StatusBadge } from './status-badge';
import { ImpactBadge } from './impact-badge';

interface AdrCardProps {
  meta: AdrMeta;
}

/** Kind 라벨 매핑 */
const KIND_LABEL: Record<AdrKind, string> = {
  permanent: 'Permanent',
  topic: 'Topic',
  sprint: 'Sprint',
};

/** Kind 뱃지 스타일 매핑 */
const KIND_STYLES: Record<AdrKind, string> = {
  permanent: 'bg-brand-soft text-brand-strong',
  topic: 'bg-callout-warn-bg text-callout-warn-fg',
  sprint: 'bg-surface-muted text-text-muted',
};

/** 에이전트 미리보기를 렌더링한다 (최대 3명 + "+N"). */
function AgentPreview({ agents }: { agents?: string[] }) {
  if (!agents || agents.length === 0) return null;

  const visible = agents.slice(0, 3);
  const rest = agents.length - 3;

  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((a) => (
        <span
          key={a}
          className="rounded-full bg-brand-soft px-2 py-0.5 text-[10px] text-brand-strong"
        >
          {a}
        </span>
      ))}
      {rest > 0 && (
        <span className="text-[10px] text-text-subtle">+{rest} more</span>
      )}
    </div>
  );
}

/** ADR 인덱스 카드를 렌더링한다. */
export function AdrCard({ meta }: AdrCardProps) {
  const href = buildUrl(meta);

  return (
    <a
      href={href}
      className="block rounded-lg border border-border bg-surface-elevated p-4 transition-shadow hover:shadow-md"
    >
      {/* Kind 뱃지 */}
      <span
        className={`mb-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${KIND_STYLES[meta.kind]}`}
      >
        {KIND_LABEL[meta.kind]}
      </span>

      {/* 제목 */}
      <h3 className="mb-2 line-clamp-2 text-sm font-bold text-text">
        {meta.title}
      </h3>

      {/* 뱃지 행 */}
      <div className="mb-2 flex flex-wrap gap-1.5">
        <StatusBadge status={meta.status} rawStatus={meta.rawStatus} />
        <ImpactBadge impact={meta.impact} />
      </div>

      {/* 메타 행 */}
      <div className="mb-2 flex items-center gap-2 text-xs text-text-muted">
        {meta.date && <time dateTime={meta.date}>{meta.date}</time>}
        {meta.sprint != null && <span>Sprint {meta.sprint}</span>}
      </div>

      {/* 에이전트 미리보기 */}
      <AgentPreview agents={meta.agents} />
    </a>
  );
}
