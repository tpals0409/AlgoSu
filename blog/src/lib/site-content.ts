/**
 * @file       site-content.ts
 * @domain     blog
 * @layer      lib
 * @related    src/lib/i18n.ts, src/components/home/metric-card.tsx,
 *             src/components/home/start-here-section.tsx, src/components/home/home-hero.tsx,
 *             src/components/adr/adr-landing-view.tsx
 *
 * 홈 랜딩 + ADR 랜딩 큐레이션 SSOT (Sprint 185 Phase 1 / Sprint 186 Phase 2).
 * 성과 지표·StartHere 추천 글·외부 링크·대표 ADR·주제 컬렉션을 한곳에서 관리한다.
 * 표시 텍스트(라벨/설명/why-read)는 i18n DICTIONARY 키로만 참조해
 * ko/en 동시 현지화를 보장한다. 수치 값은 실데이터 확인분만 사용한다(과장 금지).
 * ADR 참조는 AdrMeta.id로 한다(permanent: 'ADR-001', sprint: 'sprint-130', topic: slug).
 */
import type { DictKey } from '@/lib/i18n';

/** AlgoSu 운영 서비스 진입 URL — Hero CTA. */
export const ALGOSU_SERVICE_URL = 'https://algo-su.com/';

/** AlgoSu 운영자 GitHub 프로필 — About/Footer 외부 링크 (Sprint 188 Phase 4). */
export const GITHUB_URL = 'https://github.com/tpals0409';

/**
 * About 핵심 역량 그룹 1종.
 * 그룹 라벨은 i18n 키로 참조하고, 기술명은 제품/프레임워크 고유명사라
 * locale 무관 plain 배열로 둔다(번역 대상 아님).
 */
export interface AboutSkillGroup {
  id: string;
  /** i18n 그룹 라벨 키 (Backend / AI & LLM 등). */
  labelKey: DictKey;
  /** 기술명 목록 — 고유명사라 ko/en 공통 표기. */
  items: readonly string[];
}

/**
 * About 핵심 역량 5종 (Sprint 188 Phase 4, portfolio.leo0409.work 기준).
 * 기술명은 고유명사라 번역하지 않고 그대로 표기한다.
 */
export const ABOUT_SKILL_GROUPS: readonly AboutSkillGroup[] = [
  {
    id: 'backend',
    labelKey: 'aboutSkillBackend',
    items: ['FastAPI', 'NestJS', 'Saga Pattern', 'Circuit Breaker', 'MSA'],
  },
  {
    id: 'ai',
    labelKey: 'aboutSkillAi',
    items: ['AI Agent', 'AI Orchestration', 'Prompt Engineering', 'LoRA', 'LLM Evaluation'],
  },
  {
    id: 'infra',
    labelKey: 'aboutSkillInfra',
    items: ['Docker', 'ArgoCD', 'GitHub Actions', 'n8n', 'k3s', 'Prometheus', 'Grafana', 'Loki'],
  },
  {
    id: 'data',
    labelKey: 'aboutSkillData',
    items: ['PostgreSQL', 'Redis', 'RabbitMQ'],
  },
  {
    id: 'frontend',
    labelKey: 'aboutSkillFrontend',
    items: ['Next.js', 'React', 'Tailwind CSS'],
  },
] as const;

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

/* ─── ADR 랜딩 큐레이션 (Sprint 186 Phase 2) ──────────────── */

/**
 * "ADR 읽는 법" 단계 1종 — 문제 → 선택지 → 결정 → 검증 프레임.
 * 제목/설명은 i18n 키로만 참조.
 */
export interface AdrReadingStep {
  /** i18n 단계 제목 키. */
  titleKey: DictKey;
  /** i18n 단계 설명 키. */
  descKey: DictKey;
}

/** ADR 읽는 법 4단계 (Sprint 186) — Hero 하단 안내. */
export const ADR_READING_STEPS: readonly AdrReadingStep[] = [
  { titleKey: 'adrStep1Title', descKey: 'adrStep1Desc' },
  { titleKey: 'adrStep2Title', descKey: 'adrStep2Desc' },
  { titleKey: 'adrStep3Title', descKey: 'adrStep3Desc' },
  { titleKey: 'adrStep4Title', descKey: 'adrStep4Desc' },
] as const;

/**
 * 대표 ADR 1종 — 큐레이션 진입점 상단 강조.
 * 제목·한 줄 요약은 AdrMeta(title/tldr)로 조회, "왜 읽어야 하나"만 i18n.
 */
export interface FeaturedAdr {
  /** AdrMeta.id (permanent: 'ADR-001'). */
  id: string;
  /** i18n "왜 읽어야 하나" 한 줄 키. */
  whyKey: DictKey;
}

/**
 * 대표 ADR 5종 (Sprint 186 사용자 확정) — AlgoSu 시스템 진화의 핵심 결정.
 * 첫 방문자가 전체 목록 없이 대표 ADR로 진입하도록 큐레이션.
 */
export const FEATURED_ADRS: readonly FeaturedAdr[] = [
  { id: 'ADR-001', whyKey: 'adrFeaturedWhy1' },
  { id: 'ADR-002', whyKey: 'adrFeaturedWhy2' },
  { id: 'ADR-026', whyKey: 'adrFeaturedWhy3' },
  { id: 'ADR-027', whyKey: 'adrFeaturedWhy4' },
  { id: 'ADR-028', whyKey: 'adrFeaturedWhy5' },
] as const;

/**
 * 주제별 ADR 컬렉션 1종 — 관심 주제로 ADR 진입.
 * 멤버는 frontmatter topics 필드 기반 빌드타임 자동 집계로 결정한다.
 * Sprint 186 4주제 → Sprint 189 frontmatter 자동분류 6주제.
 */
export interface AdrTopic {
  /** 안정 식별자 (key/anchor 용). */
  id: string;
  /** i18n 주제 제목 키. */
  titleKey: DictKey;
  /** i18n 주제 설명 키. */
  descKey: DictKey;
}

/**
 * ADR 주제 카탈로그 6종 (Sprint 189 D2 frontmatter 자동분류).
 * 각 주제의 멤버는 KR ADR frontmatter topics 필드로 결정하며,
 * 소비처에서 filterAdrsByTopic()으로 빌드타임 집계한다.
 */
export const ADR_TOPICS: readonly AdrTopic[] = [
  {
    id: 'operations',
    titleKey: 'adrTopicOpsTitle',
    descKey: 'adrTopicOpsDesc',
  },
  {
    id: 'agents',
    titleKey: 'adrTopicAgentsTitle',
    descKey: 'adrTopicAgentsDesc',
  },
  {
    id: 'cicd',
    titleKey: 'adrTopicCicdTitle',
    descKey: 'adrTopicCicdDesc',
  },
  {
    id: 'data',
    titleKey: 'adrTopicDataTitle',
    descKey: 'adrTopicDataDesc',
  },
  {
    id: 'security',
    titleKey: 'adrTopicSecurityTitle',
    descKey: 'adrTopicSecurityDesc',
  },
  {
    id: 'product',
    titleKey: 'adrTopicProductTitle',
    descKey: 'adrTopicProductDesc',
  },
] as const;
