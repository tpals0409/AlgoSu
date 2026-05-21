---
sprint: 186
title: "블로그 UI/UX 개편 — /adr 큐레이션 랜딩 전환 + /adr/archive 분리 (Phase 2)"
date: "2026-05-21"
status: completed
agents: [Oracle, Palette, Architect, Herald, Critic, Scribe]
related_adrs: ["sprint-185", "sprint-163", "sprint-157"]
related_memory: ["sprint-window"]
---
# Sprint 186 — 블로그 UI/UX 개편 — /adr 큐레이션 랜딩 전환 + /adr/archive 분리 (Phase 2)

## 목표

- 기술 블로그를 "포트폴리오형"으로 전환하는 5 Phase 개편(사용자 `/goal` 플랜)의 **Phase 2**. ADR 메인(`/adr`)을 **전체 목록 나열에서 큐레이션 진입점**으로 전환한다.
- 처음 방문자·채용 담당자가 124개 sprint ADR을 한꺼번에 마주하지 않고 **대표 ADR → 주제별 컬렉션 → 그래프 → 전체 아카이브** 순으로 점진 진입하게 한다(플랜 §6).
- 기존 ADR/URL은 **무삭제·무파괴**. 전체 목록은 `/adr/archive`로 이전하되 ADR 상세 URL은 불변. KO+EN 동시. Phase 1(Sprint 185)에서 깐 Engineering Editorial 디자인 시스템 위에서 작업한다.

## 결정

### D1. `/adr`을 큐레이션 랜딩으로, 전체 목록은 `/adr/archive`로 무파괴 이전 (Architect)

기존 `/adr`은 `AdrIndexView`가 전체 ADR을 시간순으로 나열했다 — 124개 sprint ADR + 8 영구 + 1 토픽을 첫 화면에 쏟아내 첫 방문자가 어디서 읽어야 할지 알 수 없었다. `/adr`을 **큐레이션 랜딩**(`AdrLandingView`)으로 교체하고, 기존 전체 목록 컴포넌트(`AdrIndexView`)는 **`/adr/archive`로 그대로 이전**한다.

- ADR 상세 URL(`/adr/sprints/{n}`·`/adr/{slug}`)은 불변 → 외부 링크·검색 인덱스 무파괴.
- `/adr/archive`·`/en/adr/archive` 신설(기존 목록 그래도 유지). 큐레이션에서 진입 못 한 ADR도 아카이브에서 전수 접근 가능.
- KO/EN 모두 `(adr)` route group 하위에 동일 구조로 배치.

### D2. 큐레이션은 정적 config SSOT — AdrMeta.id 참조 (Palette/Architect)

정적 export 환경이므로 큐레이션 데이터를 Phase 1의 `site-content.ts`에 모은다(홈 큐레이션 SSOT 패턴 계승). ADR 참조는 **AdrMeta.id**(permanent: `ADR-001`, sprint: `sprint-130`, topic: slug)로 하고, 제목·한 줄 요약은 `AdrMeta`(title/tldr)에서 조회 — config에는 "왜 읽어야 하나"만 i18n 키로 둔다. 표시 텍스트는 i18n DICTIONARY 키로만 참조해 ko/en 동시 현지화(누락 시 TS 컴파일 에러).

- **`FEATURED_ADRS`** (5종, 사용자 확정): `ADR-001`·`ADR-002`·`ADR-026`·`ADR-027`·`ADR-028` — 각 `whyKey`.
- **`ADR_TOPICS`** (4주제, 사용자 확정): operations·agents·cicd·data — 각 멤버는 `adrIds` 배열(permanent/sprint/topic 혼합 가능).
- **`ADR_READING_STEPS`** (4단계): 문제 → 선택지 → 결정 → 검증 프레임.

### D3. 대표 ADR 5개·주제 4분류 사용자 확정 (Oracle/사용자)

플랜에서 후보로 제시한 대표 ADR 5개를 사용자가 확정했다.

- **대표 ADR 5개**: ADR-001(Gateway→Identity DB 분리)·ADR-002(Outbox)·ADR-026(Sprint 130 인시던트: stuck rollouts + SealedSecrets)·ADR-027(Aether GitOps 브랜치 규율)·ADR-028(Dev 클러스터 분리) — AlgoSu 시스템 진화의 핵심 결정.
- **주제 4분류**: 운영/장애(operations) · Agent(agents) · CI·GitOps(cicd) · Data(data). **Security·Product 세분화·자동 분류는 Phase 5로 이월**(현 단계는 정적 curated list 우선).

## 구현

### PR #325 (단일 작업 브랜치, 1 commit → squash, 11파일 +551/-15)

- `ca8a085` feat — ADR 큐레이션 랜딩 + `/adr/archive` 분리 + 큐레이션 config·i18n·컴포넌트 5종.

신규 파일:
- `blog/src/components/adr/adr-landing-hero.tsx` — ADR Hero + "ADR 읽는 법" 4단계(문제→선택지→결정→검증).
- `blog/src/components/adr/featured-adr-section.tsx` — 대표 ADR 5개 카드(제목·tldr·why-read·태그, `AdrMeta` 조회).
- `blog/src/components/adr/adr-topic-collections.tsx` — 주제 4분류 컬렉션(멤버 ADR id 참조).
- `blog/src/components/adr/adr-graph-cta.tsx` — 그래프 진입 카드(설명/범례는 P5, 이번엔 진입 CTA).
- `blog/src/components/adr/adr-landing-view.tsx` — 랜딩 조립(Hero→Featured→Topics→Graph CTA→Archive 링크).
- `blog/src/app/(adr)/adr/archive/page.tsx`·`blog/src/app/(adr)/en/adr/archive/page.tsx` — 전체 목록(`AdrIndexView`) 이전 라우트.

수정 파일:
- `blog/src/app/(adr)/adr/page.tsx`·`blog/src/app/(adr)/en/adr/page.tsx` — `AdrIndexView` → `AdrLandingView` 교체.
- `blog/src/lib/site-content.ts` — `FEATURED_ADRS`(5)·`ADR_TOPICS`(4)·`ADR_READING_STEPS`(4) + 인터페이스 추가 (+95/-3).
- `blog/src/lib/i18n.ts` — ADR 랜딩 키 ko+en 쌍 추가(Hero·읽는 법 4단계·featured why 5·주제 4 title/desc).

큐레이션 컴포넌트는 Phase 1의 Engineering Editorial 토큰·기존 `AdrCard`·`buildUrl`을 재사용해 신규 표면도 디자인 일관성을 자동 확보.

## Critic 사이클

`codex review --base main` 진행. (PR #325 머지 시점 green — Critic 통과)

## 검증

### curl end-to-end (blog 빌드 후 정적 서버 + DOM 확인)
- **KO `/adr`**: 큐레이션 랜딩(Hero·읽는 법 4단계·대표 ADR 5·주제 4컬렉션·그래프 CTA·아카이브 링크) ✓ · 주제 멤버 ADR 정상 링크 ✓.
- **KO `/adr/archive`**: 기존 전체 목록(`AdrIndexView`) 무파괴 렌더 ✓ · ADR 상세 URL 불변 ✓.
- **EN `/en/adr`·`/en/adr/archive`**: 전 문자열 영어화, 한국어 잔류 0 ✓.
- **무회귀**: 기존 ADR 상세·홈·글 라우트 200, 디자인 일관(Engineering Editorial 토큰).

### 로컬
- `tsc --noEmit` 0 errors · `npm run build` 전 라우트 정적 prerender(`/adr`·`/adr/archive`·`/en/adr`·`/en/adr/archive` 포함).
- 블로그 게이트 무회귀: adr-links(KO/EN 0 broken) · index-count · en-coverage(133/133) · adr-conversion(10/10) · i18n-residue(2.19%<8%) · doc-refs(0 broken) · blog-crosscheck(0 위반).

### CI
- 작업 PR #325 전체 checks green(Build Blog 포함), 비-성공 체크 0건.

## 결과

- **머지**: origin/main → `ca8a085`(PR #325 squash merge, 작업 브랜치 삭제).
- **순변경**: 신규 7파일(컴포넌트 5 + archive 라우트 KO/EN 2), 수정 4파일. +551/-15.
- ADR sprint-186(KR+EN) + README sprint ADR count 124→125·범위 62~186 (본 /stop 커밋).

## 신규 패턴

- **무파괴 정보 재구조화 — 진입은 큐레이션, 전수는 아카이브로 분리**: 콘텐츠가 누적되면(124 ADR) 전체 나열은 첫 방문자에게 진입 장벽이 된다. 메인 라우트를 큐레이션 랜딩으로 바꾸되 기존 전체 목록 컴포넌트를 별도 라우트(`/adr/archive`)로 이전하면, 신규 사용자 경험을 개선하면서 상세 URL·전수 접근을 동시에 보존한다(URL 불변 → 외부 링크·검색 인덱스 무파괴).
- **큐레이션은 AdrMeta.id 참조 정적 config로 — 표시 데이터는 메타에서 조회**: 큐레이션 config에 제목/요약을 복제하면 원본 ADR 수정 시 드리프트가 생긴다. config에는 **id + why-read(i18n)만** 두고 title/tldr는 `AdrMeta`에서 빌드타임 조회하면 단일 출처가 유지된다(Sprint 185 `getAllAdrs().length` 동적 주입 패턴 계승).

## 교훈

- **다중 스프린트 개편에서 Phase 1 기반이 Phase 2를 가속한다**: Phase 1에서 디자인 토큰·`site-content.ts` 큐레이션 SSOT·i18n 구조를 깔아둔 덕에, Phase 2는 신규 큐레이션 데이터를 같은 config에 추가하고 기존 토큰·`AdrCard`·`buildUrl`을 재사용하는 것으로 끝났다. "기반 먼저"(Sprint 185 교훈)가 실제 후속 Phase에서 재작업 0으로 입증됐다.
- **공유 컴포넌트·route group이 KO+EN 동시 작업을 유지한다**: `(adr)` route group 하위에 KO/EN 라우트를 동일 구조로 두고 표시 텍스트를 i18n 키로만 참조하면, 랜딩 1회 구현 + ko/en 키 추가로 양 locale이 동시에 완성된다(Sprint 185 홈 패턴 계승). 신규 표시 텍스트는 처음부터 ko+en 쌍으로(TS 컴파일 에러가 가드).

## 이월 항목 (Sprint 187+)

- **Phase 3 (다음 — Sprint 187)**: 글 상세 — TL;DR·Problem/Decision/Result(MDX 본문)·ResultCallout·관련 ADR/글 섹션.
- **Phase 4**: About 페이지 + Footer 링크(개인 URL 필요).
- **Phase 5**: ADR 그래프 설명/범례/필터 · 카테고리 7분류 확장(글 재분류 필요) · ADR 주제 자동 분류(Security·Product 세분화) · 검색/자동 컬렉션 검토.
- **기존 시드 잔재**: H3-only PR 표 추출(sprint-135/143/146) · `sprint-87-plan.md` relocate/제거 · 누적 UAT(프로그래머스 재제출 채점·영문 Grafana CB dashboard) · 후속(coverage-gate skipped 허용 제거·`(adr)` layout 분할·prom-client Case B~D·`.claude-tools/` Phase 2 삭제·doc-refs bare-path 확장).
