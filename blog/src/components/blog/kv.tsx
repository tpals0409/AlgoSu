/**
 * @file       kv.tsx
 * @domain     blog
 * @layer      ui
 * @related    src/components/mdx-components.tsx
 *
 * 인라인 Key-Value 한 쌍. 단순 메타 표시용.
 */
interface KVProps {
  k: string;
  v: string;
}

export function KV({ k, v }: KVProps) {
  return (
    <span className="not-prose inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-muted px-2 py-0.5 text-xs">
      <span className="font-medium text-text-muted">{k}</span>
      <span className="font-mono text-text">{v}</span>
    </span>
  );
}
