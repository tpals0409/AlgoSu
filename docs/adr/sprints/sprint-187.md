---
sprint: 187
title: "블로그 UI/UX 개편 — 글 상세 포트폴리오화 (TL;DR·PDR·관련 ADR, Phase 3)"
date: "2026-05-21"
status: completed
agents: [Oracle, Palette, Herald, Critic, Scribe]
related_adrs: ["sprint-186", "sprint-185", "sprint-163"]
related_memory: ["sprint-window", "feedback-blog-workflow"]
---
# Sprint 187 — 블로그 UI/UX 개편 — 글 상세 포트폴리오화 (TL;DR·PDR·관련 ADR, Phase 3)

## 목표

- 기술 블로그를 "포트폴리오형"으로 전환하는 5 Phase 개편(사용자 `/goal` 플랜)의 **Phase 3**. 글 상세 페이지를 "본문만 있는 글"에서 **TL;DR·Problem/Decision/Result 구조가 보이는 포트폴리오형 글**로 전환한다.
- 첫 방문자·채용 담당자가 글을 다 읽지 않아도 핵심(문제 → 결정 → 결과)을 빠르게 스캔하게 한다(플랜 §6).
- 기존 글/URL·본문 내러티브는 **무삭제·무파괴**(frontmatter 필드 추가 + 본문 밴드 삽입만). KO+EN 동시. Phase 1(Sprint 185) Engineering Editorial 디자인 시스템 위에서 작업한다.

## 결정

### D1. TL;DR 데이터 소스 = frontmatter `tldr` 필드 (사용자 확정)

글 상단 TL;DR 블록의 소스를 frontmatter `tldr`(optional string) 신규 필드로 한다(MDX 본문 컴포넌트 대안 기각). 항상 글 최상단 고정 위치에 일관 렌더되고, 목록/카드 뷰에서도 재사용 가능하며, Sprint 185의 구조적 데이터 SSOT 철학과 일치한다. `PostMeta`에 `tldr?`·`relatedAdrs?` 추가, `getAllPosts`에 `tldr` 노출, `getPostBySlug`는 frontmatter spread로 자동 노출.

### D2. Problem/Decision/Result = MDX 본문 컴팩트 도입 밴드 (Palette)

PDR을 **본문 섹션 도입 밴드**(eyebrow 라벨 + 좌측 액센트 보더)로 구현한다 — 섹션 전체 래핑이 아닌 1~2문장 프레이밍을 짧은 밴드로 삽입(사용자 확정 스타일). 기존 본문은 무변경(삽입만)이라 무파괴이고, Engineering Editorial 톤과 맞는다. 색 톤은 **기존 callout 토큰 재사용**(Problem=warn 앰버 · Decision=info 코발트 · Result=success 그린) — 신규 tailwind 토큰 0건이라 Palette→Herald 토큰 등록 순서 불요. 라벨은 `Callout`의 title 패턴처럼 per-locale 인라인(`<Problem label="문제">`/`<Problem label="Problem">`). `ResultCallout`은 success `Callout` 프리셋 래퍼로 DRY 구현.

### D3. 관련 ADR = frontmatter `relatedAdrs` 필드, FeaturedAdrSection 패턴 미러링 (사용자 확정)

글 ↔ ADR 연결은 frontmatter `relatedAdrs: ["ADR-001", "sprint-82", ...]`(AdrMeta.id 배열)로 한다(태그 자동 매칭 대안 기각 — 명시적·정확). `post-page.tsx`가 `buildAdrIndex(getAllAdrs(locale))`로 id→AdrMeta 맵을 만들고, 카드는 Sprint 186 `FeaturedAdrSection` 패턴(id 배지·title·tldr·`buildUrl` 링크)을 미러링. 조회 실패 id는 graceful skip. 관련 글 섹션은 `getRelatedPosts`(같은 시리즈 +3, 공유 태그 +1 점수)로 별도.

### D4. 적용 범위 = 전체 10편, 페이싱은 단계 분리 (Oracle/사용자)

전체 10편(KO+EN) 적용을 목표로 하되, **인프라+파일럿 1편(Phase A/B) → 나머지 9편(Phase C)** 으로 페이싱을 분리한다. `feedback-blog-workflow`(블로그 콘텐츠는 글 단위)와 충돌하나, PDR 적용은 **본문 재작성이 아닌 구조적 삽입**이고 파일럿으로 스타일이 확정된 후라, 사용자가 Phase C를 **"전부 위임(결과만 보고)"** 으로 선택했다. 즉 "패턴 확정 후 구조적 적용은 일괄 위임 가능"이 이번에 확인된 신호.

## 구현

### PR #327 (인프라 + 파일럿, 1 commit → squash, 10파일 +344/-2)

- `a16ee50` feat — 인프라(타입·컴포넌트·post-page·i18n) + 파일럿 orchestration-structure(KO+EN).

신규 파일:
- `blog/src/components/blog/pdr.tsx` — `Problem`/`Decision`/`Result` 컴팩트 도입 밴드(phase별 callout 토큰).
- `blog/src/components/blog/result-callout.tsx` — `ResultCallout`(success `Callout` 프리셋 래퍼).
- `blog/src/components/post/related-adrs.tsx` — 관련 ADR 섹션(`relatedAdrs`→`AdrMeta` 카드, `buildUrl`).
- `blog/src/components/post/related-posts.tsx` — 관련 글 섹션(`getRelatedPosts` 결과 카드).

수정 파일:
- `blog/src/lib/posts.ts` — `PostMeta.tldr`·`relatedAdrs` 추가 + `getRelatedPosts` 헬퍼 + `getAllPosts` tldr 노출.
- `blog/src/components/post-page.tsx` — TL;DR 블록(brand 좌측 액센트) + 관련 ADR/관련 글 섹션 wiring.
- `blog/src/components/mdx-components.tsx` — `Problem`/`Decision`/`Result`/`ResultCallout` 등록.
- `blog/src/lib/i18n.ts` — `postTldrLabel`·`relatedAdrsTitle`·`relatedAdrsSubtitle`·`relatedPostsTitle` ko+en.
- `blog/content/posts/orchestration-structure.mdx`·`posts-en/...` — tldr·PDR 밴드 3·relatedAdrs(sprint-82/116/114).

### PR #328 (나머지 9편, 1 commit → squash, 18파일 +244)

- `319a633` feat — 9편(KO+EN)에 tldr·PDR 밴드·relatedAdrs 일괄 적용.

적용 글 + relatedAdrs 매핑:
- agent-orchestration-solo-dev(sprint-82/116/117) · baekjoon-gone(sprint-95/97) · ci-refactoring-reference-to-reality(sprint-105/107/ADR-027) · cicd-ai-guardrails(ADR-027/028/sprint-105) · session-policy-sync(sprint-71/65) · sliding-window-agent-context(sprint-82/116) · sprint-journey(ADR-001/002/026, 회고글이라 Problem+Result 2밴드) · system-architecture-overview(ADR-001/002/003) · toward-model-agnostic-harness(sprint-114/117/136).

## Critic 사이클

`codex review --base main` — **양 PR 모두 0건**. Phase C는 Codex가 자체 검증 스크립트로 전 글 `tldr`+`relatedAdrs` 유효성과 모든 relatedAdrs id 해소(missing 0건)까지 확인.

## 검증

### 브라우저 end-to-end (blog 빌드 후 정적 서버 + DOM/스크린샷)
- **파일럿 KO/EN** `/posts/orchestration-structure`·`/en/...`: TL;DR 밴드(코발트 액센트) · PDR 밴드(문제 앰버/결정 코발트/결과 그린) · 관련 ADR 3카드+링크 · 관련 글 카드 정상 렌더, EN 한국어 잔류 0 ✓.
- **Phase C spot-check** `/posts/cicd-ai-guardrails`(KO): TL;DR 밴드 + 문제 밴드 파일럿과 동일 렌더 ✓.

### 로컬
- `tsc --noEmit` 0 errors · `npm run build` 전 라우트 정적 prerender(KO/EN posts 10편 포함).
- **관련 ADR 카드 수 전 글 기대치 일치**(graceful-skip 0) · relatedAdrs id 전부 실재 ADR로 해소.
- 블로그 게이트 무회귀: i18n-residue(2.19%<8%) · blog-crosscheck(KR10/EN10 0위반) · adr-links(1694 0 broken) · doc-refs(335 0 broken) · index-count(8/1/125) · en-coverage(134/134).

### CI
- PR #327 76 checks green · PR #328 SUCCESS 38/SKIP 11/NEUTRAL 1/FAILURE 0.

## 결과

- **머지**: origin/main → `a16ee50`(#327) → `319a633`(#328), 양 작업 브랜치 삭제.
- **순변경**: 신규 4파일(컴포넌트) + 수정 6파일(인프라) + 콘텐츠 20파일(글 10편 KO+EN). 인프라 +344/-2, 콘텐츠 +244.
- **Phase 3 완성**: 전체 10편 글 상세가 TL;DR + PDR + 관련 ADR/글로 포트폴리오화.
- ADR sprint-187(KR+EN) + README sprint ADR count 갱신 (본 /stop 커밋).

## 신규 패턴

- **구조적 콘텐츠 변형은 "인프라+파일럿 → 일괄 위임"으로 페이싱**: 콘텐츠 작업이라도 (1) 본문 재작성이 아닌 구조적 삽입이고 (2) 파일럿으로 스타일/패턴이 확정되면, 나머지는 글 단위 검토 없이 일괄 위임이 효율적이다. `feedback-blog-workflow`(글 단위 검토)는 **톤/프레임 재작성**에 적용되고, **패턴 확정 후 구조 삽입**에는 일괄 위임이 맞다 — 두 모드를 구분.
- **관련 ADR은 frontmatter id 참조 + 빌드타임 메타 조회**: 글↔ADR 연결을 frontmatter `relatedAdrs`(AdrMeta.id)로 두고 title/tldr는 빌드타임 `AdrMeta` 조회 + graceful skip하면, ADR 수정 시 드리프트가 발생하지 않고 잘못된 id도 빌드를 깨지 않는다(Sprint 186 큐레이션 패턴을 글 단위로 계승).

## 교훈

- **검증된 컴포넌트 위 콘텐츠 적용은 회귀 위험이 낮다 — 검증은 카드 해소 수에 집중**: Phase C는 신규 코드 0(검증된 컴포넌트 재사용)이라 시각 회귀 위험이 낮았고, 실제 검증 가치는 "relatedAdrs가 전부 실재 ADR로 해소되는가"(graceful-skip이 결함을 숨기므로)에 있었다. 빌드 산출물에서 글별 카드 수 = 기대 id 수를 자동 대조해 누락을 잡았다.
- **Phase 1/2 기반이 Phase 3도 가속(3연속 입증)**: Engineering Editorial 토큰·`AdrMeta`/`buildUrl`·i18n 구조 덕에 Phase 3 인프라는 callout 토큰 재사용 + FeaturedAdrSection 미러링으로 끝나 신규 토큰 0건. "기반 먼저"가 Phase 2(Sprint 186)에 이어 Phase 3에서도 재작업 0으로 입증됐다.

## 이월 항목 (Sprint 188+)

- **Phase 4 (다음 — Sprint 188)**: About 페이지 + Footer 링크 — **개인 URL 필요**(착수 시 사용자 입력 대기).
- **Phase 5**: ADR 그래프 설명/범례/필터 · 카테고리 7분류 확장(글 재분류) · ADR 주제 자동 분류(Security·Product 세분화) · 검색/자동 컬렉션.
- **기존 시드 잔재**: H3-only PR 표 추출(sprint-135/143/146) · `sprint-87-plan.md` relocate/제거 · 누적 UAT(프로그래머스 재제출 채점·영문 Grafana CB dashboard) · 후속(coverage-gate skipped 허용 제거·`(adr)` layout 분할·prom-client Case B~D·`.claude-tools/` Phase 2 삭제·doc-refs bare-path 확장).
