/**
 * @file       result-callout.tsx
 * @domain     blog
 * @layer      ui
 * @related    src/components/blog/callout.tsx, src/components/mdx-components.tsx
 *
 * 결과·임팩트 강조 박스 — 글의 핵심 성과를 한눈에 띄게 한다.
 * 기존 Callout(success 톤)의 프리셋 래퍼로 구현해 스타일을 단일 출처로 유지한다.
 */
import type { ReactNode } from 'react';
import { Callout } from './callout';

interface ResultCalloutProps {
  /** 강조 제목 — locale별로 MDX에서 직접 작성(예: ko "결과", en "Result"). */
  title?: string;
  children: ReactNode;
}

/** 결과/임팩트를 success 톤 callout으로 강조한다. */
export function ResultCallout({ title, children }: ResultCalloutProps) {
  return (
    <Callout type="success" title={title}>
      {children}
    </Callout>
  );
}
