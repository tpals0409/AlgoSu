/**
 * @file       mermaid.tsx
 * @domain     blog
 * @layer      ui
 * @related    src/components/mdx-components.tsx
 *
 * Mermaid 다이어그램 클라이언트 컴포넌트.
 * 정적 export(`output: 'export'`) 환경이므로 dynamic import + ssr:false 패턴.
 * mermaid 라이브러리는 페이지 진입 시 lazy load 되어 ~600KB 번들 영향을 분리합니다.
 *
 * MDX에서는 `name` prop으로 사전 등록된 차트를 참조합니다.
 * 차트 정의는 `chart-registry.ts`에서 관리합니다.
 */
'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { chartRegistry } from './chart-registry';

interface MermaidProps {
  /** 사전 등록된 차트 이름 (chart-registry.ts) */
  name?: string;
  /** 직접 전달하는 차트 문자열 (MDX 외부에서 사용) */
  chart?: string;
  caption?: string;
}

export function Mermaid({ name, chart, caption }: MermaidProps) {
  const resolvedChart = chart || (name ? chartRegistry[name] : '') || '';
  const id = useId().replace(/[:]/g, '');
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!resolvedChart) {
      setError(name ? `Chart "${name}" not found in registry` : 'No chart provided');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        const isDark =
          typeof document !== 'undefined' &&
          document.documentElement.classList.contains('dark');
        mermaid.initialize({
          startOnLoad: false,
          theme: isDark ? 'dark' : 'default',
          securityLevel: 'strict',
          fontFamily: 'inherit',
        });
        const { svg } = await mermaid.render(`m-${id}`, resolvedChart);
        if (!cancelled && ref.current) {
          ref.current.innerHTML = svg;
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Mermaid render error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resolvedChart, id, name]);

  return (
    <figure className="my-6 not-prose">
      <div
        ref={ref}
        className="overflow-x-auto rounded-lg border border-border bg-diagram-bg p-4 shadow-sm [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full"
      >
        {error && (
          <pre className="text-xs text-callout-danger-fg">{error}</pre>
        )}
      </div>
      {caption && (
        <figcaption className="mt-2 text-center text-xs text-text-muted">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
