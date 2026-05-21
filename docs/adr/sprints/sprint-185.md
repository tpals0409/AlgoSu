---
sprint: 185
title: "블로그 홈 랜딩 포트폴리오 개편 + Engineering Editorial 디자인 시스템 (Phase 1)"
date: "2026-05-21"
status: completed
agents: [Oracle, Palette, Herald, Architect, Critic, Scribe]
related_adrs: ["sprint-184", "sprint-179", "sprint-157"]
related_memory: ["sprint-window"]
---
# Sprint 185 — 블로그 홈 랜딩 포트폴리오 개편 + Engineering Editorial 디자인 시스템 (Phase 1)

## 목표

- 기술 블로그를 "많이 기록한 저장소"에서 "문제 해결과 운영 판단이 보이는 **포트폴리오형 기술 블로그**"로 전환하는 5 Phase 개편(사용자 `/goal` 플랜)의 **Phase 1**. 이번 스프린트는 **홈 랜딩 재구성 + 비주얼 리스킨 디자인 시스템 기반**을 KO+EN 동시 구축한다.
- 첫 방문자·채용 담당자가 첫 화면에서 AlgoSu가 실제 운영 중인 AI Agent 서비스임을, 그리고 어디서부터 읽을지를 빠르게 파악하도록 한다. 콘텐츠 추가가 아니라 이미 있는 콘텐츠의 접근성·설득력을 높이는 것이 핵심(플랜 §2).
- 비주얼 리스킨은 토큰 SSOT를 교체하므로 ADR·글 페이지에도 파급된다 → **무회귀 브라우저 검증 필수**(Sprint 183~184 교훈).

## 결정

### D1. "블로그 고유 프리미엄" 디자인 방향 — 메인 앱과 분리 (Palette)

메인 앱 디자인(Primary `#715DA8` 보라, Sora, Glassmorphism)과 **분리된 독자 시스템**을 채택한다. 컨셉은 "Engineering Editorial" — 따뜻한 페이퍼 배경 + 깊은 잉크 텍스트 + 절제된 강조색 1개. 화려한 애니메이션보다 타이포·여백·위계로 신뢰감을 전달한다(플랜 §14 "정보 구조 우선").

- **중립색(warm)**: bg `#FBFAF9`(페이퍼) / surface-elevated `#FFFFFF`(카드) / surface-muted `#F4F2EF` / text `#17161A`(웜 잉크) / text-muted `#57545E` / text-subtle `#8A8693` / border `#E7E3DD`.
- **강조색 Cobalt**: brand `#2347E6` / strong `#1B37B8`(텍스트·hover, AA 6.5:1) / soft `#EEF1FE`(배지·pill). 현 indigo `#6366f1`·메인 앱 보라와 차별. accent-1도 cobalt로 정렬(다이어그램 팔레트 일관).
- **타이포**: Space Grotesk(heading) / Inter + Noto Sans KR(body) / JetBrains Mono(mono) — 전부 `next/font/google`로 클린 도입(기존엔 시스템 폰트).
- **형태**: card radius 16px(`rounded-card`), 2단계 warm soft shadow(`shadow-soft`/`shadow-lift`).
- 다크모드는 블로그가 라이트 고정 → Phase 1은 라이트 우선, 토큰 구조만 다크 확장 가능하게 유지.

### D2. 토큰은 CSS변수 SSOT로 교체 → 전 표면 자동 파급 (Herald)

색상 하드코딩 금지 원칙에 따라 디자인 변경을 `globals.css` CSS변수 + `tailwind.config.ts` 매핑 한 곳에서 수행한다. ADR·글 컴포넌트는 시맨틱 토큰(`bg-surface`/`text-text`/`text-brand` 등)을 쓰므로 변수 교체만으로 자동 리스킨된다 → Phase 1에서 홈만 새로 만들어도 전 표면이 일관 적용된다. `next/font`는 루트 `layout.tsx`에서 CSS변수(`--font-heading`/`--font-sans`/`--font-sans-kr`/`--font-mono`)로 노출.

### D3. 성과 지표·StartHere는 정적 큐레이션 SSOT + ADR 개수 동적화

정적 export 환경이므로 큐레이션을 `site-content.ts` 한 파일에 모은다(성과 지표 6종·StartHere 슬러그 4개·서비스 URL). 표시 텍스트는 i18n 키로만 참조해 ko/en 동시 현지화(누락 시 TS 컴파일 에러). **stale 차단**: ADR 개수는 하드코딩(기존 i18n "105개 ADR" stale 사례) 대신 빌드타임 `getAllAdrs().length`로 주입 — 홈·`/adr` 모두 동일 값(131) 보장.

## 구현

### PR #323 (단일 작업 브랜치 `feat/sprint-185-blog-redesign-phase1`, 1 commit → squash, 12파일 +519/-68)

- `40df234` feat — 디자인 시스템 토큰/폰트 + 홈 랜딩 컴포넌트 + 큐레이션 config + i18n 키.

신규 파일:
- `blog/src/lib/site-content.ts` — 큐레이션 SSOT(`HOME_METRICS` 6종, `START_HERE_POSTS` 4개, `ALGOSU_SERVICE_URL`).
- `blog/src/components/home/home-hero.tsx` — 배지 + 제목 + 서브카피 + CTA 3종([처음 읽기 좋은 글]→`#start-here` / [ADR 보기] / [AlgoSu 서비스 보기]→`https://algo-su.com/`).
- `blog/src/components/home/metric-card.tsx` — `MetricCard` + `MetricGrid`(6 카드, 3열/모바일 1열, ADR 동적 주입).
- `blog/src/components/home/start-here-section.tsx` — 추천 4글(slug로 메타 조회) + why-read 한 줄. 해석 글 0이면 미렌더.
- `blog/src/components/home/adr-intro-card.tsx` — ADR 진입 카드, `{n}` 동적 개수.

수정 파일:
- `blog/src/app/layout.tsx` — next/font 4종 도입, CSS변수 노출.
- `blog/src/app/globals.css` — 토큰값 warm+cobalt 교체, body/heading font-family, radius/shadow 변수.
- `blog/tailwind.config.ts` — fontFamily(sans/heading/mono) + rounded-card + shadow-soft/lift, brand 스케일 cobalt 정렬.
- `blog/src/lib/i18n.ts` — Hero/성과/StartHere/recent 신규 키 ko+en, `homeAdrCtaDescription` `{n}` 동적 템플릿.
- `blog/src/components/home-page.tsx` — 랜딩 구조 재조립(Hero→성과→StartHere→ADR→최근 글), `adrCount = getAllAdrs().length`.
- `blog/src/components/post-card.tsx`·`header.tsx` — rounded-card/shadow/heading 폰트 폴리시.

`(ko)/page.tsx`·`en/page.tsx`가 `HomePage`를 locale prop으로 공유하므로 홈 재구성 1회로 KO/EN 동시 반영.

## Critic 사이클

`codex review --base main` 1라운드.

- **R1**: **0건** 통과 — "변경은 type-safe하며 신규 홈 페이지 컴포넌트·i18n 엔트리·Tailwind 토큰·라우트 링크가 기존 앱 구조와 일관된다. 이 패치가 도입한 별개 회귀를 식별하지 못함." 머지 가능.

## 검증

### 브라우저 end-to-end (blog 빌드 후 정적 서버 + 실제 DOM 확인)
- **KO 홈(`/`)**: Hero(배지·제목·서브카피·CTA 3종) ✓ · 성과 6카드(20+ Users·12 Agents·6 Microservices·23 CI Jobs·**ADR 동적 131**·∞ Zero-downtime) ✓ · StartHere 4카드(01~04, 제목+why 전부 해석) ✓ · ADR 소개("131개 ADR", stale 105 해소) ✓ · 최근 글 탭/카드 ✓.
- **EN 홈(`/en/`)**: 전 문자열 영어화(A live AI-agent service / Start Here / Browse ADRs / Visit AlgoSu) ✓ · 한국어 잔류 0 ✓.
- **무회귀**: ADR 인덱스(전체 ADR 131 = 홈 지표와 일치, 타임라인·상태 배지 정상) · 글 상세(heading 폰트·warm ink prose·cobalt 인라인 코드/링크·brand-soft 인용문) · ADR 상세(TL;DR·메타 사이드바·미니 그래프·callout) 전부 새 토큰으로 정상 렌더.

### 로컬
- `tsc --noEmit` 0 errors · `npm run build` 전 라우트 정적 prerender(`/`·`/en/` 포함).
- 블로그 게이트 7종 무회귀: adr-conversion(All passed) · doc-refs(331 files 0 broken) · en-coverage(132/132) · index-count(8/1/123) · i18n-residue(max 2.19%<8%) · blog-crosscheck(KR 10/EN 10, 0 위반) · adr-links(132 entries, 0 broken).

### CI
- 작업 PR #323 전체 checks green(Build Blog·Coverage Gate·E2E Programmers 포함), 비-성공 체크 0건.

## 결과

- **머지**: origin/main → `6f69265`(PR #323 squash merge, 작업 브랜치 삭제).
- **순변경**: 신규 5파일(site-content + home/ 4종), 수정 7파일. +519/-68.
- ADR sprint-185(KR+EN) + README sprint ADR count 123→124·범위 62~185 (별도 ADR PR).

## 신규 패턴

- **시맨틱 토큰 SSOT가 리스킨을 1점 변경으로 만든다**: 색·폰트가 CSS변수 한 곳에 모여 있고 전 컴포넌트가 시맨틱 클래스(`bg-surface`/`text-brand`)를 쓰면, 디자인 전면 교체가 변수 교체로 끝나고 미작업 표면(ADR·글)까지 자동 일관 적용된다. Phase 1에서 홈만 새로 만들어도 전 사이트가 리스킨된 이유. 단 파급 범위가 넓으므로 "변경하지 않은 표면"도 브라우저 무회귀 확인이 필수(Sprint 184 "출력 소비처까지 확인" 계승).
- **표시 수치는 빌드타임 동적 주입으로 stale 차단**: 기존 i18n "105개 ADR" 하드코딩이 실제 123과 어긋난 사례를 회수. 정적 export라도 빌드 시점에 SSOT(`getAllAdrs().length`)에서 계산해 주입하면 홈·`/adr`이 영구 일치하고 미래 드리프트가 "발생 불가"가 된다.

## 교훈

- **공유 컴포넌트 구조가 KO+EN 동시 작업을 반값으로 만든다**: `(ko)/page`·`en/page`가 `HomePage`를 locale prop으로 공유하고 모든 텍스트가 i18n 사전에 있으면, 홈 재구성 1회 + i18n 키 ko/en 추가만으로 양 locale이 동시에 완성된다. 신규 표시 텍스트는 처음부터 i18n 사전에 ko+en 쌍으로 넣어야 하며(누락 시 TS 컴파일 에러가 가드), 컴포넌트에 문자열을 하드코딩하면 EN 누락 부채가 생긴다.
- **다중 스프린트 개편은 "기반 먼저"가 효율적**: 비주얼 리스킨(토큰/폰트)을 Phase 1에 깔면 이후 Phase(ADR·글 상세·About)는 신규 화면을 만들 때 이미 새 디자인 시스템 위에서 작업하게 되어 재작업이 없다. 디자인 기반과 첫 화면(홈)을 한 스프린트에 묶은 것이 합리적이었다.

## 이월 항목 (Sprint 186+)

- **Phase 2 (다음 — Sprint 186)**: ADR 접근성 개선 — ADR Hero·대표 ADR 5개·주제별 컬렉션·`/adr/archive` 분리·그래프 CTA. 정적 큐레이션 config 도입. KO+EN.
- **Phase 3**: 글 상세 — TL;DR·Problem/Decision/Result(MDX 본문)·ResultCallout·관련 ADR/글 섹션.
- **Phase 4**: About 페이지 + Footer 링크(개인 URL 필요).
- **Phase 5**: ADR 그래프 설명/범례/필터·카테고리 탭 고도화(현 글 journey/challenge 2분류 → 7분류 확장 시 글 재분류 필요)·검색/자동 컬렉션 검토.
- **기존 시드 잔재**: H3-only PR 표 추출(sprint-135/143/146) · `sprint-87-plan.md` relocate/제거 · 누적 UAT(프로그래머스 재제출 채점·영문 Grafana CB dashboard) · 후속(coverage-gate skipped 허용 제거·`(adr)` layout 분할·prom-client Case B~D·`.claude-tools/` Phase 2 삭제).
