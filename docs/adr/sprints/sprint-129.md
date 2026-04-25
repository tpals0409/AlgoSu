---
sprint: 129
title: "로그인 이후 언어 변경 토글버튼 작동 불가 회귀 fix — H3 usePathname locale-aware + H1 Suspense 경계"
period: "2026-04-25"
status: completed
start_commit: 355da52
end_commit: "(PR squash 후 갱신 — Wave A 마지막 commit: 5f42157)"
prs:
  - "(통합 PR 예정) Sprint 129 Wave A: AppLayout usePathname locale-aware + LanguageSwitcher Suspense 경계"
---

# Sprint 129 — 로그인 이후 언어 변경 토글 회귀 fix

## 배경

사용자 보고: "로그인 이후 언어 변경 토글버튼이 작동하지 않는다." 비로그인 상태(랜딩/기타
공개 페이지)에서는 토글이 정상 작동하며, 로그인 후 대시보드·관리자 등 보호 라우트에서만
증상 재현. Sprint 126 Wave P0 (`lib/api/client.ts` locale-aware redirect) 이후 회귀로 의심.

Herald에 **Phase 1 정적 분석** 위임 → 5개 가설(H1~H5) 수립 후 코드베이스 전수 검증.
정적 분석으로 확정 가능한 H3(Secondary Bug) + H1(부분 확정)은 Wave A로 즉시 fix.
런타임 검증이 필요한 H4(Primary Suspect)는 Wave B로 보류.

### 처리 현황

| # | 항목 | Wave | 상태 |
|---|------|------|------|
| H3 | `AppLayout.tsx` usePathname import → locale-aware 교체 | A-1 | ✅ |
| H1 | LanguageSwitcher 4곳 Suspense 경계 추가 | A-2 | ✅ |
| 회귀 테스트 8건 신규 | isActive locale-aware 4건 + Suspense + EN locale 4건 | A-3 | ✅ |
| H4 | `client.ts:113-117` window.location.href 하드 오버라이드 | B | ⏸ 보류 |

---

## Phase 1 — 가설 검증 매트릭스 (Herald 정적 분석)

Herald inbox: `~/.claude/oracle/inbox/herald-task-20260425-122835-21417.md`

| 가설 | 내용 | 판정 |
|------|------|------|
| **H1** | useSearchParams Suspense 부재 → SSR 오류 | 가능(부분) — admin layout Server Component 경계 |
| **H2** | LanguageSwitcher 다중 인스턴스 race | 배제 — `hasStudy` 분기로 동시 1개, TopNav L335는 dead code |
| **H3** | 동적 라우트 usePathname — locale prefix 포함 문제 | **확정 (Secondary Bug)** — `AppLayout.tsx:17` `next/navigation` import (locale prefix 미제거) |
| **H4** | SWR 401 redirect 충돌 | **Primary Suspect** — `client.ts:113-117` `window.location.href` 하드 오버라이드, 정적 분석 한계로 확정 불가 |
| **H5** | next-intl 버전 버그 | 배제 — 정적 분석 한계 (버전 호환성은 런타임 검증 필요) |

**결정 원칙**: 정적 분석 확정 → Wave A 즉시 fix, 런타임 검증 필요 → Wave B 보류.

---

## Wave A — H3 + H1 즉시 fix

담당: Herald (구현), Critic (교차 리뷰)

Herald inbox: `~/.claude/oracle/inbox/herald-task-20260425-125011-22404.md`

### A-1 — H3 fix: `AppLayout.tsx` usePathname import 교체 (commit `a4fa7c9`)

**문제**: `AppLayout.tsx:17`이 `next/navigation`의 `usePathname`을 import.
`next/navigation` usePathname은 locale prefix(`/en`, `/ko`)를 포함한 전체 경로를 반환.
locale-stripped pathname(`/dashboard`)을 기대하는 `isActive` 판별 로직이 항상 불일치 →
영어 로케일에서 사이드바 nav 하이라이트 소실.

**수정**: `next/navigation` → `@/i18n/navigation` (next-intl wrapper) 로 교체.
`@/i18n/navigation`의 `usePathname`은 locale prefix를 제거한 경로를 반환.

```diff
- import { usePathname, useRouter } from 'next/navigation';
+ import { usePathname } from '@/i18n/navigation';
+ import { useRouter } from 'next/navigation';
```

**영향**: 영어 로케일(`/en/dashboard`)에서 `isActive('/dashboard')` 정상 판정 → 사이드바
하이라이트 회복.

### A-2 — H1 fix: LanguageSwitcher 4곳 Suspense 경계 추가 (commit `bddb225`)

**문제**: `LanguageSwitcher` 내부에서 `useSearchParams()`를 호출. Next.js 14 App Router에서
`useSearchParams()` 없는 Suspense 경계는 SSR에서 렌더링 중단 가능. 로그인 후 보호 라우트
진입 시 hydration 불안정으로 토글 마운트 실패 가능성.

**수정 포인트 4곳**:

| 파일 | 위치 | 처리 |
|------|------|------|
| `AppLayout.tsx` | L383 — 데스크탑 사이드바 | `<Suspense fallback={null}>` 추가 |
| `AppLayout.tsx` | L461 — 모바일 사이드바 | `<Suspense fallback={null}>` 추가 |
| `AuthShell.tsx` | L43 — 인증 Shell 헤더 | `<Suspense fallback={null}>` 추가 |
| `LandingContent.tsx` | L80 — 랜딩 헤더 | `<Suspense fallback={null}>` 추가 |

admin layout은 변경 불필요 — AppLayout 내부 Suspense로 이미 해소.

```tsx
// Before
<LanguageSwitcher />

// After
<Suspense fallback={null}>
  <LanguageSwitcher />
</Suspense>
```

### A-3 — 회귀 테스트 8건 신규 (commit `5f42157`)

**AppLayout.test.tsx — isActive locale-aware 4건**:
- `ko` 로케일: `/ko/dashboard` pathname → `isActive('/dashboard')` true
- `en` 로케일: `/en/dashboard` pathname → `isActive('/dashboard')` true
- locale-stripped `/dashboard` → `isActive('/dashboard')` true (기존 동작 보존)
- 비매칭 경로 → `isActive('/settings')` false

**LanguageSwitcher.test.tsx — Suspense + EN locale 4건**:
- Suspense 경계 내 마운트 시 렌더링 성공
- EN locale에서 switcher 렌더링 정상
- `aria-label` locale-aware 검증
- 현재 locale 표시 정확성

**Jest 결과**: 1400 → **1408** (+8 신규) PASS.

### 변경 요약

| 파일 | 작업 | 내용 |
|------|------|------|
| `frontend/src/app/[locale]/(protected)/AppLayout.tsx` | 수정 | usePathname import 교체 + Suspense 2곳 |
| `frontend/src/app/[locale]/auth/AuthShell.tsx` | 수정 | Suspense 추가 |
| `frontend/src/app/[locale]/(public)/LandingContent.tsx` | 수정 | Suspense 추가 |
| `frontend/src/app/[locale]/(protected)/__tests__/AppLayout.test.tsx` | 수정 | isActive locale-aware 4케이스 추가 |
| `frontend/src/components/LanguageSwitcher/__tests__/LanguageSwitcher.test.tsx` | 수정 | Suspense + EN locale 4케이스 추가 |

5 files, +167/-15

---

## Critic 1차 교차 리뷰

Critic inbox: `~/.claude/oracle/inbox/critic-task-20260425-130033-23349.md`

| 항목 | 등급 | 내용 | 조치 |
|------|------|------|------|
| — | Critical | 없음 | — |
| — | High | 없음 | — |
| `TopNav.tsx:335` Suspense 경계 누락 | Medium | AppLayout/AuthShell/LandingContent 3곳 수정, TopNav 미수정. 현재 앱 내 TopNav import 0건(dead code) → 런타임 영향 없음 | Sprint 130 시드 |
| `AppLayout.test.tsx:193~207` 중복 케이스 | Low | locale-stripped `/dashboard` 케이스 2개 동일 mock+assertion, 커버리지 기여 없음 | Sprint 130 시드 또는 정리 |

**Codex 판정 원문**:
> "The changes appear to correctly wrap the existing LanguageSwitcher call sites in Suspense and
> switch AppLayout to the locale-aware pathname hook without introducing any clear regressions.
> I did not find a discrete, actionable bug in the diff."

**세션 ID**: `019dc2cc-4408-7803-af83-7094fe8c85e4`

**종합: ✅ 머지 가능** (Critical/High 없음, Medium은 dead code라 차단 불가)

---

## Wave B 보류 결정 — H4 (Primary Suspect)

### 보류 사유

Phase 1 정적 분석에서 `client.ts:113-117`의 `window.location.href` 하드 오버라이드가
locale-switch 중 발생하는 401 redirect와 충돌할 가능성이 식별되었으나:

- 정적 분석으로 실제 충돌 경로 확정 불가 (컴포넌트 마운트 순서 + SWR 재검증 타이밍 의존)
- 로그인 이후 토글 증상이 H3/H1 fix만으로 해소될 가능성 존재

### 결정 기준

Wave A 머지 후:
- **토글 정상 동작** → H4는 false alarm으로 종결, Wave B 불필요
- **토글 여전히 작동 안 함** → Wave B 착수:
  - 방안 A: `isLocaleTransitioning` 플래그 — locale-switch 중 401 리다이렉트 일시 억제
  - 방안 B: SWR `onError` 컴포넌트별 처리 — 전역 window.location.href 대신 라우터 분기

### 구현 예정 위치

Sprint 129 후속 Wave B 또는 Sprint 130 신규 항목 (사용자 재현 결과에 따라 결정).

---

## 검증 결과

- `npx tsc --noEmit`: 통과
- `npx next lint`: 신규 warning 0
- `npx jest`: **131 suites, 1408 tests** 통과 (+8 신규)
- Critic 1차 codex 통과 (세션 `019dc2cc`)

## 에이전트 협업

| Agent | 담당 |
|-------|------|
| herald | Phase 1 정적 분석 (H1~H5 가설 검증) + Wave A 구현 (H3/H1 fix + 회귀 테스트) |
| critic | Wave A codex 교차 리뷰 (1차) |
| scribe | Sprint 129 ADR 작성 |

---

## 신규 패턴 / 교훈

### 1. usePathname import는 항상 locale-aware 버전 우선

`next/navigation`의 `usePathname`은 locale prefix(`/en`, `/ko`)를 포함한 전체 경로를 반환.
locale-stripped pathname이 필요한 모든 곳에서 `@/i18n/navigation`의 `usePathname`을 사용.

```ts
// ❌ locale prefix 포함 — isActive('/dashboard') 불일치
import { usePathname } from 'next/navigation';

// ✅ locale prefix 제거 — isActive('/dashboard') 정상 판정
import { usePathname } from '@/i18n/navigation';
```

이번 패턴은 Sensei 교육 세션 후보로 등록 (`@/i18n/navigation` vs `next/navigation` 혼용 탐지).

### 2. useSearchParams 사용 컴포넌트는 호출처에서 Suspense 감싸기

`useSearchParams()`를 내부 호출하는 컴포넌트(`LanguageSwitcher`)는 렌더링 트리의
**호출처**에서 `<Suspense fallback={null}>` 으로 감싸야 SSR hydration 안정성 확보.
컴포넌트 내부에서 자체 Suspense를 두는 것만으로는 부족 — 마운트 포인트마다 경계 명시 필요.

### 3. Phase 1 정적 분석 → 가설 분류 → Wave 단위 진행 패턴

```
Phase 1 (Herald 정적 분석)
  └─ 확정 가능(H3/H1) → Wave A 즉시 fix
  └─ 런타임 검증 필요(H4) → Wave B 보류
       └─ Wave A 머지 후 재현 여부로 결정
```

정적 분석 확정 버그를 먼저 fix하고 사용자 재현으로 런타임 버그를 추후 확정하는 방식이
불필요한 추측성 수정을 줄이고 리스크를 낮춤.

### 4. dead code TopNav — 점진적 정리 패턴

Critic이 TopNav:335 Suspense 누락을 Medium으로 식별했으나 "import 0건"이라 차단 불가.
즉시 삭제보다 시드 등록 후 별도 Wave에서 제거(또는 live 전환 시 함께 수정)하는 패턴.
dead code는 Critic이 발견해도 차단 등급 하향(Medium → sprint 시드).

---

## Sprint 130 시드 (3건)

| # | 항목 | 등급 | 담당 | 사유 |
|---|------|------|------|------|
| S1 | `TopNav.tsx:335` LanguageSwitcher Suspense 경계 추가 또는 dead code 제거 | Medium | Herald | Critic 1차 식별 — dead code라 즉시 차단 아님 |
| S2 | `AppLayout.test.tsx` 중복 케이스 정리 (`locale-stripped /dashboard` 2개 → 1개) | Low | Herald 또는 Scout | Critic 1차 식별 — 커버리지 기여 없는 중복 |
| S3 | Wave B (H4) — `client.ts` 401 핸들러 locale-switch 방어 | TBD | Architect | Wave A 머지 후 사용자 재현 결과에 따라 착수 여부 결정 |

---

## 참고

| 항목 | 경로 |
|------|------|
| Phase 1 가설 검증 보고서 | `~/.claude/oracle/inbox/herald-task-20260425-122835-21417.md` |
| Wave A 구현 결과 | `~/.claude/oracle/inbox/herald-task-20260425-125011-22404.md` |
| Critic 1차 codex 리뷰 | `~/.claude/oracle/inbox/critic-task-20260425-130033-23349.md` |
| Critic 세션 ID | `019dc2cc-4408-7803-af83-7094fe8c85e4` |
| Wave A commits | `a4fa7c9` / `bddb225` / `5f42157` |
| start_commit | `355da52` |
