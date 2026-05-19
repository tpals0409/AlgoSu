/**
 * @file       i18n.ts
 * @domain     blog
 * @layer      lib
 * @related    src/components/home-page.tsx, src/components/post-page.tsx, src/app/(adr)/layout.tsx
 *
 * i18n 인프라 — 블로그/ADR UI 문자열의 ko/en 이중 언어 사전과 유틸리티.
 *
 * - DICTIONARY: ko/en 별 정적 사전. 키 누락 시 TS 컴파일 타임 에러.
 * - t(): 정적 키 lookup. placeholder 미지원.
 * - tf(): {n}/{total} 등 단일 또는 다중 placeholder 치환 helper.
 * - getBasePath(): locale → URL prefix ('' | '/en').
 */

export type Locale = 'ko' | 'en';

const DICTIONARY = {
  ko: {
    /* ─── 기존 블로그 사전 ─────────────────────────── */
    siteTitle: 'AlgoSu Tech Blog',
    siteDescription:
      '코더를 넘어 빌더로 — 멀티 에이전트 하네스 도전기',
    noPosts: '아직 게시물이 없습니다.',
    blogHome: '블로그 홈',
    olderPost: '← 지난 글',
    newerPost: '새 글 →',
    navPostLabel: '포스트 네비게이션',
    /** 카테고리 탭 레이블 */
    categoryAll: '전체',
    categoryJourney: '프로젝트 여정',
    categoryChallenge: '기술 챌린지',
    /* ─── 블로그 → ADR 진입 (Sprint 157) ──────────── */
    navAdr: 'ADR',
    homeAdrCtaTitle: '아키텍처 결정 기록 (ADR)',
    homeAdrCtaDescription:
      '블로그 글이 인용하는 결정·구현·검증의 단일 SSOT — 105개 ADR 시각화',
    homeAdrCtaButton: 'ADR 살펴보기 →',

    /* ─── ADR 공통 ─────────────────────────────────── */
    adrTitle: 'AlgoSu ADR',
    adrSubtitle: 'AlgoSu 아키텍처 결정 기록',
    navGraph: '그래프',
    navBlog: '블로그',
    searchPlaceholder: 'ADR 검색... ( / )',
    searchAriaLabel: 'ADR 검색',
    searchEmpty: '검색 결과 없음',

    /* ─── 인덱스 통계 ──────────────────────────────── */
    statsTotal: '전체 ADR',
    statsSprintRange: 'Sprint 범위',
    statsLastUpdate: '마지막 갱신',
    statsKind: '종류',

    /* ─── kind 라벨 ────────────────────────────────── */
    kindPermanent: '영구',
    kindTopic: '토픽',
    kindSprint: 'Sprint',

    /* ─── 섹션 헤딩 ────────────────────────────────── */
    sectionPermanent: '영구 ADR',
    sectionTopic: '토픽 ADR',
    sectionSprint: 'Sprint ADR',
    sectionTimeline: 'Sprint 타임라인',
    sectionAgentDist: '에이전트 분포',

    /* ─── 인덱스 액션 ──────────────────────────────── */
    viewAll: '전체 보기 →',
    recentNofTotal: '(최근 {n}개 / 전체 {total}개)',
    countOfTotal: '({n})',

    /* ─── TOC / 메타사이드바 ──────────────────────── */
    tocLabel: '목차',
    metaSprint: 'Sprint',
    metaDate: '날짜',
    metaStatus: '상태',
    metaImpact: '영향도',
    metaReadingTime: '읽기 시간',
    metaReadingMin: '{n}분',
    metaAgents: '에이전트',
    metaRelatedAdrs: '관련 ADR',
    metaRelatedMemory: '관련 메모리',
    metaGraphSection: '관계 그래프',
    viewFullGraph: '전체 그래프 보기 →',
    viewSource: 'GitHub에서 보기 ↗',
    prevAdr: '← 이전',
    nextAdr: '다음 →',

    /* ─── 영문판 배너 ──────────────────────────────── */
    contentKoreanOnly:
      '본문은 한국어로 작성되어 있습니다. 영문판은 추후 제공될 예정입니다.',
    viewOriginalKr: '한국어 원문 보기 ↗',

    /* ─── 영향도 라벨 ──────────────────────────────── */
    impactLow: '낮음',
    impactMedium: '보통',
    impactHigh: '높음',
    impactCritical: '치명',

    /* ─── 상태 라벨 ────────────────────────────────── */
    statusCompleted: '완료',
    statusImplemented: '구현됨',
    statusAccepted: '수락',
    statusProposed: '제안',
    statusDeferred: '보류',
    statusPartial: '부분',
    statusRejected: '기각',
    statusUnknown: '미정',

    /* ─── Sprint 목록 페이지 ──────────────────────── */
    sprintsListTitle: 'Sprint ADR 전체 목록',
    graphPageTitle: 'ADR 관계 그래프',
    graphMetaDescription: 'ADR 간의 관계를 시각화한 그래프.',
    graphNodeNormal: '일반 노드',
    graphNodeHighlight: '강조 노드',
    graphEdgeResolved: '확인된 연결',
    graphEdgeUnresolved: '미확인 연결',
    graphCaption: '전체 ADR 관계 그래프 — 점선은 미확인(unresolved) 연결',
    graphNodeCount: '{n}개 노드',
    graphEdgeCount: '{n}개 연결',

    /* ─── 카테고리 탭 aria ────────────────────────── */
    adrCategoryAriaLabel: 'ADR 카테고리',

    /* ─── 타임라인 ─────────────────────────────────── */
    timelineAriaLabel: 'Sprint 타임라인 막대 그래프',

    /* ─── 코드 블록 ────────────────────────────────── */
    codeBlockCopy: '복사',
    codeBlockCopied: '복사됨',
    codeBlockCopyAriaLabel: '코드 복사',

    /* ─── ADR Hero / 결정 카드 / Phase strip ──────── */
    heroTldr: '요약',
    heroPrCount: 'PR',
    heroLines: '변경 라인',
    heroDate: '날짜',
    heroImpact: '영향도',
    decisionsTitle: '주요 결정',
    phaseStripTitle: '구현 Phase',
  },
  en: {
    /* ─── 기존 블로그 사전 ─────────────────────────── */
    siteTitle: 'AlgoSu Tech Blog',
    siteDescription:
      'Beyond Coder, Becoming a Builder — A Multi-Agent Harness Chronicle',
    noPosts: 'No posts yet.',
    blogHome: 'Blog Home',
    olderPost: '← Older',
    newerPost: 'Newer →',
    navPostLabel: 'Post navigation',
    /** Category tab labels */
    categoryAll: 'All',
    categoryJourney: 'Project Journey',
    categoryChallenge: 'Tech Challenge',
    /* ─── Blog → ADR entry (Sprint 157) ────────────── */
    navAdr: 'ADR',
    homeAdrCtaTitle: 'Architecture Decision Records (ADR)',
    homeAdrCtaDescription:
      'The single SSOT of decisions, implementations, and verifications cited by every blog post — 105 ADRs visualized',
    homeAdrCtaButton: 'Browse ADRs →',

    /* ─── ADR common ───────────────────────────────── */
    adrTitle: 'AlgoSu ADR',
    adrSubtitle: 'AlgoSu Architecture Decision Records',
    navGraph: 'Graph',
    navBlog: 'Blog',
    searchPlaceholder: 'Search ADR... ( / )',
    searchAriaLabel: 'Search ADR',
    searchEmpty: 'No results',

    /* ─── Index stats ──────────────────────────────── */
    statsTotal: 'Total ADRs',
    statsSprintRange: 'Sprint Range',
    statsLastUpdate: 'Last Updated',
    statsKind: 'Kinds',

    /* ─── kind labels ──────────────────────────────── */
    kindPermanent: 'Permanent',
    kindTopic: 'Topic',
    kindSprint: 'Sprint',

    /* ─── Section headings ─────────────────────────── */
    sectionPermanent: 'Permanent ADRs',
    sectionTopic: 'Topic ADRs',
    sectionSprint: 'Sprint ADRs',
    sectionTimeline: 'Sprint Timeline',
    sectionAgentDist: 'Agent Distribution',

    /* ─── Index actions ────────────────────────────── */
    viewAll: 'View All →',
    recentNofTotal: '(Recent {n} / Total {total})',
    countOfTotal: '({n})',

    /* ─── TOC / Meta sidebar ──────────────────────── */
    tocLabel: 'Contents',
    metaSprint: 'Sprint',
    metaDate: 'Date',
    metaStatus: 'Status',
    metaImpact: 'Impact',
    metaReadingTime: 'Reading Time',
    metaReadingMin: '{n} min',
    metaAgents: 'Agents',
    metaRelatedAdrs: 'Related ADRs',
    metaRelatedMemory: 'Related Memory',
    metaGraphSection: 'Relationship Graph',
    viewFullGraph: 'View Full Graph →',
    viewSource: 'View on GitHub ↗',
    prevAdr: '← Previous',
    nextAdr: 'Next →',

    /* ─── English banner ───────────────────────────── */
    contentKoreanOnly:
      'This ADR is written in Korean. An English version is planned.',
    viewOriginalKr: 'View Korean version ↗',

    /* ─── Impact labels ────────────────────────────── */
    impactLow: 'Low',
    impactMedium: 'Medium',
    impactHigh: 'High',
    impactCritical: 'Critical',

    /* ─── Status labels ────────────────────────────── */
    statusCompleted: 'Completed',
    statusImplemented: 'Implemented',
    statusAccepted: 'Accepted',
    statusProposed: 'Proposed',
    statusDeferred: 'Deferred',
    statusPartial: 'Partial',
    statusRejected: 'Rejected',
    statusUnknown: 'Unknown',

    /* ─── Sprint list page ─────────────────────────── */
    sprintsListTitle: 'Sprint ADR List',
    graphPageTitle: 'ADR Relationship Graph',
    graphMetaDescription: 'Visualization of relationships between ADRs.',
    graphNodeNormal: 'Normal node',
    graphNodeHighlight: 'Highlighted node',
    graphEdgeResolved: 'Resolved edge',
    graphEdgeUnresolved: 'Unresolved edge',
    graphCaption: 'Full ADR relationship graph — dashed lines are unresolved',
    graphNodeCount: '{n} nodes',
    graphEdgeCount: '{n} edges',

    /* ─── Category tabs aria ───────────────────────── */
    adrCategoryAriaLabel: 'ADR Categories',

    /* ─── Timeline ─────────────────────────────────── */
    timelineAriaLabel: 'Sprint timeline bar chart',

    /* ─── Code block ───────────────────────────────── */
    codeBlockCopy: 'Copy',
    codeBlockCopied: 'Copied',
    codeBlockCopyAriaLabel: 'Copy code',

    /* ─── ADR Hero / Decision cards / Phase strip ─── */
    heroTldr: 'Summary',
    heroPrCount: 'PRs',
    heroLines: 'Lines changed',
    heroDate: 'Date',
    heroImpact: 'Impact',
    decisionsTitle: 'Key Decisions',
    phaseStripTitle: 'Implementation Phases',
  },
} as const;

export type DictKey = keyof (typeof DICTIONARY)['ko'];

/**
 * 주어진 locale + key에 대응하는 정적 문자열을 반환한다.
 *
 * placeholder 치환이 필요하면 `tf()`를 사용한다.
 */
export function t(locale: Locale, key: DictKey): string {
  return DICTIONARY[locale][key];
}

/**
 * 사전 키를 가져온 뒤 `{name}` placeholder를 vars에 따라 치환한다.
 *
 * 예: `tf('en', 'metaReadingMin', { n: 5 })` → 'min: 5'
 *
 * 알 수 없는 placeholder는 원문 그대로 둔다 (안전한 fallback).
 *
 * @param locale - 대상 locale
 * @param key - 사전 키
 * @param vars - 치환할 변수 맵
 */
export function tf(
  locale: Locale,
  key: DictKey,
  vars: Record<string, string | number>,
): string {
  const template = DICTIONARY[locale][key];
  return template.replace(/\{(\w+)\}/g, (m, name: string) => {
    const v = vars[name];
    return v == null ? m : String(v);
  });
}

/** Returns base path for locale-aware links. */
export function getBasePath(locale: Locale): string {
  return locale === 'en' ? '/en' : '';
}
