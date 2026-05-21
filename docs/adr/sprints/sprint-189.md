---
sprint: 189
title: "블로그 UI/UX 개편 — 그래프 범례·필터 + 카테고리 7분류 + ADR 주제 자동분류 (Phase 5)"
date: "2026-05-21"
status: completed
agents: [Oracle, Herald, Architect, Palette, Critic, Scribe]
related_adrs: ["sprint-188", "sprint-187", "sprint-186", "sprint-185"]
related_memory: ["sprint-window", "feedback-blog-workflow"]
topics: ["product"]
tldr: "5 Phase 블로그 개편 완성 — 글 카테고리 7분류·ADR 주제 frontmatter 자동분류(KR SSOT+EN 주입)·그래프 범례/필터(WCAG AA)로 포트폴리오 탐색 UI를 완결했다."
---
# Sprint 189 — 블로그 UI/UX 개편 — 그래프 범례·필터 + 카테고리 7분류 + ADR 주제 자동분류 (Phase 5)

## 목표

- 기술 블로그를 "포트폴리오형"으로 전환하는 5 Phase 개편(사용자 `/goal` 플랜)의 **Phase 5(마지막)**. ADR 그래프 범례/필터, 글 카테고리 7분류, ADR 주제 frontmatter 자동분류로 포트폴리오 탐색 UI를 완결한다.
- 방문자가 블로그 글을 장르별로 걸러 볼 수 있고, ADR을 주제별로 탐색하며, 그래프에서 노드/엣지의 의미를 한 눈에 파악할 수 있게 한다.
- 기존 라우트는 **무파괴**. KO+EN 동시. Phase 1(Sprint 185) Engineering Editorial 디자인 시스템 위에서 작업한다.

## 결정

### D1. 글 카테고리 2분류 → 7분류 + 동적 탭 렌더 (Herald)

기존 category 2분류(journey/challenge)를 **7분류**(ai-agent/cicd/architecture/backend/platform/frontend/retrospective)로 교체한다. `posts.ts`에 `VALID_CATEGORIES` 상수 + fallback 로직을 두고, `category-tabs`는 **글이 1편 이상 존재하는 카테고리만 동적 렌더**(빈 frontend 탭 graceful skip)한다. `post-list-with-filter`는 `availableCategories` useMemo로 필터 상태를 관리한다. i18n ko+en 7키. 기존 글 10편×2 locale frontmatter 재분류. `check-blog-crosscheck`의 VALID_CATEGORIES enum을 7분류로 동기화하고 SSOT 주석을 추가해 향후 enum 불일치를 방지한다.

### D2. ADR 주제 frontmatter 자동분류 = KR SSOT + loader EN 주입 (Architect)

ADR 주제 분류를 `AdrMeta.topics`(배열) frontmatter로 선언하고, `loader`가 EN locale ADR의 KR topics를 **빌드타임에 주입**한다(EN frontmatter 직접 수정 불필요 → 중복/드리프트 구조적 차단). `resolveTopics` 파서, `filterAdrsByTopic`(date desc) 인덱스 빌더, `site-content` `ADR_TOPICS` 6주제 카탈로그(기존 4+신규 security/product 2)로 확장한다. `adrIds` 하드코딩을 제거하고 frontmatter 집계로 전환한다. KR frontmatter 백필 15파일(영구 ADR 8개 frontmatter 신규삽입 + sprint/topic 7개 병합, multi-topic 지원: ADR-003/ADR-025=operations+security, sprint-95-programmers-dataset=data+product). `check-adr-conversion` F11/F12 fixture 추가.

### D3. ADR 그래프 범례·필터 + WCAG AA 색상 (Palette)

`filterAdjacency` 순수 헬퍼 + `adr-graph-view`를 server→**client 컴포넌트**로 전환(필터 상태 `activeKinds`/`showResolved`/`showUnresolved`). 필터 UI는 kind 3토글(sprint/topic/permanent) + 엣지 2토글(resolved/unresolved), role=checkbox 접근성. 범례는 kind 3색 스와치 + 의미 설명. `related-adr-graph`에 `KIND_COLORS`로 노드 kind 색상을 적용한다. i18n ko+en 11키. 보강(e1e9d70): `filterAdjacency` unresolved 엣지 버그 수정(`toOk = resolved ? has(to) : true`) + **WCAG AA** 색상(sprint `#0e7490` 5.35:1 / topic `#7c3aed` 5.71:1 / permanent `#2347e6` 6.75:1, 모두 흰 텍스트 4.5:1+) + orphan `graphNodeNormal` 키 제거.

## 구현

### 구현 커밋 (5커밋, 51파일 +654/-99)

- `9eeeff0` feat — 글 카테고리 7분류 교체 (KO+EN 동시)
- `3dc780c` chore — check-blog-crosscheck category enum 7분류 동기화 + SSOT 주석
- `28156b6` feat — Sprint 189 D2 ADR 주제 frontmatter 자동 분류 (KO+EN)
- `1c297da` feat — ADR 관계 그래프 범례·필터 강화 (KO+EN)
- `e1e9d70` fix — Critic 발견 3건 수정 (그래프 필터 버그 + WCAG AA + orphan 키)

변경 주요 파일:

**D1 (Herald)**:
- `blog/src/lib/posts.ts` — `VALID_CATEGORIES` 7분류 상수 + `PostMeta.category` 타입 갱신 + fallback
- `blog/src/components/category-tabs.tsx` — 동적 렌더(availableCategories 기반, 빈 탭 graceful skip)
- `blog/src/components/post-list-with-filter.tsx` — availableCategories useMemo
- `blog/src/components/post-card.tsx` — 배지 7분류
- `blog/src/lib/i18n.ts` — category 7키 ko+en 추가
- `blog/content/posts/`·`posts-en/` 10편×2 — frontmatter category 재분류
- `scripts/check-blog-crosscheck.mjs` — VALID_CATEGORIES enum 7분류 동기화 + SSOT 주석

**D2 (Architect)**:
- `blog/src/lib/adr-parser.ts` — `resolveTopics` + `AdrMeta.topics`
- `blog/src/lib/adr-loader.ts` — EN locale topics KR 주입(빌드타임)
- `blog/src/lib/adr-index-builder.ts` — `filterAdrsByTopic`(date desc)
- `blog/src/lib/site-content.ts` — `ADR_TOPICS` 6주제(`adrIds` 제거 → frontmatter 집계) + security/product 신규
- `blog/src/lib/i18n.ts` — ADR 주제 ko+en 4키
- `blog/src/components/adr-topic-collections.tsx` — frontmatter 집계 전환
- `blog/content/adr/`·`adr-en/` frontmatter 백필 15파일 (영구 ADR 8개 + sprint/topic 7개)
- `scripts/check-adr-conversion.mjs` — F11/F12 fixture 추가

**D3 (Palette)**:
- `blog/src/lib/adr-graph.ts` — `filterAdjacency` 순수 헬퍼 + KIND_COLORS
- `blog/src/components/adr-graph-view.tsx` — server→client, 필터 상태(activeKinds/showResolved/showUnresolved), 필터 UI, 범례
- `blog/src/components/related-adr-graph.tsx` — KIND_COLORS 노드 kind 색상
- `blog/src/lib/i18n.ts` — 그래프 범례/필터 ko+en 11키

## Critic 사이클

- **D1 wave auto-critic** — `codex review --base main` **0건**. 카테고리 enum 타입 안전, graceful skip 구현, EN 한국어 잔류 없음.
- **D2 wave auto-critic** — `codex review --base main` **0건**. loader KR→EN topics 주입, filterAdrsByTopic 인덱스, fixture 추가 모두 이상 없음.
- **D3 wave auto-critic (1R)** — `codex review --base main` **3건 발견**:
  - P1: `filterAdjacency` unresolved 엣지의 `to` 노드 미포함 버그 (toOk 로직 오류)
  - P2: 색상 WCAG AA 미달 (원래 sprint/topic/permanent 색상)
  - P3: i18n에 orphan 키(`graphNodeNormal`) 잔재
  - → `e1e9d70` 보강 커밋으로 전건 해소.
- **최종 consolidated** (`codex review --base main`) — **0건**. "Critical/High/Medium 0. Category tab filtering, topic frontmatter injection, and graph filter/legend are consistent and type-safe."

## 검증

### 브라우저 end-to-end (blog 빌드 후 정적 서버 + DOM)

- **카테고리 7분류** (KO/EN): 전체 + 6 탭(frontend 글 없음 → graceful skip으로 탭 미렌더) · 각 글 배지 7분류 정확 · i18n 잔재 0 ✓
- **ADR 주제 6컬렉션** (KO `/adr` · EN `/en/adr`): 운영/장애 4건·Agent 3건·CI 3건·Data 3건·**신규 보안 3건·신규 제품 2건** · multi-topic ADR(ADR-003/ADR-025/sprint-95-programmers-dataset) 양쪽 컬렉션 동시 출현 · KR→EN topics 주입 동작(EN frontmatter 수정 없이 KR SSOT 반영) ✓
- **그래프 범례·필터** (`/adr` · `/en/adr`): kind 필터(135→9 스프린트 한정)·엣지 필터·kind별 색상(sprint/topic/permanent)·범례 스와치+설명 · 현재 unresolved 엣지 0건(SVG 점선 0 확인) ✓
- **무회귀**: 글/ADR 상세 기존 라우트 정상 · EN 한국어 잔류 0 ✓

### 로컬

- `tsc --noEmit` 0 errors · `npm run build` 전 라우트 정적 prerender.
- 블로그/ADR 게이트 무회귀:
  - i18n-residue (2.19%<8%)
  - doc-refs (339 0 broken)
  - adr-links KO/EN 0 broken
  - adr-conversion (12/12, F11/F12 신규)
  - index-count (8/1/127→128 본 ADR 추가 후)
  - en-coverage (136/136→137/137 본 ADR 추가 후)
  - blog-crosscheck (KR10/EN10 0 위반)

### CI

- 구현 커밋 — Build Blog SSG·Coverage Gate·E2E Programmers all SUCCESS.

## 결과

- **구현**: feat/sprint-189-blog-phase5 브랜치, 5커밋(`9eeeff0`·`3dc780c`·`28156b6`·`1c297da`·`e1e9d70`), 51파일 +654/-99.
- **5 Phase 개편 완성**: Phase 1(Sprint 185 홈 랜딩+Engineering Editorial) → Phase 2(Sprint 186 ADR 큐레이션) → Phase 3(Sprint 187 글 상세 PDR) → Phase 4(Sprint 188 About+Footer) → **Phase 5(이번, 탐색 UI 완결)**.
- ADR sprint-189(KR+EN) + README sprint ADR count 127→128·범위 62~189 (본 /stop 커밋).

## 신규 패턴

- **frontmatter 주제 자동분류 = KR SSOT + loader EN 주입**: KR frontmatter에 `topics` 배열을 선언하고, loader가 EN locale 렌더 시 KR topics를 빌드타임 주입한다. EN frontmatter를 수동으로 복사·갱신하는 작업이 사라지고 드리프트가 발생 불가다. 다중 주제(multi-topic) ADR은 배열로 양쪽 컬렉션에 자동 출현한다(Sprint 186 큐레이션의 `adrIds` 하드코딩 제거).
- **동적 카테고리 탭 = 글 존재 카테고리만 렌더**: `availableCategories` useMemo로 실제 글이 있는 분류만 탭으로 만든다. 7분류로 확장해도 콘텐츠가 없는 카테고리(frontend)는 탭에 노출되지 않으며, 글이 추가되면 자동으로 탭이 나타난다(graceful skip으로 UX 부채 없음).
- **게이트 enum SSOT 동기화 + SSOT 주석**: `VALID_CATEGORIES` 같은 SSOT 상수를 변경할 때 검증 게이트(`check-blog-crosscheck`)의 enum도 동시 갱신하고, 소스에 "SSOT 주석"(`// SSOT: posts.ts VALID_CATEGORIES와 동기화 유지`)을 남겨 미래 담당자가 갱신 대상을 명시적으로 인식하게 한다.

## 교훈

- **5 Phase 연속 입증 — Engineering Editorial 기반이 Phase 5도 가속**: Phase 1에서 구축한 Engineering Editorial 토큰·AdrCard·buildUrl·i18n/site-content SSOT 덕에 Phase 5도 신규 토큰 없이 컴포넌트/데이터 추가로 마무리됐다. 5스프린트 연속으로 "기반 먼저"가 재작업 0을 입증했다.
- **브라우저가 결정자 (unresolved 엣지 판정)**: Critic이 D3에서 "unresolved 엣지 토글이 dead feature 가능성"을 지적했다. 정적 추론만으로는 "현재 unresolved 0건인가"를 판정할 수 없었으나, SVG 점선 카운트를 브라우저에서 직접 확인해 "현재 0건 → P2 이월 무영향"을 정확 판정했다. 필터 버그(toOk 로직) 또한 브라우저 DOM 검증에서 동작 불일치로 발각됐다.
- **frontmatter SSOT + 빌드타임 집계가 콘텐츠-메타 드리프트를 발생 불가로**: `adrIds` 하드코딩 방식은 ADR 추가 시 site-content도 수동 갱신해야 했다(드리프트 발생 경로). frontmatter `topics` 선언 + 빌드타임 집계로 전환하면 ADR frontmatter가 SSOT이므로 불일치가 발생할 구조 자체가 없다(Sprint 185 "표시 수치 빌드타임 동적 주입" 계승).

## 이월 항목 (Sprint 190+)

- **P2 (이월)**: `filterAdjacency` unresolved 엣지의 `to` 노드 미포함 → mermaid 암묵 노드·카운트 불일치. 현재 unresolved 0건으로 무영향이며, 원 `buildChart` 설계 계승이라 Sprint 190으로 이월.
- **기존 시드 잔재**: H3-only PR 표 추출(sprint-135/143/146) · `sprint-87-plan.md` relocate/제거 · 누적 UAT(프로그래머스 재제출 채점·영문 Grafana CB dashboard) · 후속(coverage-gate skipped 허용 제거·`(adr)` layout 분할·prom-client Case B~D·`.claude-tools/` Phase 2 삭제·doc-refs bare-path 확장).
- **Low 정보성**: EN topics 직접 mutation(loader inject 대신 in-place 수정) · category-tabs 화살표키 네비게이션 미지원.
