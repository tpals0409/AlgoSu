---
sprint: 266
title: "블로그 페이지 UI/UX 개편 (Signal Grid 리디자인 + 테크블로그 레이아웃)"
date: "2026-08-14"
status: completed
agents: [Oracle, Palette, Critic]
related_adrs: ["sprint-265", "sprint-264", "sprint-263"]
related_memory: ["sprint-window"]
topics: ["frontend", "ui", "ux", "blog", "design-tokens", "layout", "wcag"]
tldr: "레포 루트 독립 Next.js 앱 `blog/`를 두 갈래로 전면 개편. #532 `c5ac77d9`: 'Signal Grid' 디자인 언어로 전면 UI/UX 리디자인 — 디자인 토큰을 값만 교체·키 유지로 재정의해 60개 컴포넌트에 자동 전파, 차트 색상 하드코딩을 `--chart-series-*`/`--chart-state-*` 21개 CSS 변수로 승격, WCAG AA 대비비 4.5:1+ 유지, `next build` 471/471 페이지. #533 `596adeb2`: 색·토큰 SSOT(`globals.css`/`tailwind.config`) 무변경으로 레이아웃 골격만 테크블로그형으로 재설계 — 좌측 persistent 사이드바+중앙 읽기 컬럼+우측 sticky TOC 3존 셸(Stripe/Vercel docs), 홈을 포트폴리오 세로 스택에서 텍스트 인덱스형으로(Overreacted), 넓은 읽기 컬럼(Josh Comeau). Critic이 사이드바 네비가 링크하는 ADR topics/permanent 인덱스 페이지 부재로 인한 404(P2)를 포착 → `4b425b51`로 인덱스 페이지 추가해 해소. 합계 54개 파일 +868/-332. 이월 없음."
---
# Sprint 266 — 블로그 페이지 UI/UX 개편

_날짜: 2026-08-14_

## 목표

레포 루트의 독립 Next.js 앱 `blog/`(기술 블로그 + ADR 아카이브 공개 사이트)를 전면 개편한다. 대상 페이지는 홈(ko/en)·About·Posts(MDX)·ADR 섹션(landing/sprints/topics/permanent/archive)이다. 개편을 **색·토큰(리디자인)** 과 **레이아웃 골격(구조)** 두 갈래로 분리해, 각각을 독립 PR로 검증 가능하게 진행한다.

## 결정 사항

### D1. 리디자인 = 토큰 값만 교체·키 유지로 전 페이지 자동 전파 (#532)

"Signal Grid" 디자인 언어로 전면 리디자인하되, 디자인 토큰의 **키는 유지하고 값만 교체**한다. SSOT(`blog/src/app/globals.css` CSS 변수 + `blog/tailwind.config.ts` 매핑)의 키 계약을 보존하면 이를 상속하는 60개 컴포넌트가 코드 수정 없이 새 색·간격·타이포를 자동 상속한다. 3 Wave로 진행 — 파운데이션(토큰 재정의 + 글로벌 셸) → 컴포넌트 정밀 적용(29파일) → 데이터-비주얼.

### D2. 차트 색상 = 하드코딩 제거 → `--chart-*` 21토큰 승격 (#532 Wave 3)

차트/데이터 비주얼의 하드코딩 색상을 제거하고 `--chart-series-*`(계열 색)·`--chart-state-*`(상태 색) 계열 **21개 CSS 변수**로 승격한다. 색상 SSOT를 토큰 계층으로 일원화해 라이트/다크·테마 전환 시 차트도 함께 반응하게 한다(하드코딩 이탈 재발 차단).

### D3. 레이아웃 = 테크블로그 3존 셸, 색·토큰 SSOT 무변경 (#533)

레이아웃 골격을 테크블로그형으로 교체하되 **색·토큰 SSOT(`globals.css`/`tailwind.config`)는 무변경**으로 두고 구조만 재설계한다. 레퍼런스 통합 — 좌측 persistent 사이드바 + 중앙 콘텐츠 + 우측 sticky TOC **3존 셸**(Stripe/Vercel docs), 넓은 읽기 컬럼·여백 리듬(Josh Comeau). 데스크톱은 사이드바 고정, 모바일은 드로어 폴백.

### D4. 홈 = 포트폴리오 세로 스택 → 텍스트 인덱스형 (#533 Wave L2)

홈을 포트폴리오형 세로 카드 스택에서 **텍스트 인덱스형**(컴팩트 히어로 + 날짜·제목 텍스트 글 리스트 + ADR 진입)으로 전환한다(Overreacted 레퍼런스). 히어로는 관점형 제목·신뢰 메타라인(최근 업데이트 + ADR 수)으로 샤프닝하고, 서비스 CTA는 텍스트 링크로 톤다운한다.

## 구현

- **#532 `c5ac77d9`** — 전면 UI/UX 리디자인 (Signal Grid):
  - Wave 1 파운데이션 `c37cc400` — 디자인 토큰 전면 재정의(값 교체·키 유지) + 글로벌 셸(header/footer/home-hero)
  - Wave 2 컴포넌트 `1aa6f45e` — 29개 파일 정밀 적용(home/about·adr·post/blog), SSOT 무변경
  - Wave 3 데이터-비주얼 `d32cceaf` — 차트 색상 하드코딩 제거 → `--chart-series-*`/`--chart-state-*` 21토큰 신설
- **#533 `596adeb2`** — 레이아웃 전면 개편 (테크블로그 골격):
  - Wave L1 `e72fcce2` — 좌측 persistent 사이드바 3존 셸(데스크톱 고정 / 모바일 드로어)
  - 피드백 `e8aa6145` — 홈 StartHere("처음 오셨다면 이 글부터") 섹션 제거 + 연쇄 dead code(컴포넌트·데이터·i18n·죽은 `#start-here` CTA) 정리
  - Wave L2 `21cb56cc` — 홈 포트폴리오 스택 → 텍스트 인덱스형
  - 히어로 샤프닝 `321fa778` — 관점형 제목·신뢰 메타라인·CTA 톤다운
  - Wave L3 `4200bde1` — 글 상세: 중앙 읽기 컬럼 + 우측 sticky TOC(H2/H3 자동, 스크롤 하이라이트), 홈·About 폭 불변
  - Critic P2 픽스 `4b425b51` — 사이드바가 링크하는 ADR topics/permanent 인덱스 페이지 추가(404 해소)

**규모(물리적 사실)**: `blog/` 54개 파일 변경, +868/-332 (`e708ff47..596adeb2`).

**검증(물리적 사실)**: `next build` **EXIT 0** — #532 Wave별 3회 471/471 페이지, #533 470 HTML 정상 생성. WCAG AA 대비비 4.5:1+ 유지. 토큰 키 유지 → 60개 컴포넌트 CSS 변수 상속 무손상. 색·토큰 SSOT diff 무변경 확인(#533). Critic 재리뷰 CLEAN(P2 소멸). 두 PR 모두 squash 머지 origin/main 반영(`c5ac77d9`·`596adeb2`).

## 인시던트

1. **Critic P2 — 사이드바 네비 404**: 신규 좌측 사이드바가 ADR `topics`/`permanent` 인덱스로 링크하나 해당 인덱스 페이지가 부재해 클릭 시 404. Critic이 포착 → `4b425b51`로 인덱스 페이지를 추가해 해소(네비 링크 대상의 실재를 렌더 경로에서 실측하지 않은 실패모드). 재리뷰 CLEAN.
2. **StartHere 연쇄 dead code**: 홈 StartHere 섹션 제거 시 연결된 컴포넌트·데이터·i18n 문자열·죽은 `#start-here` CTA 앵커가 함께 남을 뻔했으나 `e8aa6145`에서 일괄 정리(기능 제거 시 참조 사슬 전체 청소).
3. **TOC 앵커 정합 선제 수정(B2 실패모드 스캔)**: sticky TOC의 slug가 `rehype-slug`가 생성하는 heading 앵커와 어긋나면 TOC 링크가 깨진다 — 빌드 전 slug ↔ rehype-slug 일치를 검증해 선제 수정.

## 이월

- 없음. (블로그 개편 2건 모두 머지·검증 완료. 동기간 dependabot PR #530·#534는 상시 자동머지 인프라 관할로 스프린트 스코프 외)

## 교훈

- **디자인 토큰은 키를 유지하고 값만 교체하면 전 페이지에 무손상 자동 전파된다.** SSOT의 키 계약을 보존한 덕에 60개 컴포넌트를 개별 수정 없이 리디자인할 수 있었다. 리디자인 시 토큰 키 변경은 마지막 수단으로 두고, 우선 값 교체로 파급을 국소화할 것.
- **사이드바·네비 링크는 대상 페이지의 실재를 렌더 경로에서 실측해야 한다.** 링크만 추가하고 대상 인덱스 페이지를 만들지 않으면 클릭 시 404 — 정적 사이트에선 빌드가 통과해도 런타임 네비에서 터진다. 네비에 경로를 추가할 때 대상 라우트의 존재를 함께 확인.
- **색 리디자인과 구조 개편은 분리 PR로 진행한다.** #532(색·토큰)와 #533(레이아웃)을 나눠, #533에서 "색·토큰 SSOT 무변경"을 diff로 증명할 수 있었다. 두 축을 한 PR에 섞으면 리뷰가 "무엇이 실제로 바뀌었나"를 판별하기 어렵다.
