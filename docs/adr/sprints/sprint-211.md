---
sprint: 211
title: "모든 페이지 GA4 page_view 추적 보강 (App Router soft-navigation)"
date: "2026-05-28"
status: completed
agents: [Oracle, Architect, Scribe]
related_adrs: ["sprint-210"]
related_memory: ["sprint-window"]
topics: ["frontend", "analytics", "ga4", "app-router"]
tldr: "Sprint 210에서 통합한 GA4가 RootLayout에 1회 주입되어 초기 로드 page_view만 발생하는 문제를 진단하고, App Router 클라이언트 네비게이션(soft navigation) page_view 추적을 코드로 보장했다. 사용자가 옵션 B(코드 기반 트래커)를 선택 — Enhanced Measurement history 이벤트 의존 없이 usePathname+useSearchParams 변경 시 sendGAEvent('page_view')를 직접 전송, 테스트 가능. Suspense 경계 필수(useSearchParams App Router 요건), 초기 마운트 skip으로 config 초기 page_view 중복 방지."
---
# Sprint 211 — 모든 페이지 GA4 page_view 추적 보강 (App Router soft-navigation)

## 목표

- Sprint 210에서 통합한 GA4가 App Router 클라이언트 네비게이션(soft navigation) 시에도 page_view를 추적하도록 보강한다.
- 코드 기반 라우트 트래커를 도입하여 GA4 admin 설정(Enhanced Measurement)에 무관하게 추적을 보장하고 테스트 가능하게 한다.
- 초기 마운트 중복 page_view를 방지한다.

## 배경

Sprint 210에서 `@next/third-parties/google`의 `GoogleAnalytics` 컴포넌트를 RootLayout에 삽입했다. 이 컴포넌트는 `gtag('config', gaId)`를 1회 호출하므로 초기 로드 page_view만 발생한다. App Router는 클라이언트 사이드 라우트 전환(soft navigation) 시 전체 페이지를 새로고침하지 않으므로 `gtag config` 재호출이 없다.

**현황**: soft navigation 시 page_view는 GA4 Enhanced Measurement의 'browser history events 기반 page changes' 설정(기본 ON)에만 의존한다.

두 가지 옵션이 검토되었다.

- **옵션 A**: Enhanced Measurement 의존 (경량). GA4 admin 설정이 ON이면 자동으로 history 이벤트 기반 page_view를 GA4가 자체 처리. 코드 변경 없음.
- **옵션 B**: 코드 기반 트래커. `usePathname` + `useSearchParams` 변경을 감지하여 `sendGAEvent('event', 'page_view', ...)` 직접 전송. GA4 admin 설정 무관, 테스트 가능, 중복 카운트 방지를 위해 Enhanced Measurement의 history 기반 page changes는 OFF 권장.

사용자가 **옵션 B(코드 기반 트래커)**를 선택했다.

## 결정

### D0. 라우트 추적 방식 — 코드 기반 트래커 (옵션 B)

옵션 A는 GA4 admin 설정 상태에 의존하여 코드로 보장이 불가능하고 테스트할 수 없다. **결정: 옵션 B로 진행.**

GA4 admin에서 Enhanced Measurement의 'browser history events 기반 page changes' 설정을 OFF하여 중복 카운트를 방지할 것을 권장한다 (사용자 직접 설정 필요, 코드 범위 외).

### D1. useSearchParams Suspense 경계 필수화

Next.js App Router에서 `useSearchParams()`를 사용하는 클라이언트 컴포넌트는 `<Suspense>` 경계로 감싸야 한다. 미적용 시 빌드 시 정적 렌더링 deopt 경고가 발생하고, 잠재적으로 전체 라우트가 SSR에서 클라이언트 렌더링으로 강등된다.

### D2. 초기 마운트 skip — 중복 page_view 방지

`GoogleAnalytics` 컴포넌트(상위)의 `gtag('config', gaId)` 호출이 초기 로드 page_view를 이미 발생시킨다. `useRef(true)` 로 초기 마운트를 감지하여 첫 렌더 시 `sendGAEvent` 호출을 건너뛴다.

## 구현

### Phase A — GoogleAnalyticsRouteTracker 신규

`src/components/analytics/GoogleAnalyticsRouteTracker.tsx` 신규 ('use client'):

- `usePathname`, `useSearchParams`(next/navigation)로 현재 경로 및 쿼리 파라미터 감지 (next-intl localePrefix 'as-needed' 포함 전체 경로)
- `useRef(true)` 초기 마운트 플래그 — 첫 렌더 skip(gtag config 초기 page_view 중복 방지)
- `useEffect([pathname, searchParams])` — 변경 시 `sendGAEvent('event', 'page_view', { page_location: window.location.href, page_title: document.title })` 전송
- 컴포넌트는 `null` 반환 (UI 없음)

### Phase B — GoogleAnalytics.tsx 수정

`src/components/analytics/GoogleAnalytics.tsx` 수정:

- `measurementId` 존재 시 `NextGoogleAnalytics` + `<Suspense fallback={null}><GoogleAnalyticsRouteTracker /></Suspense>` 동반 렌더
- `useSearchParams`를 사용하는 `GoogleAnalyticsRouteTracker`는 App Router에서 Suspense 경계 필수
- 측정 ID 미설정 시 `null` no-op 유지 (Sprint 210 패턴 계승)

### Phase C — 테스트

`src/components/analytics/GoogleAnalyticsRouteTracker.test.tsx` 신규 — 7케이스:

- 초기 마운트 시 `sendGAEvent` 미전송(skip) 확인
- `null` 반환 확인
- `pathname` 변경 시 `sendGAEvent` 전송 확인
- `sendGAEvent` 인자 — 이벤트명 `'event'`, 액션 `'page_view'`
- `searchParams` 변경 시 `sendGAEvent` 전송 확인
- `page_location` string 타입 검증(jsdom `window.location.href` non-configurable 제약으로 값 정밀 검증 대신 타입 검증)
- `page_title` — `document.title` 정밀 검증

`src/components/analytics/GoogleAnalytics.test.tsx` 보강 — 2케이스:

- 측정 ID 설정 시 `GoogleAnalyticsRouteTracker` 동반 렌더 확인
- 측정 ID 미설정 시 `GoogleAnalyticsRouteTracker` 미렌더 확인

### Phase D — 의존성/CSP 무변경

`sendGAEvent`는 기존 dataLayer push 래퍼라 신규 외부 도메인이 없다. 신규 npm 패키지 없음, `npm install` 미실행, `package-lock.json` 무변경(Sprint 210 lockfile prune 재발 차단 패턴 준수).

## 검증

Oracle 직접 검증 (`npm ci` 기반 CI 환경 재현):

- `npm ci` EXIT=0 — monaco-editor 등 의존성 보존, lockfile 드리프트 없음
- `npx tsc --noEmit` → EXIT=0, 오류 0건
- `npx next lint` (raw) → EXIT=0, analytics 신규 파일 warning 0 (기존 chart/sidebar 등 기존 warning만)
- `npx next build` → EXIT=0, ✓ Compiled 16.6s, 정적 5/5 (Suspense deopt 없음)
- `test:coverage` → EXIT=0, 134 suites / 1390 tests (기존 1381+신규 9)
  - `GoogleAnalytics.tsx` 100% (stmts/branch/funcs/lines)
  - `GoogleAnalyticsRouteTracker.tsx` 100% (stmts/branch/funcs/lines)
  - 글로벌 임계값(lines 83 / branches 71 / functions 82 / statements 81) 충족

커밋: `20a8eed feat(frontend): GA4 라우트 변경 page_view 추적 트래커 추가`

### ADR 인덱스 게이트

- `node scripts/check-adr-index-count.mjs --strict` → 영구 8 / 토픽 1 / sprint **149**
- `node scripts/check-adr-en-coverage.mjs --lint` → **158/158 (100%)**
- `node scripts/check-doc-refs.mjs` → 0 broken
- `node scripts/check-i18n-residue.mjs --strict` → prose Hangul max 2.19% (임계 8% 이내)

## 교훈

1. **`@next/third-parties` GoogleAnalytics는 SPA 라우트 추적 미포함** — `gtag('config', gaId)` 1회 호출로 초기 로드 page_view만 발생. App Router soft navigation 추적은 Enhanced Measurement 의존 또는 명시적 라우트 트래커가 필요하다. 라이브러리 추가 시 SPA 환경에서의 동작을 검증해야 한다.
2. **`useSearchParams`는 App Router에서 Suspense 경계 필수** — `useSearchParams()`를 사용하는 클라이언트 컴포넌트를 `<Suspense>`로 감싸지 않으면 빌드 시 정적 렌더링 deopt가 발생한다. `useSearchParams` 의존 클라이언트 컴포넌트는 항상 Suspense 격리.
3. **초기 마운트 skip으로 config 초기 page_view 중복 방지** — `useRef(true)` 플래그로 첫 렌더 시 이벤트 발송을 건너뛰어 상위 `gtag config` 초기 page_view와의 중복을 방지한다. Effect cleanup과 독립적으로 동작하는 단순하고 신뢰할 수 있는 패턴.
4. **jsdom `window.location` 제약 — 타입 검증으로 대체** — jsdom 환경에서 `window.location.href`는 non-configurable이라 mock 또는 값 재정의가 불가능하다. 정확한 URL 값 검증 대신 `string` 타입 검증으로 대체하여 테스트 가능성과 실용성을 균형.

## 신규 패턴

- **App Router 라우트 변경 명시적 page_view 트래커 패턴** — `usePathname` + `useSearchParams` 변경 감지 + `useRef` 초기 마운트 skip + `sendGAEvent('event', 'page_view', ...)` 직접 전송. GA4 admin 설정 독립적, 테스트 가능, 중복 카운트 방지.
- **`useSearchParams` Suspense 격리 패턴** — `useSearchParams()` 의존 클라이언트 컴포넌트는 상위에서 `<Suspense fallback={null}>` 로 격리. App Router 정적 렌더링 deopt 차단 표준 패턴.

## Sprint 212+ 이월

- **GA4 admin Enhanced Measurement history page_view OFF** (사용자, GA4 admin에서 직접 설정 — 코드 기반 트래커와 중복 카운트 방지)
- **프로덕션 page_view UAT** (사용자 직접): `algo-su.com` 페이지 이동 시 GA4 실시간(Realtime) 보고서에서 page_view 누적 확인
- **GA4 프로덕션 동작 UAT** (Sprint 210 이월 지속): GA4 실시간(Realtime) 보고서 집계 확인 + 며칠 후 누적 사용자 확인
- **NEXT_PUBLIC_BASE_URL 도메인 정합** (algosu.kr → algo-su.com) + SEO sitemap/robots/hreflang/canonical 점검
- **운영 Sprint 196 마이그레이션 실행 + 서버 재배포** (사용자/운영)
- **하네스 `--full` CI 정기 실행 자동화 검토**

## Critic 교차 리뷰

**R1 — CLEAN** (Codex `gpt-5.5`, `codex review --base bbfbc2a`, session `019e6dbd-50ba-7d40-ba5f-fee30c9c7845`)

> "No discrete correctness issues were identified in the GA route-tracking changes or accompanying tests/docs. The implementation is consistent with the stated App Router soft-navigation tracking approach."

발견 Critical / High / Medium / Low **모두 0건**. 라우트 트래커·테스트·ADR 변경 전반에서 회귀 미발견. R1 CLEAN으로 추가 라운드 불필요(Critic placeholder 회귀 차단 결정 준수 — R1만 영속화).
