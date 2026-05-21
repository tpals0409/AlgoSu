---
sprint: 193
title: "Blog ADR 그래프 기능 전체 삭제"
date: "2026-05-21"
status: completed
agents: [Oracle, Herald, Critic]
related_adrs: ["sprint-189"]
related_memory: ["sprint-window"]
topics: ["product"]
tldr: "Sprint 189에서 추가한 mermaid 기반 ADR 관계 그래프(전용 /adr/graph 페이지 + 상세 사이드바 미니 그래프)를 전체 삭제한다. 그래프 전용 컴포넌트 5개·lib 로직(buildGraph/getSubgraph/filterAdjacency)·데드 데이터(outgoingLinks)·i18n 키 44개·fixtures F7/F8을 제거하고, 그래프와 무관한 '관련 ADR' 텍스트 링크·블로그 본문 mermaid·--diagram-bg/grid 토큰은 보존. tsc 0·build(라우트 소멸)·게이트 7종 무회귀·Critic 0건·CI #339 37 pass / 0 fail."
---
# Sprint 193 — Blog ADR 그래프 기능 전체 삭제

## 목표

- 기술 블로그(`blog/`) ADR 섹션의 **mermaid 기반 ADR 관계 그래프**를 전체 제거한다.
- Sprint 189에서 추가한 ① 전용 그래프 페이지(`/adr/graph`, KR/EN — 범례·필터·전체 그래프)와 ② ADR 상세 페이지 사이드바의 미니 관계 그래프(1-hop 서브그래프)를 모두 삭제한다.
- 그래프와 무관한 기능(관계 데이터의 텍스트 표현·블로그 본문 다이어그램)은 보존하고, 의존 정리·게이트 무회귀·KR/EN 동시 정합을 보장한다.

## 배경

- 사용자 `/start` 인자로 "Blog ADR에서 그래프 기능 삭제"를 지시. 착수 시 핵심 모호성 — "그래프 기능"의 범위가 두 갈래로 해석되었다.
- 탐색 결과, ADR 상세 사이드바(`adr-meta-sidebar.tsx`)에는 **두 가지가 별개로** 존재했다: ① "관련 ADR"(`RelatedLinks`, `meta.relatedAdrs` 기반 텍스트 링크 — 그래프 아님), ② 미니 관계 그래프(`RelatedAdrGraph`, mermaid 시각화). 즉 관계 데이터는 이미 텍스트 링크로도 표시되고 있었고, 미니 그래프는 그 위에 얹힌 추가 시각화였다.
- 또한 블로그 글 본문의 mermaid 다이어그램(`blog/src/components/blog/mermaid.tsx` 등)은 ADR 그래프와 완전히 무관한 별개 기능이었다.

## 결정

### D1. 삭제 범위 — 그래프 시각화 전체 (사용자)

- AskUserQuestion으로 범위를 확인 → **"그래프 기능 전체 삭제"** 확정. 전용 페이지 + 사이드바 미니 그래프 + 모든 그래프 컴포넌트·lib 로직·i18n 키를 제거.
- **보존**: 사이드바 "관련 ADR" 텍스트 링크 목록(그래프 아님), 블로그 본문 mermaid 다이어그램, `--diagram-bg/grid` CSS 토큰(블로그 본문 mermaid와 공유 가능, 무해).

### D2. lib 그래프 로직 — 전부 제거

- `getSubgraph`가 상세 6라우트의 미니 그래프 생성에 쓰였으나, 미니 그래프 자체를 삭제하므로 `getSubgraph`·`buildGraph`·`mergeTargets`·`filterAdjacency`와 `AdrIndex.graph` 필드·`AdjacencyList` 타입을 함께 제거. 비그래프 lib(`buildUrl`/`filterAdrsByTopic`/`groupByKind`/`mapBySprint`)은 유지.

### D3. 데드 데이터(`outgoingLinks`) 동반 제거

- `AdrDoc.outgoingLinks`는 `buildGraph`/`mergeTargets`에서만 소비되던 그래프 전용 데이터였다. 그래프 제거 후 데드 필드가 되므로 `parser.ts`의 추출 로직(`extractOutgoingLinks`)과 그 전용 정규식 `ADR_LINK_RE`까지 제거. `normalizeAdrId`는 related_adrs 추출에서도 쓰여 유지.

### D4. fixtures F7/F8 — 제거 (회귀 커버리지 손실 없음)

- F7/F8은 `index.graph.edges`를 직접 검증하는 그래프 전용 회귀였다. `AdrIndex.graph` 제거로 의미가 사라져 두 fixture를 삭제(12→10). ADR 관계 회귀는 F6(`relatedAdrs` 비어있지 않음)이 계속 커버.

## 구현

### 구현 커밋 (1커밋, PR #339 squash → `81c62e8`)

- `b1da63d` chore(blog) — ADR 그래프 기능 전체 삭제 (20 files, +15 / −845)
  - **삭제(5)**: `adr/graph/page.tsx`(KR/EN), `adr-graph-view.tsx`, `adr-graph-cta.tsx`, `related-adr-graph.tsx`
  - **컴포넌트(4)**: `adr-header`(nav "그래프" 링크), `adr-landing-view`(그래프 CTA), `adr-meta-sidebar`(미니 그래프 블록 + 그 유일 소비처였던 미사용 `prefix` 변수), `adr-detail-view`(`miniGraph` prop)
  - **라우트(6)**: sprints/permanent/topics × KR/EN — `getSubgraph`/`buildAdrIndex().graph`/`miniGraph` 전달 제거
  - **lib**: `index-builder`(buildGraph/mergeTargets/getSubgraph/filterAdjacency + graph 필드), `types`(AdjacencyList·AdrIndex.graph·AdrDoc.outgoingLinks), `parser`(extractOutgoingLinks·ADR_LINK_RE)
  - **i18n**: graph 키 KR/EN 각 22개 제거
  - **fixtures**: F7/F8 제거(12→10) + 헤더 주석 갱신

## 검증

- **타입/빌드**: `tsc --noEmit` 소스 에러 0(잔존 6건은 삭제된 페이지를 참조하는 stale `.next/types` 캐시 — `.next` 재생성으로 소멸). `next build` 성공 → 산출물에서 `/adr/graph`·`/en/adr/graph` 라우트 소멸 확인, 나머지 ADR/posts/about 라우트 KR/EN 정상.
- **게이트 7종 무회귀**: doc-refs 347(0 broken) · adr-en-coverage 139/139 · i18n-residue 2.19%(<8%) · adr-index-count 일치 · blog-crosscheck KR10/EN10(위반 0) · adr-links 0 broken · adr-conversion 139 all passed.
- **잔여 참조 전수 grep**: 그래프 전용 심볼·`/adr/graph` 라우트 참조 0건(주석 멘션만 정리).
- **lint**: blog는 ESLint 미설정(N/A) — 품질 게이트는 tsc/build.
- **Critic**: `codex review --base main` — 이슈 0건("removal is internally consistent: source references to removed components/types/helpers were cleaned up, and TypeScript passes. No actionable regressions").
- **CI #339**: **Passed 37 / Failed 0** — Build Blog (SSG) pass(2m21s)·Coverage Gate·E2E Programmers pass.

## 교훈 / 패턴

- ① **기능 삭제 시 "관계 데이터"와 "데이터 시각화"를 분리** — "관련 ADR"은 그래프와 무관한 텍스트 링크(`RelatedLinks`)로 이미 별도 존재했다. 시각화(미니 그래프)만 제거하고 관계 데이터 표현은 보존해, 사용자가 체감하는 정보(어떤 ADR이 연결되나)는 유지하면서 무거운 mermaid 의존만 떼어냄. 삭제 범위를 모호하게 두지 않고 AskUserQuestion으로 시각화 전체 제거를 명시 확정.
- ② **삭제는 종속 심볼까지 추적해 데드코드를 남기지 않는다** — 미니 그래프 블록의 유일 소비처였던 `prefix` 변수, `buildGraph` 전용이던 `outgoingLinks`/`ADR_LINK_RE`를 동반 제거해 미사용 경고·데드 필드를 차단. 제거 전 `grep`으로 다중 소비처(`normalizeAdrId`는 related_adrs에서도 사용 → 유지)를 선별해 과잉 삭제를 회피.
- ③ **삭제 PR의 핵심 검증은 "잔여 참조 0 + 라우트 소멸 + 게이트 무회귀"** — 빌드 산출물에서 라우트가 실제로 사라졌는지, 그래프 전용 심볼이 전수 grep에서 0건인지, 콘텐츠·인덱스 게이트가 그대로 통과하는지를 자동 대조해 "조용한 깨짐"을 차단.

## 이월 항목

- (선택 이월) **CI PYTHON_VERSION 3.12 → 3.13 상향** (Dockerfile 3.13 정합) — Sprint 192 D1에서 분리, 별도 스프린트 검토.
- 누적 UAT (사용자 직접): 프로그래머스 재제출 채점 / 영문 production Grafana CB dashboard / Sprint 160~193 누적.
