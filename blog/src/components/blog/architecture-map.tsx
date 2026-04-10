/**
 * @file       architecture-map.tsx
 * @domain     blog
 * @layer      ui
 * @related    src/components/mdx-components.tsx
 *
 * 시스템 아키텍처 맵 — 클러스터 박스 안에 레이어 그룹 + 서비스 카드 + 화살표.
 * Mermaid의 단순 박스+화살표보다 풍부한 시각 위계 표현.
 *
 * 구조:
 *   ArchitectureMap (outer 클러스터 박스)
 *     └─ ArchLayer (레이어 그룹: Frontend / Edge / Backend / Workers / External)
 *           └─ ArchService (개별 서비스 카드: 아이콘 + 이름 + 포트 + 한 줄)
 *
 * 레이어 사이는 자동으로 down arrow가 표시됩니다.
 */
import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { getIcon, type IconName } from './icons';

interface ArchitectureMapProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
}

interface ArchLayerProps {
  label: string;
  tone?: 'edge' | 'gateway' | 'backend' | 'worker' | 'external';
  children: ReactNode;
}

interface ArchServiceProps {
  name: string;
  tech?: string;
  port?: string;
  icon: IconName | string;
  accent?: 1 | 2 | 3 | 4 | 5 | 6;
  note?: string;
}

const ACCENT_RING: Record<number, string> = {
  1: 'ring-accent-1',
  2: 'ring-accent-2',
  3: 'ring-accent-3',
  4: 'ring-accent-4',
  5: 'ring-accent-5',
  6: 'ring-accent-6',
};

const ACCENT_BG: Record<number, string> = {
  1: 'bg-accent-1',
  2: 'bg-accent-2',
  3: 'bg-accent-3',
  4: 'bg-accent-4',
  5: 'bg-accent-5',
  6: 'bg-accent-6',
};

const TONE_LABEL: Record<NonNullable<ArchLayerProps['tone']>, string> = {
  edge: 'Edge',
  gateway: 'Gateway',
  backend: 'Backend Services',
  worker: 'Async Workers',
  external: 'External',
};

export function ArchitectureMap({ title, subtitle, children }: ArchitectureMapProps) {
  return (
    <figure className="my-8 not-prose">
      <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-border-strong bg-diagram-bg p-5 sm:p-7">
        {(title || subtitle) && (
          <header className="mb-5 flex items-baseline justify-between gap-3 border-b border-border pb-3">
            {title && (
              <span className="text-xs font-bold uppercase tracking-wider text-text-muted">
                {title}
              </span>
            )}
            {subtitle && (
              <span className="text-[10px] font-mono text-text-subtle">{subtitle}</span>
            )}
          </header>
        )}
        <div className="flex flex-col items-stretch gap-4">{children}</div>
      </div>
    </figure>
  );
}

export function ArchLayer({ label, tone = 'backend', children }: ArchLayerProps) {
  return (
    <div className="group/layer relative">
      <div className="rounded-xl border border-border bg-surface-elevated p-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="rounded-md bg-surface-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-text-muted">
            {TONE_LABEL[tone]}
          </span>
          <span className="text-xs font-semibold text-text">{label}</span>
          <span className="ml-auto h-px flex-1 bg-border" />
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {children}
        </div>
      </div>
      {/* layer 사이 down arrow — 마지막 layer는 숨김 */}
      <div className="pointer-events-none flex justify-center group-last/layer:hidden">
        <ChevronDown
          size={24}
          strokeWidth={2.5}
          className="-my-1 text-text-subtle"
          aria-hidden
        />
      </div>
    </div>
  );
}

export function ArchService({ name, tech, port, icon, accent = 1, note }: ArchServiceProps) {
  const Icon = getIcon(icon);
  return (
    <div
      className={`group flex items-start gap-3 rounded-lg border border-border bg-surface p-3 ring-1 ring-inset transition hover:shadow-md ${ACCENT_RING[accent]}`}
    >
      <span
        aria-hidden
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white shadow-sm ${ACCENT_BG[accent]}`}
      >
        {Icon && <Icon size={18} strokeWidth={2.25} />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <h4 className="truncate text-sm font-bold text-text">{name}</h4>
          {port && <span className="font-mono text-[10px] text-text-muted">:{port}</span>}
        </div>
        {tech && <p className="mt-0.5 text-[11px] text-text-subtle">{tech}</p>}
        {note && <p className="mt-1 text-[11px] leading-snug text-text-muted">{note}</p>}
      </div>
    </div>
  );
}
