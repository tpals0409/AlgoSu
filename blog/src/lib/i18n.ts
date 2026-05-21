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
    categoryAiAgent: 'AI 에이전트',
    categoryCicd: 'CI/CD',
    categoryArchitecture: '아키텍처',
    categoryBackend: '백엔드',
    categoryPlatform: '플랫폼',
    categoryFrontend: '프론트엔드',
    categoryRetrospective: '회고',
    /* ─── 블로그 → ADR 진입 (Sprint 157) ──────────── */
    navAdr: 'ADR',
    homeAdrCtaTitle: '아키텍처 결정 기록 (ADR)',
    homeAdrCtaDescription:
      '블로그 글이 인용하는 결정·구현·검증의 단일 SSOT — {n}개 ADR 시각화',
    homeAdrCtaButton: 'ADR 살펴보기 →',
    homeAdrCtaWhy: '문제 → 선택지 → 결정 → 검증 결과를 남긴 의사결정 기록',

    /* ─── 홈 랜딩 Hero (Sprint 185) ────────────────── */
    heroBadge: '실제 운영 중인 AI Agent 서비스',
    heroTitle: 'AlgoSu Tech Blog',
    heroSubcopy:
      '1인 개발자가 만든 AI Agent 기반 알고리즘 스터디 플랫폼의 개발·운영 기록. 12-agent 오케스트레이션, k3s 운영, CI/CD, ADR, production debugging까지 — 실제 사용자가 있는 서비스를 만들며 겪은 문제와 의사결정을 기록합니다.',
    heroCtaStartHere: '처음 읽기 좋은 글',
    heroCtaAdr: 'ADR 보기',
    heroCtaService: 'AlgoSu 서비스 보기',

    /* ─── 홈 성과 지표 카드 (Sprint 185) ──────────── */
    metricsTitle: '한눈에 보는 AlgoSu',
    metricUsersLabel: 'Active Users',
    metricUsersDesc: '실제 사용자가 있는 운영 서비스',
    metricAgentsLabel: 'AI Agents',
    metricAgentsDesc: '멀티 에이전트 오케스트레이션',
    metricServicesLabel: 'Microservices',
    metricServicesDesc: '서비스 경계 기반 아키텍처',
    metricCiLabel: 'CI/CD Jobs',
    metricCiDesc: 'AI 생성 코드 검증 파이프라인',
    metricAdrsLabel: 'ADRs',
    metricAdrsDesc: '의사결정·운영 기록의 SSOT',
    metricIterationLabel: 'Zero-downtime',
    metricIterationDesc: '운영 중 빠른 반복 개선',

    /* ─── 홈 StartHere / 최근 글 (Sprint 185) ─────── */
    startHereTitle: '처음 오셨다면, 이 글부터',
    startHereSubtitle: '대표 글로 AlgoSu의 핵심을 빠르게 파악하세요.',
    startHereWhy1: '12개 에이전트 오케스트레이션 구조를 보여주는 글',
    startHereWhy2: 'AI 생성 코드를 프로덕션에 올리는 검증 전략',
    startHereWhy3: 'Agent 컨텍스트 비대화를 sliding window로 해결한 기록',
    startHereWhy4: '교차 AI 검증(Critic)으로 모델 종속을 끊어낸 과정',
    recentPostsTitle: '최근 글',

    /* ─── ADR 랜딩 큐레이션 (Sprint 186) ──────────── */
    adrLandingHeroTitle: '왜 이렇게 만들었나',
    adrLandingHeroSubtitle:
      '실제 운영 중인 서비스에서 내린 아키텍처·운영 의사결정을 문제 → 선택지 → 결정 → 검증 순으로 기록합니다. 처음이라면 아래 대표 ADR부터 읽어보세요.',
    adrHowToReadTitle: 'ADR 읽는 법',
    adrStep1Title: '문제',
    adrStep1Desc: '어떤 상황·제약이 결정을 강제했는가',
    adrStep2Title: '선택지',
    adrStep2Desc: '고려한 대안과 트레이드오프',
    adrStep3Title: '결정',
    adrStep3Desc: '무엇을 왜 선택했는가',
    adrStep4Title: '검증',
    adrStep4Desc: '결정이 의도대로 작동했는지 확인한 결과',
    adrFeaturedTitle: '대표 ADR',
    adrFeaturedSubtitle: 'AlgoSu 시스템을 이해하는 데 가장 중요한 결정들',
    adrFeaturedWhyLabel: '왜 읽어야 하나',
    adrFeaturedWhy1: 'Gateway에서 인증 DB를 분리해 서비스별 DB 경계를 세운 출발점',
    adrFeaturedWhy2: '서비스 간 메시지 유실 없이 이벤트를 전달하는 Outbox 패턴',
    adrFeaturedWhy3: '롤아웃이 멈춘 운영 장애를 복구하고 SealedSecret 부채를 갚은 회고',
    adrFeaturedWhy4: 'GitOps에서 자동 배포를 안전하게 막는 브랜치 규율',
    adrFeaturedWhy5: '운영과 개발 클러스터를 분리해 실험이 운영을 깨지 않게 한 결정',
    adrTopicsTitle: '주제별로 보기',
    adrTopicsSubtitle: '관심 주제부터 깊이 들어가세요.',
    adrTopicOpsTitle: '운영 장애 & 복구',
    adrTopicOpsDesc: '실제 프로덕션 장애와 그 복구·재발 방지 결정',
    adrTopicAgentsTitle: 'Agent 오케스트레이션',
    adrTopicAgentsDesc: '멀티 에이전트 디스패치·교차 리뷰 워크플로우의 진화',
    adrTopicCicdTitle: 'CI · GitOps',
    adrTopicCicdDesc: 'AI 생성 코드 검증 파이프라인과 GitOps 배포 규율',
    adrTopicDataTitle: 'Data & 문제셋',
    adrTopicDataDesc: '데이터 경계·문제 데이터셋·이벤트 전달 결정',
    adrTopicSecurityTitle: '보안 & 시크릿',
    adrTopicSecurityDesc: '인증·ACL·시크릿 관리 등 보안 결정',
    adrTopicProductTitle: '제품 & 플랫폼',
    adrTopicProductDesc: '사용자 기능·플랫폼 이전 등 제품 결정',
    adrGraphCtaTitle: 'ADR 관계 그래프',
    adrGraphCtaDesc: 'ADR이 서로 어떻게 연결되는지 그래프로 탐색하세요.',
    adrGraphCtaButton: '그래프 열기 →',
    adrArchiveCtaTitle: '전체 ADR 아카이브',
    adrArchiveCtaDesc: '{n}개 ADR 전체 — 통계·타임라인·종류별 목록',
    adrArchiveCtaButton: '전체 보기 →',
    adrArchiveTitle: '전체 ADR 아카이브',
    adrArchiveBackToCurated: '← ADR 큐레이션',

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
    graphNodeHighlight: '강조 노드',
    graphEdgeResolved: '확인된 연결',
    graphEdgeUnresolved: '미확인 연결',
    graphCaption: '전체 ADR 관계 그래프 — 점선은 미확인(unresolved) 연결',
    graphNodeCount: '{n}개 노드',
    graphEdgeCount: '{n}개 연결',
    graphFiltersTitle: '필터',
    graphFilterKindLabel: '노드 종류',
    graphKindPermanent: '영구 ADR',
    graphKindSprint: 'Sprint ADR',
    graphKindTopic: '주제 ADR',
    graphFilterEdgeLabel: '연결',
    graphLegendTitle: '범례',
    graphNodeMeaning: '노드 = ADR 문서 (종류별 색상)',
    graphEdgeMeaning:
      '엣지 = ADR 간 참조 — 실선은 대상 존재, 점선은 미해결 참조',

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

    /* ─── ADR Lessons / Carryover callout ─────────── */
    lessonsTitle: '교훈',
    carryoverTitle: '이월 항목',
    carryoverSprintPrefix: 'Sprint',

    /* ─── 글 상세 포트폴리오화 (Sprint 187 Phase 3) ── */
    postTldrLabel: 'TL;DR',
    relatedAdrsTitle: '관련 ADR',
    relatedAdrsSubtitle: '이 글의 결정이 기록된 의사결정 문서',
    relatedPostsTitle: '관련 글',

    /* ─── About 페이지 + Footer (Sprint 188 Phase 4) ── */
    navAbout: '소개',
    aboutName: '김세민',
    aboutRole: 'Agentic AI Engineer & Builder',
    aboutTagline: '방관자가 아닌 실행자입니다',
    aboutIntro1:
      '트렌드를 관찰하는 데 그치지 않고 직접 만들며 배웁니다. 실제 사용자가 있는 서비스를 1인으로 설계·개발·운영하면서 마주친 문제와 의사결정을 기록으로 남깁니다.',
    aboutIntro2:
      'AI 에이전트 기반 end-to-end 프로덕션 시스템, 리소스 제약 환경에서의 아키텍처 설계 결정, DevOps·CI/CD 자동화에 깊은 관심이 있습니다. 대표 작업물 AlgoSu는 AI 코드 리뷰·12개 에이전트 페르소나·자동화된 CI/CD 파이프라인을 갖춘 알고리즘 스터디 플랫폼입니다.',
    aboutSkillsTitle: '핵심 역량',
    aboutSkillBackend: 'Backend',
    aboutSkillAi: 'AI & LLM',
    aboutSkillInfra: 'Infrastructure',
    aboutSkillData: 'Data',
    aboutSkillFrontend: 'Frontend',
    aboutCtaGithub: 'GitHub 프로필',
    footerCopyright: '© {year} 김세민 · AlgoSu Tech',
    footerService: 'AlgoSu 서비스',
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
    categoryAiAgent: 'AI Agent',
    categoryCicd: 'CI/CD',
    categoryArchitecture: 'Architecture',
    categoryBackend: 'Backend',
    categoryPlatform: 'Platform',
    categoryFrontend: 'Frontend',
    categoryRetrospective: 'Retrospective',
    /* ─── Blog → ADR entry (Sprint 157) ────────────── */
    navAdr: 'ADR',
    homeAdrCtaTitle: 'Architecture Decision Records (ADR)',
    homeAdrCtaDescription:
      'The single SSOT of decisions, implementations, and verifications cited by every post — {n} ADRs visualized',
    homeAdrCtaButton: 'Browse ADRs →',
    homeAdrCtaWhy: 'A decision log of problem → options → decision → verification',

    /* ─── Home landing hero (Sprint 185) ───────────── */
    heroBadge: 'A live AI-agent service',
    heroTitle: 'AlgoSu Tech Blog',
    heroSubcopy:
      'The build & ops log of an AI-agent algorithm-study platform built by a solo developer. From 12-agent orchestration, k3s ops, CI/CD, and ADRs to production debugging — the problems and decisions behind a service with real users.',
    heroCtaStartHere: 'Start Here',
    heroCtaAdr: 'Browse ADRs',
    heroCtaService: 'Visit AlgoSu',

    /* ─── Home metric cards (Sprint 185) ───────────── */
    metricsTitle: 'AlgoSu at a glance',
    metricUsersLabel: 'Active Users',
    metricUsersDesc: 'A service with real users in production',
    metricAgentsLabel: 'AI Agents',
    metricAgentsDesc: 'Multi-agent orchestration',
    metricServicesLabel: 'Microservices',
    metricServicesDesc: 'Service-boundary architecture',
    metricCiLabel: 'CI/CD Jobs',
    metricCiDesc: 'Validation pipeline for AI-generated code',
    metricAdrsLabel: 'ADRs',
    metricAdrsDesc: 'The SSOT of decisions & ops records',
    metricIterationLabel: 'Zero-downtime',
    metricIterationDesc: 'Fast iteration without downtime',

    /* ─── Home StartHere / recent posts (Sprint 185) ─ */
    startHereTitle: 'New here? Start with these',
    startHereSubtitle: 'Grasp the core of AlgoSu through a few signature posts.',
    startHereWhy1: 'How a 12-agent orchestration is structured',
    startHereWhy2: 'The strategy for shipping AI-generated code to production',
    startHereWhy3: 'Taming agent-context growth with a sliding window',
    startHereWhy4: 'Breaking model lock-in with cross-AI review (Critic)',
    recentPostsTitle: 'Recent Posts',

    /* ─── ADR landing curation (Sprint 186) ────────── */
    adrLandingHeroTitle: 'Why it was built this way',
    adrLandingHeroSubtitle:
      'Every architecture and operations decision made on a live production service — recorded as problem → options → decision → verification. New here? Start with the featured ADRs below.',
    adrHowToReadTitle: 'How to read an ADR',
    adrStep1Title: 'Problem',
    adrStep1Desc: 'What situation or constraint forced the decision',
    adrStep2Title: 'Options',
    adrStep2Desc: 'Alternatives considered and their trade-offs',
    adrStep3Title: 'Decision',
    adrStep3Desc: 'What was chosen, and why',
    adrStep4Title: 'Verification',
    adrStep4Desc: 'How we confirmed the decision worked as intended',
    adrFeaturedTitle: 'Featured ADRs',
    adrFeaturedSubtitle: 'The decisions that matter most for understanding AlgoSu',
    adrFeaturedWhyLabel: 'Why read this',
    adrFeaturedWhy1:
      'Where service-level DB boundaries began — splitting the identity DB out of the gateway',
    adrFeaturedWhy2: 'The Outbox pattern that delivers events across services without loss',
    adrFeaturedWhy3:
      'Recovering from a stuck-rollout production incident and paying off SealedSecret debt',
    adrFeaturedWhy4: 'Branch discipline that keeps GitOps auto-deploys safe',
    adrFeaturedWhy5: 'Separating prod and dev clusters so experiments never break production',
    adrTopicsTitle: 'Browse by topic',
    adrTopicsSubtitle: 'Go deep on the topics you care about.',
    adrTopicOpsTitle: 'Operations & Recovery',
    adrTopicOpsDesc:
      'Real production incidents and the decisions that recovered and prevented them',
    adrTopicAgentsTitle: 'Agent Orchestration',
    adrTopicAgentsDesc: 'How the multi-agent dispatch and cross-review workflow evolved',
    adrTopicCicdTitle: 'CI · GitOps',
    adrTopicCicdDesc: 'AI-generated code verification pipelines and GitOps deploy discipline',
    adrTopicDataTitle: 'Data & Problem Sets',
    adrTopicDataDesc: 'Data boundaries, problem datasets, and event delivery decisions',
    adrTopicSecurityTitle: 'Security & Secrets',
    adrTopicSecurityDesc: 'Auth, ACL, and secret management decisions',
    adrTopicProductTitle: 'Product & Platform',
    adrTopicProductDesc: 'User-facing features and platform migration decisions',
    adrGraphCtaTitle: 'ADR Relationship Graph',
    adrGraphCtaDesc: 'Explore how ADRs connect to each other as a graph.',
    adrGraphCtaButton: 'Open graph →',
    adrArchiveCtaTitle: 'Full ADR Archive',
    adrArchiveCtaDesc: 'All {n} ADRs — stats, timeline, and lists by kind',
    adrArchiveCtaButton: 'View all →',
    adrArchiveTitle: 'Full ADR Archive',
    adrArchiveBackToCurated: '← ADR overview',

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
    graphNodeHighlight: 'Highlighted node',
    graphEdgeResolved: 'Resolved edge',
    graphEdgeUnresolved: 'Unresolved edge',
    graphCaption: 'Full ADR relationship graph — dashed lines are unresolved',
    graphNodeCount: '{n} nodes',
    graphEdgeCount: '{n} edges',
    graphFiltersTitle: 'Filters',
    graphFilterKindLabel: 'Node type',
    graphKindPermanent: 'Permanent',
    graphKindSprint: 'Sprint',
    graphKindTopic: 'Topic',
    graphFilterEdgeLabel: 'Edges',
    graphLegendTitle: 'Legend',
    graphNodeMeaning: 'Node = an ADR document (colored by type)',
    graphEdgeMeaning:
      'Edge = a reference between ADRs — solid means the target exists, dashed means unresolved',

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

    /* ─── ADR Lessons / Carryover callout ─────────── */
    lessonsTitle: 'Lessons Learned',
    carryoverTitle: 'Carryover',
    carryoverSprintPrefix: 'Sprint',

    /* ─── Post detail portfolio (Sprint 187 Phase 3) ── */
    postTldrLabel: 'TL;DR',
    relatedAdrsTitle: 'Related ADRs',
    relatedAdrsSubtitle: 'Decision records behind this post',
    relatedPostsTitle: 'Related Posts',

    /* ─── About page + Footer (Sprint 188 Phase 4) ── */
    navAbout: 'About',
    aboutName: 'Semin Kim',
    aboutRole: 'Agentic AI Engineer & Builder',
    aboutTagline: 'Not an observer, but a doer',
    aboutIntro1:
      'I learn by building, not just watching trends. As a solo developer, I design, build, and operate a service with real users — and document the problems and decisions I meet along the way.',
    aboutIntro2:
      'I care deeply about end-to-end production systems powered by AI agents, architecture decisions under tight resource constraints, and DevOps/CI-CD automation. My flagship project, AlgoSu, is an algorithm-study platform with AI code review, 12 agent personas, and an automated CI/CD pipeline.',
    aboutSkillsTitle: 'Core Skills',
    aboutSkillBackend: 'Backend',
    aboutSkillAi: 'AI & LLM',
    aboutSkillInfra: 'Infrastructure',
    aboutSkillData: 'Data',
    aboutSkillFrontend: 'Frontend',
    aboutCtaGithub: 'GitHub Profile',
    footerCopyright: '© {year} Semin Kim · AlgoSu Tech',
    footerService: 'AlgoSu Service',
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
