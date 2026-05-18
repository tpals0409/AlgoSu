/**
 * @file       agent-chips.tsx
 * @domain     blog / adr
 * @layer      ui
 * @related    src/lib/adr/types.ts
 *
 * 에이전트별 count 분포 chip 리스트.
 */

interface AgentChipsProps {
  /** 에이전트 이름 -> 등장 횟수 */
  agents: Map<string, number>;
}

/** 에이전트 chip 하나를 렌더링한다. */
function AgentChip({ name, count }: { name: string; count: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-medium text-brand-strong">
      {name}
      <span className="rounded-full bg-brand px-1.5 text-[10px] text-white">
        {count}
      </span>
    </span>
  );
}

/** 에이전트 count 분포를 chip 리스트로 렌더링한다. */
export function AgentChips({ agents }: AgentChipsProps) {
  const entries = [...agents.entries()].sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map(([name, count]) => (
        <AgentChip key={name} name={name} count={count} />
      ))}
    </div>
  );
}
