/**
 * @file       mdx-components.tsx
 * @domain     blog
 * @layer      mdx
 * @related    src/lib/mdx.ts, src/components/blog/*
 *
 * MDX → React 컴포넌트 매핑.
 * - 마크다운 기본 요소(`a`, `pre`, `table`, ...)에 토큰 스타일 적용
 * - blog 전용 컴포넌트(`Callout`, `MetricGrid`, ...)를 MDX 안에서 직접 사용 가능하게 노출
 *
 * 아이콘은 string-based로 사용 (예: `<HierarchyNode icon="Crown" .../>`).
 * 컴포넌트 내부에서 `getIcon()`으로 lookup. (`@/components/blog/icons.ts`)
 */
import type { MDXComponents } from 'mdx/types';
import { CodeBlock } from '@/components/blog/code-block';
import { Callout } from '@/components/blog/callout';
import { MetricGrid, MetricCard } from '@/components/blog/metric-grid';
import { ServiceGrid, ServiceCard } from '@/components/blog/service-grid';
import { Pipeline, PipelineStage } from '@/components/blog/pipeline';
import { EchelonStack, EchelonRow } from '@/components/blog/echelon-stack';
import { KV } from '@/components/blog/kv';
import { Mermaid } from '@/components/blog/mermaid';
import {
  ArchitectureMap,
  ArchLayer,
  ArchService,
} from '@/components/blog/architecture-map';
import {
  EchelonMatrix,
  EchelonMatrixRow,
  EchelonMatrixCell,
} from '@/components/blog/echelon-matrix';
import { HierarchyTree, HierarchyNode } from '@/components/blog/hierarchy-tree';
import { PhaseTimeline, PhaseMilestone } from '@/components/blog/phase-timeline';

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

  // 코드 블록 — 언어 라벨 + 복사 버튼
  pre: (props) => <CodeBlock {...props} />,

  // blog 전용 컴포넌트 노출
  Callout,
  MetricGrid,
  MetricCard,
  ServiceGrid,
  ServiceCard,
  Pipeline,
  PipelineStage,
  EchelonStack,
  EchelonRow,
  KV,
  Mermaid,
  // 신규 (70-6)
  ArchitectureMap,
  ArchLayer,
  ArchService,
  EchelonMatrix,
  EchelonMatrixRow,
  EchelonMatrixCell,
  HierarchyTree,
  HierarchyNode,
  PhaseTimeline,
  PhaseMilestone,
};
