/**
 * @file       adr-meta-sidebar.tsx
 * @domain     blog / adr
 * @layer      ui
 * @related    src/lib/adr/types.ts, status-badge.tsx, impact-badge.tsx
 *
 * 상세 페이지 우측 메타사이드바 — 메타데이터, 에이전트, 관련 ADR, 네비게이션.
 */
import type { AdrDoc } from '@/lib/adr/types';
import { StatusBadge } from './status-badge';
import { ImpactBadge } from './impact-badge';

/** GitHub blob URL 베이스 */
const GH_BLOB_BASE = 'https://github.com/tpals0409/AlgoSu/blob/main/docs/adr';

interface AdrMetaSidebarProps {
  doc: AdrDoc;
  prevSprint?: number;
  nextSprint?: number;
}

/** 메타 항목 행을 렌더링한다. */
function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2 py-1.5 text-sm">
      <span className="shrink-0 text-text-subtle">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

/** 에이전트 chip 리스트를 렌더링한다. */
function AgentList({ agents }: { agents?: string[] }) {
  if (!agents || agents.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {agents.map((a) => (
        <span
          key={a}
          className="rounded-full bg-brand-soft px-2 py-0.5 text-xs text-brand-strong"
        >
          {a}
        </span>
      ))}
    </div>
  );
}

/** 관련 ADR 링크 리스트를 렌더링한다. */
function RelatedLinks({ ids, label }: { ids: string[]; label: string }) {
  if (ids.length === 0) return null;

  return (
    <div className="mt-3">
      <h5 className="mb-1 text-xs font-semibold text-text-subtle">{label}</h5>
      <ul className="space-y-0.5">
        {ids.map((id) => (
          <li key={id}>
            <span className="text-xs text-text-muted">{id}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Sprint 이전/다음 네비게이션을 렌더링한다. */
function SprintNav({ prev, next }: { prev?: number; next?: number }) {
  if (prev == null && next == null) return null;

  return (
    <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
      {prev != null ? (
        <a
          href={`/adr/sprints/${prev}/`}
          className="text-xs text-brand hover:underline"
        >
          Sprint {prev}
        </a>
      ) : (
        <span />
      )}
      {next != null ? (
        <a
          href={`/adr/sprints/${next}/`}
          className="text-xs text-brand hover:underline"
        >
          Sprint {next} &rarr;
        </a>
      ) : (
        <span />
      )}
    </div>
  );
}

/** ADR 상세 메타사이드바를 렌더링한다. */
export function AdrMetaSidebar({
  doc,
  prevSprint,
  nextSprint,
}: AdrMetaSidebarProps) {
  const { meta } = doc;

  return (
    <aside className="sticky top-24 hidden w-70 shrink-0 xl:block">
      <div className="rounded-lg border border-border bg-surface-elevated p-4">
        {/* 메타 항목 */}
        <div className="divide-y divide-border">
          {meta.sprint != null && (
            <MetaRow label="Sprint">{meta.sprint}</MetaRow>
          )}
          {meta.date && (
            <MetaRow label="날짜">
              <time dateTime={meta.date}>{meta.date}</time>
            </MetaRow>
          )}
          <MetaRow label="상태">
            <StatusBadge status={meta.status} rawStatus={meta.rawStatus} />
          </MetaRow>
          <MetaRow label="영향도">
            <ImpactBadge impact={meta.impact} />
          </MetaRow>
          <MetaRow label="읽기 시간">{meta.readingTimeMin}분</MetaRow>
        </div>

        {/* 에이전트 */}
        {meta.agents && meta.agents.length > 0 && (
          <div className="mt-4">
            <h5 className="mb-1.5 text-xs font-semibold text-text-subtle">
              에이전트
            </h5>
            <AgentList agents={meta.agents} />
          </div>
        )}

        {/* 관련 ADR */}
        <RelatedLinks
          ids={meta.relatedAdrs ?? []}
          label="관련 ADR"
        />

        {/* 관련 메모리 */}
        <RelatedLinks
          ids={meta.relatedMemory ?? []}
          label="관련 Memory"
        />

        {/* GitHub 링크 */}
        <div className="mt-4 border-t border-border pt-3">
          <a
            href={`${GH_BLOB_BASE}/${meta.filePath}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-brand hover:underline"
          >
            GitHub에서 보기 &rarr;
          </a>
        </div>

        {/* Sprint 네비게이션 */}
        <SprintNav prev={prevSprint} next={nextSprint} />
      </div>
    </aside>
  );
}
