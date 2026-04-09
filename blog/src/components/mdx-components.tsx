/**
 * @file       mdx-components.tsx
 * @domain     blog
 * @layer      mdx
 * @related    src/lib/mdx.ts, src/components/blog/*
 *
 * MDX → React 컴포넌트 매핑.
 * - 마크다운 기본 요소(`a`, `pre`, `table`, ...)에 토큰 스타일 적용
 * - blog 전용 컴포넌트(`Callout`, `MetricGrid`, ...)를 MDX 안에서 직접 사용 가능하게 노출
 */
import type { MDXComponents } from 'mdx/types';
import { Callout } from '@/components/blog/callout';
import { MetricGrid, MetricCard } from '@/components/blog/metric-grid';
import { ServiceGrid, ServiceCard } from '@/components/blog/service-grid';
import { Pipeline, PipelineStage } from '@/components/blog/pipeline';
import { TierStack, TierRow } from '@/components/blog/tier-stack';
import { KV } from '@/components/blog/kv';
import { Mermaid } from '@/components/blog/mermaid';

export const mdxComponents: MDXComponents = {
  // 외부 링크 — 새 탭, 안전 속성
  a: ({ href = '', children, ...rest }) => {
    const isExternal = /^https?:\/\//.test(href);
    if (isExternal) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand underline-offset-2 hover:underline"
          {...rest}
        >
          {children}
        </a>
      );
    }
    return (
      <a href={href} className="text-brand underline-offset-2 hover:underline" {...rest}>
        {children}
      </a>
    );
  },

  // blog 전용 컴포넌트 노출
  Callout,
  MetricGrid,
  MetricCard,
  ServiceGrid,
  ServiceCard,
  Pipeline,
  PipelineStage,
  TierStack,
  TierRow,
  KV,
  Mermaid,
};
