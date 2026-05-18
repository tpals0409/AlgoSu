/**
 * @file       page.tsx
 * @domain     blog / adr
 * @layer      app
 * @related    src/lib/adr/loader.ts, src/components/adr/sprints-list.tsx
 *
 * Sprint ADR 전체 목록 페이지 — /adr/sprints 경로.
 */
import { getAllAdrs } from '@/lib/adr/loader';
import { SprintsList } from '@/components/adr/sprints-list';

/** Sprint 전체 목록 페이지를 렌더링한다. */
export default function SprintsListPage() {
  const docs = getAllAdrs();
  const sprints = docs
    .filter((d) => d.meta.kind === 'sprint')
    .map((d) => d.meta)
    .sort((a, b) => (b.sprint ?? 0) - (a.sprint ?? 0));

  return <SprintsList items={sprints} />;
}
