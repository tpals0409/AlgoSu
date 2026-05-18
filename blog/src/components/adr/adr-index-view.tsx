/**
 * @file       adr-index-view.tsx
 * @domain     blog / adr
 * @layer      ui
 * @related    src/lib/adr/types.ts, sprint-timeline.tsx, adr-card.tsx
 *
 * ADR 인덱스 메인 뷰 — 통계 헤더, 카테고리 탭, 타임라인, 카드 그리드.
 */
import type { AdrIndex, AdrMeta } from '@/lib/adr/types';
import { AdrCategoryTabs } from './adr-category-tabs';
import { SprintTimeline } from './sprint-timeline';
import { AdrCard } from './adr-card';
import { AgentChips } from './agent-chips';

interface AdrIndexViewProps {
  index: AdrIndex;
}

/** 최근 sprint 12개를 내림차순으로 추출한다. */
function getRecentSprints(items: AdrMeta[]): AdrMeta[] {
  return items
    .filter((m) => m.kind === 'sprint')
    .sort((a, b) => (b.sprint ?? 0) - (a.sprint ?? 0))
    .slice(0, 12);
}

/** 전체 에이전트 등장 횟수를 집계한다. */
function aggregateAgents(items: AdrMeta[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const m of items) {
    if (!m.agents) continue;
    for (const a of m.agents) {
      map.set(a, (map.get(a) ?? 0) + 1);
    }
  }
  return map;
}

/** sprint 범위 문자열을 생성한다. */
function sprintRange(items: AdrMeta[]): string {
  const nums = items
    .filter((m) => m.sprint != null)
    .map((m) => m.sprint as number);
  if (nums.length === 0) return '-';
  return `${Math.min(...nums)} ~ ${Math.max(...nums)}`;
}

/** 마지막 갱신 날짜를 추출한다. */
function lastUpdated(items: AdrMeta[]): string {
  const dates = items
    .filter((m) => m.date)
    .map((m) => m.date as string)
    .sort();
  return dates.length > 0 ? dates[dates.length - 1] : '-';
}

/** 통계 헤더 카드를 렌더링한다. */
function StatsHeader({ index }: { index: AdrIndex }) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
      <StatCard label="전체 ADR" value={index.all.length} />
      <StatCard label="Sprint 범위" value={sprintRange(index.all)} />
      <StatCard label="마지막 갱신" value={lastUpdated(index.all)} />
      <StatCard
        label="종류"
        value={`P${index.byKind.permanent.length} / T${index.byKind.topic.length} / S${index.byKind.sprint.length}`}
      />
    </div>
  );
}

/** 개별 통계 카드를 렌더링한다. */
function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border bg-surface-elevated p-3">
      <p className="text-xs text-text-subtle">{label}</p>
      <p className="mt-1 text-lg font-bold text-text">{value}</p>
    </div>
  );
}

/** ADR 인덱스 메인 뷰를 렌더링한다. */
export function AdrIndexView({ index }: AdrIndexViewProps) {
  const recentSprints = getRecentSprints(index.all);
  const agents = aggregateAgents(index.all);

  return (
    <div className="space-y-8">
      {/* 통계 헤더 */}
      <StatsHeader index={index} />

      {/* 카테고리 탭 */}
      <AdrCategoryTabs
        counts={{
          permanent: index.byKind.permanent.length,
          topic: index.byKind.topic.length,
          sprint: index.byKind.sprint.length,
        }}
      />

      {/* Sprint 타임라인 */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-text">
          Sprint 타임라인
        </h2>
        <SprintTimeline items={index.all} />
      </section>

      {/* 영구 ADR */}
      <section id="permanent">
        <h2 className="mb-4 text-lg font-semibold text-text">
          영구 ADR
          <span className="ml-1 text-sm font-normal text-text-muted">
            ({index.byKind.permanent.length})
          </span>
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {index.byKind.permanent.map((m) => (
            <AdrCard key={m.id} meta={m} />
          ))}
        </div>
      </section>

      {/* 토픽 ADR */}
      <section id="topics">
        <h2 className="mb-4 text-lg font-semibold text-text">
          토픽 ADR
          <span className="ml-1 text-sm font-normal text-text-muted">
            ({index.byKind.topic.length})
          </span>
        </h2>
        <div className="grid gap-4">
          {index.byKind.topic.map((m) => (
            <AdrCard key={m.id} meta={m} />
          ))}
        </div>
      </section>

      {/* Sprint ADR — 최근 12개 */}
      <section id="sprints">
        <h2 className="mb-4 text-lg font-semibold text-text">
          Sprint ADR
          <span className="ml-1 text-sm font-normal text-text-muted">
            (최근 12개 / 전체 {index.byKind.sprint.length})
          </span>
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recentSprints.map((m) => (
            <AdrCard key={m.id} meta={m} />
          ))}
        </div>
        {index.byKind.sprint.length > 12 && (
          <div className="mt-4 text-center">
            <a
              href="/adr/sprints/"
              className="text-sm font-medium text-brand hover:underline"
            >
              전체 보기 &rarr;
            </a>
          </div>
        )}
      </section>

      {/* 에이전트 분포 */}
      {agents.size > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-text">
            에이전트 분포
          </h2>
          <AgentChips agents={agents} />
        </section>
      )}
    </div>
  );
}
