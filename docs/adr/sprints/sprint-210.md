---
sprint: 210
title: "Google Analytics(GA4) 누적 방문자 추적 통합 (경량, frontend 전용)"
date: "2026-05-28"
status: completed
agents: [Oracle, Architect]
related_adrs: ["sprint-209"]
related_memory: ["sprint-window"]
topics: ["frontend", "analytics", "ga4", "csp"]
tldr: "AlgoSu frontend(Next.js 15.5.15 App Router)에 GA4 추적을 통합하여 누적 방문자를 Google GA4 대시보드에서 확인 가능하게 했다. 옵션 A(GA4 대시보드 직접 확인, 경량) 선택 — 앱 내 수치 표출/GA4 Data API/service account/백엔드 없음. @next/third-parties/google의 GoogleAnalytics 컴포넌트 사용, 측정 ID 미설정 시 no-op(Sentry enabled 패턴 계승), CSP 갱신. 핵심 교훈: npm install vs npm ci lockfile 정합 함정 — Architect의 npm install이 49개 패키지를 prune하여 로컬 테스트 통과 + CI npm ci 실패를 야기, Oracle 검증 단계에서 포착 후 원본 lockfile 복원+npm install --package-lock-only로 교정."
---
# Sprint 210 — Google Analytics(GA4) 누적 방문자 추적 통합 (경량, frontend 전용)

## 목표

- AlgoSu frontend(Next.js 15.5.15 App Router)에 GA4 추적을 통합한다.
- 누적 방문자를 Google GA4 대시보드에서 확인 가능하게 한다.
- 범위를 경량 옵션(GA4 대시보드 직접 확인)으로 제한하여 앱 내 표출/Data API/백엔드 의존성을 배제한다.

## 배경

AlgoSu 서비스의 누적 방문자 수를 추적하기 위한 분석 도구가 필요했다. 두 가지 구현 옵션이 검토되었다.

- **옵션 A**: GA4 대시보드에서 직접 확인. `@next/third-parties/google` 컴포넌트 삽입만으로 완결. 측정 ID 발급 후 대시보드 접속으로 수치 확인.
- **옵션 B**: 앱 내 방문자 수치 표출. GA4 Data API + service account(SealedSecret) + 백엔드 엔드포인트 + frontend 컴포넌트 전체 스택 필요.

사용자가 **옵션 A(경량)**를 선택했다.

## 결정

### D0. 누적 방문자 조회 경로 — GA4 대시보드 직접 확인 (옵션 A)

앱 내 표출(옵션 B)은 GA4 Data API + service account SealedSecret + 백엔드 엔드포인트를 필요로 하며 이번 sprint 범위를 초과한다. **결정: 옵션 A로 진행, 옵션 B는 별도 sprint 후보로 이월.**

### D1. GA 통합 방식 — `@next/third-parties/google` 공식 컴포넌트

Next.js 공식 `@next/third-parties` 패키지의 `GoogleAnalytics` 컴포넌트를 사용한다. 측정 ID는 `NEXT_PUBLIC_GA_MEASUREMENT_ID` 환경변수로 주입한다.

| 방식 | 접근 | 선택 |
|------|------|------|
| `@next/third-parties/google` | Next.js 공식 third-parties, 서버 컴포넌트 호환, 자동 스크립트 최적화 | ✅ |
| 직접 `<script>` 삽입 | gtag.js 수동 주입 | ❌ (비관용적, 최적화 미적용) |

### D2. 조건부 활성화 — 측정 ID 미설정 시 no-op

측정 ID가 falsy(미설정/빈 문자열)이면 컴포넌트가 `null`을 반환(no-op)한다. 기존 Sentry(`sentry.client.config.ts`의 `enabled: !!NEXT_PUBLIC_SENTRY_DSN`) 패턴을 계승한다.

## 구현

### Phase A — 의존성 추가

`@next/third-parties@^15.5.15` 추가 (`npm install` 시 `15.5.18` resolve).

**lockfile 교정 (핵심 사건)**:
Architect의 초기 `npm install` 실행 시 `@monaco-editor/react`의 peer인 `monaco-editor` 및 `webpack`/`dompurify`/`marked` 등 49개 필수 패키지가 `package-lock.json`에서 잘못 prune되었다(−662 라인). `npm install`은 lenient하여 로컬 `test:coverage`(1381 통과)는 성공했으나, CI가 사용하는 strict `npm ci`는 `EUSAGE Missing: monaco-editor from lock file`로 실패했다. Oracle 검증 단계에서 포착 후 `02018fc` 원본 lockfile을 완전 복원하고 `npm install --package-lock-only`로 신규 2개 dep만 추가하여 diff를 +24/−11로 정상화, `npm ci` EXIT=0(1112 패키지) 확인.

### Phase B — GoogleAnalytics 서버 컴포넌트 래퍼 신규

`src/components/analytics/GoogleAnalytics.tsx` 신규:
- `@next/third-parties/google`에서 `GoogleAnalytics as GA` import(네이밍 충돌 회피 alias)
- `NEXT_PUBLIC_GA_MEASUREMENT_ID` falsy 시 `null` 반환

### Phase C — RootLayout 통합

`src/app/layout.tsx` — body 내 `children` 뒤 `<GoogleAnalytics />` 삽입.

### Phase D — CSP 갱신

`next.config.ts` Content-Security-Policy 헤더 갱신:
- `script-src`: `googletagmanager.com` 추가
- `img-src`: `googletagmanager.com`, `google-analytics.com`, `*.google-analytics.com` 추가
- `connect-src`: `google-analytics.com`, `*.google-analytics.com`, `*.analytics.google.com`, `googletagmanager.com` 추가

기존 `cdn.jsdelivr.net` 등 기존 출처는 유지.

### Phase E — `.env.example` 갱신

`NEXT_PUBLIC_GA_MEASUREMENT_ID=` + 용도 주석 추가.

### Phase F — 테스트 7케이스

`src/components/analytics/GoogleAnalytics.test.tsx` 신규 — 7케이스:
- 측정 ID 설정 시 `<GoogleAnalytics>` 렌더링 확인
- `undefined` / 빈 문자열 / 미설정 시 `null` 반환(no-op) 확인
- 컴포넌트 branch coverage 100%

`@testing-library/dom` devDependency 복원(기존 `npm install` prune 부수 피해).

## 검증

### 게이트

- `npm ci` → added 1112 packages, EXIT=0 (CI install 정합 확인)
- `npx tsc --noEmit` → EXIT=0, 오류 0건
- `npx next lint` → EXIT=0 (Error 0, 기존 UI 컴포넌트 Warning만)
- `npx jest src/components/analytics` → **7/7 통과** (branch coverage 100%)
- `test:coverage` (전체): 133 suites, 1381 tests, 임계값(lines 83 / branches 71 / functions 82 / statements 81) 충족

### ADR 인덱스 게이트

- `node scripts/check-adr-index-count.mjs --strict` → 영구 8 / 토픽 1 / sprint **148**
- `node scripts/check-adr-en-coverage.mjs --lint` → **157/157 (100%)**
- `node scripts/check-doc-refs.mjs` → 0 broken

## 교훈

1. **npm install vs npm ci lockfile 정합 함정** — `npm install`은 lenient하여 node_modules를 직접 설치하되 package-lock.json을 peer 의존성 기준으로 재계산하면서 기존 패키지를 prune할 수 있다. `npm ci`는 lockfile을 SSOT로 삼아 lock에 없는 패키지를 `EUSAGE`로 거부한다. 결과적으로 `npm install` 통과 ≠ `npm ci` 통과. **의존성 추가 PR은 반드시 `npm ci`로 검증해야 한다.** 신규 dep 추가 시 `npm install --package-lock-only`를 사용하면 node_modules를 건드리지 않고 lockfile만 정밀 갱신할 수 있다.
2. **prune된 node_modules 아티팩트 오인** — Architect가 보고한 'pre-existing CodeEditor.tsx L262 tsc 오류'는 실제로는 prune된 node_modules의 아티팩트였다. lockfile 복원+`npm ci` 후 tsc 오류 0건으로 자연 해소. 빌드/타입 오류 진단 전에 lockfile 정합 여부를 먼저 확인해야 한다.
3. **Oracle 검증 단계가 lockfile 드리프트를 포착** — 로컬 테스트(npm install 환경)가 모두 통과했어도 Oracle 검증 단계에서 `npm ci`를 직접 실행하여 CI 환경을 재현했기 때문에 머지 전에 문제를 포착할 수 있었다. 에이전트 위임 후 Oracle 직접 검증 단계는 환경 차이로 인한 숨은 결함을 잡는 방어선이다.

## 신규 패턴

- **의존성 추가 시 `npm install --package-lock-only` + `npm ci` 검증 패턴** — 신규 npm 패키지 추가 시 `npm install --package-lock-only`로 lockfile만 갱신(node_modules 불변) + 이후 `npm ci` EXIT=0 검증 필수. `npm install` 단독은 lockfile prune 위험 내재.
- **Sentry no-op 계승 패턴** — 환경변수 기반 선택적 서드파티 통합 시 `!!ENV_VAR` falsy 조건으로 컴포넌트 `null` 반환(no-op). `sentry.client.config.ts`의 `enabled: !!NEXT_PUBLIC_SENTRY_DSN` → `GoogleAnalytics` 컴포넌트로 일반화.

## Sprint 211+ 이월

- **프로덕션 GA4 측정 ID(G-XXXXXXX) 발급 + frontend Dockerfile ENV/ARG 주입** (운영/사용자 트랙, Sentry DSN 선례).
- **쿠키 동의(GDPR consent mode)** — 별도 sprint 후보.
- **GA4 Data API 앱 내 표출** (옵션 B, 사용자가 옵션 A 선택으로 이번 sprint 제외).
- **운영 Sprint 196 마이그레이션 실행 + 서버 재배포** (사용자/운영) — problem_db jsonb 전환 + GIN 인덱스.
- **누적 UAT** (사용자 직접) — 프로그래머스 재제출 채점 / 영문 production Grafana CB dashboard.
