/**
 * @file       pdr.tsx
 * @domain     blog
 * @layer      ui
 * @related    src/components/mdx-components.tsx, src/components/blog/result-callout.tsx
 *
 * 포트폴리오형 글 본문 구조 컴포넌트 — Problem / Decision / Result 3단계.
 * 각 단계는 eyebrow 라벨 + 좌측 액센트 보더로 본문 섹션을 도입한다.
 * 첫 방문자가 본문을 다 읽지 않아도 문제 → 결정 → 결과 흐름을 빠르게 스캔하게 한다.
 * 색 톤은 기존 callout 토큰을 재사용한다(Problem=warn, Decision=info, Result=success).
 *
 * 라벨은 Callout의 title 패턴과 동일하게 MDX에서 per-locale로 직접 작성한다
 * (ko 파일 "문제", en 파일 "Problem"). 누락 시 영문 canonical을 기본값으로 쓴다.
 */
import type { ReactNode } from 'react';

/** 포트폴리오 글의 3단계 내러티브 위상. */
type PdrPhase = 'problem' | 'decision' | 'result';

interface PdrSectionProps {
  /** eyebrow 라벨 — locale별로 MDX에서 직접 작성. 누락 시 phase 영문 기본값. */
  label?: string;
  children: ReactNode;
}

/** phase별 시각 토큰 — callout 색 토큰 재사용. */
const PHASE_STYLE: Record<
  PdrPhase,
  { accent: string; label: string; defaultLabel: string }
> = {
  problem: {
    accent: 'border-callout-warn-border',
    label: 'text-callout-warn-fg',
    defaultLabel: 'Problem',
  },
  decision: {
    accent: 'border-callout-info-border',
    label: 'text-callout-info-fg',
    defaultLabel: 'Decision',
  },
  result: {
    accent: 'border-callout-success-border',
    label: 'text-callout-success-fg',
    defaultLabel: 'Result',
  },
};

/** 단일 PDR 섹션을 eyebrow 라벨 + 좌측 액센트 밴드로 렌더한다. */
function PdrSection({
  phase,
  label,
  children,
}: PdrSectionProps & { phase: PdrPhase }) {
  const s = PHASE_STYLE[phase];
  return (
    <section className={`my-8 border-l-2 pl-5 ${s.accent}`}>
      <p
        className={`mb-2 text-xs font-semibold uppercase tracking-[0.18em] not-prose ${s.label}`}
      >
        {label ?? s.defaultLabel}
      </p>
      {children}
    </section>
  );
}

/** 문제 정의 섹션 — 글이 다루는 핵심 문제를 도입한다. */
export function Problem(props: PdrSectionProps) {
  return <PdrSection phase="problem" {...props} />;
}

/** 결정 섹션 — 문제에 대한 핵심 의사결정을 도입한다. */
export function Decision(props: PdrSectionProps) {
  return <PdrSection phase="decision" {...props} />;
}

/** 결과 섹션 — 결정이 가져온 결과·트레이드오프를 도입한다. */
export function Result(props: PdrSectionProps) {
  return <PdrSection phase="result" {...props} />;
}
