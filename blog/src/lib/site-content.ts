/**
 * @file       site-content.ts
 * @domain     blog
 * @layer      lib
 * @related    src/lib/i18n.ts, src/components/home/metric-card.tsx,
 *             src/components/home/start-here-section.tsx, src/components/home/home-hero.tsx
 *
 * 홈 랜딩 큐레이션 SSOT (Sprint 185 Phase 1).
 * 성과 지표·StartHere 추천 글·외부 링크를 한곳에서 관리한다.
 * 표시 텍스트(라벨/설명/why-read)는 i18n DICTIONARY 키로만 참조해
 * ko/en 동시 현지화를 보장한다. 수치 값은 실데이터 확인분만 사용한다(과장 금지).
 */
import type { DictKey } from '@/lib/i18n';

/** AlgoSu 운영 서비스 진입 URL — Hero CTA. */
export const ALGOSU_SERVICE_URL = 'https://algo-su.com/';

/**
 * 홈 성과 지표 카드 1종.
 * `value`가 null이면 동적 계산(예: ADR 총 개수)을 소비처에서 주입한다.
 */
export interface HomeMetric {
  id: string;
  /** 표시 수치. null이면 소비처에서 런타임 값을 주입(stale 방지). */
  value: string | null;
  /** i18n 제목 키 (영문 라벨 — ko/en 공통 표기). */
  labelKey: DictKey;
  /** i18n 한 줄 설명 키 (locale별 현지화). */
  descKey: DictKey;
}

/**
 * 홈 성과 지표 6종 — 전부 저장소 실데이터 검증분(Sprint 185).
 * adrs.value=null: 빌드타임 ADR 인덱스에서 실제 개수를 주입(105 하드코딩 stale 재발 차단).
 */
export const HOME_METRICS: readonly HomeMetric[] = [
  { id: 'users', value: '20+', labelKey: 'metricUsersLabel', descKey: 'metricUsersDesc' },
  { id: 'agents', value: '12', labelKey: 'metricAgentsLabel', descKey: 'metricAgentsDesc' },
  { id: 'services', value: '6', labelKey: 'metricServicesLabel', descKey: 'metricServicesDesc' },
  { id: 'ci', value: '23', labelKey: 'metricCiLabel', descKey: 'metricCiDesc' },
  { id: 'adrs', value: null, labelKey: 'metricAdrsLabel', descKey: 'metricAdrsDesc' },
  { id: 'iteration', value: '∞', labelKey: 'metricIterationLabel', descKey: 'metricIterationDesc' },
] as const;

/** StartHere 추천 글 1종 — 글 메타는 slug로 조회, why-read만 i18n. */
export interface StartHerePost {
  /** content/posts(-en) 의 .mdx slug. */
  slug: string;
  /** i18n "왜 읽어야 하나" 한 줄 키. */
  whyKey: DictKey;
}

/**
 * StartHere 추천 4글 (Sprint 185 사용자 확정).
 * 첫 방문자가 전체 목록 없이 대표 글로 진입하도록 큐레이션.
 */
export const START_HERE_POSTS: readonly StartHerePost[] = [
  { slug: 'orchestration-structure', whyKey: 'startHereWhy1' },
  { slug: 'cicd-ai-guardrails', whyKey: 'startHereWhy2' },
  { slug: 'sliding-window-agent-context', whyKey: 'startHereWhy3' },
  { slug: 'toward-model-agnostic-harness', whyKey: 'startHereWhy4' },
] as const;
