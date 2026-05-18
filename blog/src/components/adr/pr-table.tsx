/**
 * @file       pr-table.tsx
 * @domain     blog / adr
 * @layer      ui
 * @related    src/lib/adr/types.ts
 *
 * 구현 섹션의 PR 표를 GitHub 링크 포함하여 렌더링한다.
 */
import type { PrTableRow } from '@/lib/adr/types';

/** GitHub PR URL 베이스 */
const GH_PR_BASE = 'https://github.com/tpals0409/AlgoSu/pull';

interface PrTableProps {
  rows: PrTableRow[];
}

/** PR 번호를 GitHub 링크로 변환한다. */
function PrLink({ prNumber }: { prNumber?: string }) {
  if (!prNumber) return <span className="text-text-subtle">-</span>;

  return (
    <a
      href={`${GH_PR_BASE}/${prNumber}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-brand hover:underline"
    >
      #{prNumber}
    </a>
  );
}

/** PR 테이블을 렌더링한다. */
export function PrTable({ rows }: PrTableProps) {
  if (rows.length === 0) return null;

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-border bg-surface-muted">
          <th className="px-3 py-2 text-left font-semibold text-text">PR</th>
          <th className="px-3 py-2 text-left font-semibold text-text">Title</th>
          <th className="px-3 py-2 text-left font-semibold text-text">Scope</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="border-b border-border">
            <td className="px-3 py-2">
              <PrLink prNumber={row.prNumber} />
            </td>
            <td className="px-3 py-2 text-text">{row.title}</td>
            <td className="px-3 py-2 text-text-muted">{row.scope ?? '-'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
