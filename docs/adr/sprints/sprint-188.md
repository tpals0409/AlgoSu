---
sprint: 188
title: "블로그 UI/UX 개편 — About 페이지 + Footer 컴포넌트화 (Phase 4)"
date: "2026-05-21"
status: completed
agents: [Oracle, Palette, Herald, Critic, Scribe]
related_adrs: ["sprint-187", "sprint-186", "sprint-185"]
related_memory: ["sprint-window", "feedback-blog-workflow"]
---
# Sprint 188 — 블로그 UI/UX 개편 — About 페이지 + Footer 컴포넌트화 (Phase 4)

## 목표

- 기술 블로그를 "포트폴리오형"으로 전환하는 5 Phase 개편(사용자 `/goal` 플랜)의 **Phase 4**. About 페이지 신설 + Footer 정비로 "이 블로그/서비스를 만든 사람"의 진입점을 만든다.
- 첫 방문자·채용 담당자가 글/ADR을 보다가 "누가 만들었나"로 자연스럽게 이동하게 한다(About 페이지 + 전 페이지 Footer 링크).
- 기존 라우트는 **무파괴**. KO+EN 동시. Phase 1(Sprint 185) Engineering Editorial 디자인 시스템 위에서 작업한다.

## 결정

### D1. 외부 링크 SSOT = `site-content.ts` 상수 + About 스택은 그룹 데이터 (사용자 확정 입력)

About/Footer에 노출할 외부 링크를 `site-content.ts`에 상수로 둔다 — `GITHUB_URL = 'https://github.com/tpals0409'`(프로필, 사용자가 레포→프로필로 변경 확정), `ALGOSU_SERVICE_URL`은 기존 상수 재사용. About 핵심 역량은 `ABOUT_SKILL_GROUPS`(그룹 5종) 구조로 두되, **그룹 라벨만 i18n 키**(Backend/AI & LLM/Infrastructure/Data/Frontend)이고 **기술명(FastAPI·NestJS·k3s 등)은 제품/프레임워크 고유명사라 plain 배열**(번역 대상 아님). Sprint 185/186의 "구조적 데이터는 site-content SSOT, 표시 텍스트는 i18n" 철학 계승.

### D2. Footer 컴포넌트화 = pathname 기반 locale 판별 (Palette)

기존에 `(ko)`/`en`/`(adr)` 3개 layout에 인라인으로 중복되던 `<footer>AlgoSu Team</footer>`를 단일 `Footer` 컴포넌트로 추출한다. `(adr)` 레이아웃은 ko/en 라우트가 **공유**(`AdrHeader`처럼 server layout 1개로 양 locale 서빙)하므로 locale을 prop으로 정적 전달할 수 없다 → `AdrHeader`/`LocaleToggle`과 동일하게 **`usePathname()` 기반 locale 판별 client 컴포넌트**로 구현한다. 3개 layout 모두 prop 없이 `<Footer />`만 렌더해 DRY. 정적 export(SSG) 시 각 라우트 prerender에서 pathname이 확정되므로 Footer 텍스트/링크는 SSR HTML에 locale별로 정확히 박힌다.

### D3. About 페이지 = 간결형 (사용자 확정)

About은 **간결형**(자기소개 + 핵심 역량 + 외부 링크, 프로필 이미지 없음)으로 한다. 콘텐츠는 사용자 포트폴리오(portfolio.leo0409.work)를 참고해 작성: 이름 김세민/Semin Kim, 역할 Agentic AI Engineer & Builder, 태그라인 "방관자가 아닌 실행자입니다", 소개 2문단, 핵심 역량 5그룹. 컴포넌트는 홈 패턴(`HomeHero` CTA·`FOCUS_RING`, `MetricGrid` 카드 그리드) 재사용 — `AboutHero` + `SkillGroups` + 조합 `AboutPage`(home-page.tsx 패턴) + thin entry 2개.

### D4. ADR/README는 /stop 시점 별도 docs PR (관례)

구현(About/Footer)은 feature PR로, ADR sprint-188(KR+EN) + README count 갱신은 **/stop 시점 별도 `docs(adr)` PR**로 분리한다. Sprint 186(#326)·187(#329)과 동일 패턴 — ADR은 머지 완료된 스프린트를 기록하므로 머지 전 작성은 시기상조.

## 구현

### PR #330 (About + Footer, 1 commit → squash, 12파일 +370/-9)

- `e40bc45` feat — About 페이지 + Footer 컴포넌트화 + Header 네비 + SSOT 확장.

신규 파일:
- `blog/src/components/footer.tsx` — 공통 Footer(client, pathname locale 판별). 브랜드+저작권 + nav(블로그/ADR/소개) + 외부 링크(GitHub/서비스).
- `blog/src/components/about-page.tsx` — About 조합(AboutHero → SkillGroups).
- `blog/src/components/about/about-hero.tsx` — 이름·역할 배지·태그라인·소개 2문단 + 외부 링크 CTA.
- `blog/src/components/about/skill-groups.tsx` — 핵심 역량 5그룹 카드(그룹 라벨 i18n + 기술 태그).
- `blog/src/app/(ko)/about/page.tsx`·`en/about/page.tsx` — thin entry(metadata 포함).

수정 파일:
- `blog/src/lib/site-content.ts` — `GITHUB_URL` 상수 + `ABOUT_SKILL_GROUPS`(5그룹) +48.
- `blog/src/lib/i18n.ts` — About/Footer/nav 키 ko+en(navAbout·aboutName·aboutRole·aboutTagline·aboutIntro1/2·aboutSkillsTitle·그룹 라벨 5·aboutCtaGithub·footerCopyright·footerService).
- `blog/src/app/(ko)/layout.tsx`·`en/layout.tsx`·`(adr)/layout.tsx` — 인라인 `<footer>` → `<Footer />`.
- `blog/src/components/header.tsx` — About 네비 링크(ADR 옆, navAbout).

## Critic 사이클

`codex review --base main` — **0건**. "No discrete correctness issues were found in the changes. The new About pages, navigation links, shared footer, and i18n additions are consistent with the existing routing and type checks."

## 검증

### 브라우저 end-to-end (blog 빌드 후 정적 서버 + DOM/accessibility tree)
- **KO** `/about`: 역할 배지·이름(김세민)·태그라인·소개 2문단 · GitHub 프로필/AlgoSu 서비스 CTA · 핵심 역량 5그룹(전 기술 태그) 정상 렌더. 헤더 소개 링크·GitHub 프로필 href `github.com/tpals0409`(프로필 정확) ✓.
- **EN** `/en/about`: Semin Kim · "Not an observer, but a doer" · 영어 소개 · GitHub Profile/Visit AlgoSu · Core Skills, **한국어 잔류 0** ✓. 헤더/footer nav 전부 `/en` prefix ✓.
- **Footer 무회귀**: 홈(`/`·`/en`)·ADR(`/adr`·`/en/adr`) 4라우트에서 저작권 locale 정확(© 2026 김세민 / Semin Kim), 구 "AlgoSu Team" 잔재 **0** ✓.

### 로컬
- `tsc --noEmit` 0 errors · `npm run build` 전 라우트 정적 prerender(`/about`·`/en/about` 신규 생성).
- 블로그/ADR 게이트 무회귀: i18n-residue(2.19%<8%) · doc-refs(337 0 broken) · adr-links(1851 0 broken) · index-count(8/1/126) · en-coverage(135/135) · blog-crosscheck(KR10/EN10 0위반) · adr-conversion(10/10).

### CI
- PR #330 — **37 checks pass / 0 fail**(Build Blog SSG·Coverage Gate·E2E Programmers 모두 SUCCESS, E2E Integration SKIP).

## 결과

- **머지**: origin/main → `e40bc45`(#330), 작업 브랜치 삭제.
- **순변경**: 신규 6파일(Footer·About 4·thin entry 2) + 수정 6파일(layout 3·header·i18n·site-content). +370/-9.
- **Phase 4 완성**: About 페이지(KO/EN) + 전 페이지 공통 Footer(브랜드·nav·외부 링크·저작권)로 "만든 사람" 진입점 확보.
- ADR sprint-188(KR+EN) + README sprint ADR count 126→127·범위 62~188 (본 /stop 커밋).

## 신규 패턴

- **공유 layout의 locale 의존 컴포넌트는 pathname 판별로 통일**: `(adr)`처럼 단일 server layout이 ko/en 양 locale을 서빙하면 locale을 prop으로 정적 전달할 수 없다. `usePathname()` 기반 client 판별로 두면 prop 없이 모든 layout이 동일 컴포넌트를 재사용하고, SSG prerender가 라우트별 pathname을 확정하므로 SSR HTML에 locale별 텍스트/링크가 정확히 박힌다(`AdrHeader`/`LocaleToggle` 패턴을 Footer로 확장).
- **고유명사 데이터는 i18n에서 분리**: 기술 스택(FastAPI·k3s 등)·브랜드명(GitHub)은 번역 대상이 아니므로 i18n 키가 아닌 site-content plain 배열/리터럴로 둔다. 그룹 라벨 등 "분류 텍스트"만 i18n에 두면 i18n 사전이 비대해지지 않고 잔재 게이트도 영향받지 않는다.

## 교훈

- **인라인 중복 제거는 추출 + 무회귀 전수 확인이 핵심**: 3개 layout에 흩어진 footer를 단일 컴포넌트로 추출할 때, 진짜 검증 가치는 "추출 후 모든 소비처(홈/글/ADR × ko/en)가 회귀 없이 동일/개선 렌더되는가"에 있었다. 정적 산출물에서 구 텍스트("AlgoSu Team") 잔재 0건 + 신규 저작권 locale 정확을 전 라우트 grep으로 자동 대조해 누락을 차단했다.
- **Phase 1 기반이 Phase 4도 가속(4연속 입증)**: Engineering Editorial 토큰·홈 컴포넌트 패턴(CTA·카드 그리드·FOCUS_RING)·i18n/site-content SSOT 덕에 About/Footer는 신규 토큰 0건으로 끝났다. "기반 먼저"가 Phase 2~4 내내 재작업 0으로 입증됐다.

## 이월 항목 (Sprint 189+)

- **Phase 5 (다음 — Sprint 189)**: ADR 그래프 설명/범례/필터 · 카테고리 7분류 확장(글 재분류) · ADR 주제 자동 분류(Security·Product 세분화) · 검색/자동 컬렉션.
- **기존 시드 잔재**: H3-only PR 표 추출(sprint-135/143/146) · `sprint-87-plan.md` relocate/제거 · 누적 UAT(프로그래머스 재제출 채점·영문 Grafana CB dashboard) · 후속(coverage-gate skipped 허용 제거·`(adr)` layout 분할·prom-client Case B~D·`.claude-tools/` Phase 2 삭제·doc-refs bare-path 확장).
