/**
 * @file       mermaid.tsx
 * @domain     blog
 * @layer      ui
 * @related    src/components/mdx-components.tsx
 *
 * Mermaid 다이어그램 클라이언트 컴포넌트.
 * 정적 export(`output: 'export'`) 환경이므로 dynamic import + ssr:false 패턴.
 * mermaid 라이브러리는 페이지 진입 시 lazy load 되어 ~600KB 번들 영향을 분리합니다.
 */
'use client';

import { useEffect, useId, useRef, useState } from 'react';

interface MermaidProps {
  chart: string;
  caption?: string;
}

export function Mermaid({ chart, caption }: MermaidProps) {
  const id = useId().replace(/[:]/g, '');
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
        const { svg } = await mermaid.render(`m-${id}`, chart);
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
  }, [chart, id]);

  return (
    <figure className="my-6 not-prose">
      <div
        ref={ref}
        className="overflow-x-auto rounded-lg border bg-diagram-bg p-4 [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full"
        style={{ borderColor: 'var(--border)' }}
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
