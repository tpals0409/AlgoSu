---
sprint: 121
title: "글로벌 서비스 준비 — i18n 기반 구축 + 시범 2페이지 번역 적용"
period: "2026-04-23"
status: completed
start_commit: 216edfa
end_commit: 466d658
---

# Sprint 121 — i18n 아키텍처 설계 및 기반 구축

## 배경

AlgoSu 플랫폼은 현재 한국어 단일 언어로 서비스 중이다. 글로벌 사용자 유입 전략의 일환으로, 영어(en)를 추가 지원 언어로 도입하고 향후 언어 확장이 용이한 i18n 기반을 이 스프린트에서 확립한다.

Next.js 15 App Router 환경에서의 i18n 지원은 라이브러리 선택, URL 라우팅 전략, 번역 리소스 구조, 로케일 감지 순서 등 복합적 아키텍처 결정이 필요하다. Sprint 121 Phase A에서 이 네 가지 핵심 결정(D1~D4)을 ADR로 확정하고, Phase B~F에서 순차적으로 구현한다.

## 목표

| Phase | 내용 | 상태 |
|-------|------|------|
| A | i18n 아키텍처 ADR 작성 (D1~D4 확정) | ✅ 완료 |
| B | next-intl 설치 + Next.js App Router 연동 (미들웨어, i18n.ts, routing 설정) | ✅ 완료 |
| C | messages/{locale}/{namespace}.json 구조 생성 + 공통(common) 번역 초기화 | ✅ 완료 |
| D | 시범 페이지 1 — Landing 페이지 번역 적용 | ✅ 완료 |
| E | 시범 페이지 2 — Auth(로그인) 페이지 번역 적용 | ✅ 완료 |
| F | 언어 스위처 UI + Critic 수정 + ADR 최종화 | ✅ 완료 |

## 핵심 결정 (D1~D4)

### D1. i18n 라이브러리 — next-intl 선정

**선택**: `next-intl` (v3.x)

**대안 비교**:

| 항목 | next-intl | next-i18next |
|------|-----------|--------------|
| App Router 공식 지원 | ✅ 네이티브 지원 | ⚠️ Pages Router 중심, App Router 비공식 |
| Server Component 번역 | ✅ RSC에서 직접 호출 가능 | ❌ 클라이언트 사이드 한정 |
| 미들웨어 로케일 감지 | ✅ 내장 (`createMiddleware`) | ⚠️ 별도 구성 필요 |
| 타입 안전성 | ✅ `useTranslations` 타입 추론 | ⚠️ 부분적 |
| 번들 크기 (gzip) | ~11 KB | ~15 KB |
| 마지막 릴리즈 | 활발 (2024~) | 유지보수 모드 |

**근거**: Next.js 15 App Router + React Server Components 환경에서 `next-i18next`는 공식적으로 지원되지 않는다. `next-intl`은 RSC에서도 `getTranslations()`, 클라이언트 컴포넌트에서 `useTranslations()`를 동일한 API로 사용할 수 있어 패턴 일관성을 보장한다. 또한 내장 미들웨어와 `createNavigation()`이 App Router 라우팅과 직접 연동되어 별도 래퍼 없이 타입 안전한 `Link`, `redirect`를 제공한다.

**트레이드오프**: next-intl은 자체 미들웨어가 기존 인증 미들웨어(`middleware.ts`)와 체인이 필요하다. Matcher 패턴을 분리하거나 `withAuth(withI18n(...))` 형태의 래핑 전략이 필요하다 (Phase B에서 구체화).

---

### D2. URL 라우팅 전략 — `/en/*` prefix, 기본 `ko` prefix 생략

**선택**:
- 영어: `/en/dashboard`, `/en/problems` 등 `/en` prefix 명시
- 한국어(기본): `/dashboard`, `/problems` 등 prefix 없음 (생략)

**대안 비교**:

| 전략 | 예시 | 장점 | 단점 |
|------|------|------|------|
| 기본 로케일 prefix 생략 | `/dashboard` (ko), `/en/dashboard` | 기존 URL 유지, SEO 영향 최소화 | 로케일 구분이 URL만으로 불분명 |
| 모든 로케일 prefix 포함 | `/ko/dashboard`, `/en/dashboard` | 명확한 로케일 표시 | 기존 링크·북마크 전부 파손 |
| 쿠키 기반 (prefix 없음) | `/dashboard` (ko/en 쿠키로 결정) | URL 변경 없음 | SEO hreflang 불가, 크롤러 로케일 식별 불가 |

**근거**: AlgoSu는 현재 `/dashboard`, `/problems` 등의 한국어 URL을 이미 서비스 중이다. `prefix 생략` 방식을 선택하면 기존 사용자의 북마크·링크가 깨지지 않고, Google Search Console 재등록 없이 기존 SEO를 유지할 수 있다. 영어 사용자는 `/en/*`으로 명확한 언어 구분이 가능하여 hreflang 태그 적용도 용이하다.

**트레이드오프**: `next-intl`의 `localePrefix: 'as-needed'` 옵션으로 구현 가능하나, 미들웨어의 `defaultLocale` 처리 로직을 명확히 해야 한다. `/`(루트) 접근 시 감지 순서(D4)에 따라 ko 또는 en으로 내부 리다이렉트.

---

### D3. 번역 리소스 구조 — `messages/{locale}/{namespace}.json`

**선택**:
```
frontend/messages/
  ko/
    common.json        # 공통 UI 문자열 (버튼, 레이블, 에러 메시지)
    landing.json       # 랜딩 페이지 전용
    auth.json          # 인증 페이지 전용 (로그인, OAuth 에러)
    difficulty.json    # 난이도 레이블 (브론즈/실버/골드/플래티넘/다이아)
  en/
    common.json
    landing.json
    auth.json
    difficulty.json
```

**대안 비교**:

| 구조 | 예시 | 장점 | 단점 |
|------|------|------|------|
| 단일 파일 per locale | `ko.json` | 단순 | 파일 비대화, lazy load 불가 |
| 네임스페이스 분리 (선택) | `messages/ko/landing.json` | 페이지별 lazy load, 관심사 분리 | 디렉토리 깊이 추가 |
| 도메인별 분리 | `locales/ko/auth.json` | 도메인 맥락 명확 | next-intl 기본 경로와 다름 |

**확정 네임스페이스 (4개)**:

| 네임스페이스 | 포함 내용 |
|-------------|-----------|
| `common` | 버튼(저장/취소/확인), 로딩, 에러 공통 문구, Nav 메뉴명, Footer |
| `landing` | 히어로 섹션, 기능 소개, CTA 버튼 |
| `auth` | 로그인 제목/설명, GitHub OAuth 버튼, 에러 메시지, 리다이렉트 안내 |
| `difficulty` | 브론즈/실버/골드/플래티넘/다이아 레이블 + 툴팁 설명 |

**근거**: `next-intl`은 `getTranslations({ namespace: 'landing' })` 방식으로 네임스페이스 단위 로드를 지원한다. 페이지별 번들 분리로 초기 로드 크기를 최소화하고, 네임스페이스 추가만으로 신규 페이지 번역을 독립적으로 확장할 수 있다. 네임스페이스 4개로 시작하여 이후 `dashboard`, `problems`, `submissions` 등을 순차 추가한다.

**트레이드오프**: 네임스페이스가 늘어날수록 번역 파일 관리 비용이 증가한다. 향후 i18n 관리 도구(Lokalise, Crowdin 등) 도입 시 이 디렉토리 구조가 표준 포맷과 호환된다.

---

### D4. 기본 로케일 및 감지 순서

**선택**:
- **기본 로케일**: `ko` (한국어)
- **Fallback**: `ko` (번역 키 누락 시 한국어 문자열 표시)
- **감지 순서**: URL prefix → 쿠키(`NEXT_LOCALE`) → `Accept-Language` 헤더

**감지 로직 상세**:

```
1. URL에 /en prefix 있음  → locale: en
2. URL prefix 없음        →
   a. 쿠키 NEXT_LOCALE=en → locale: en
   b. 쿠키 없음           →
      i.  Accept-Language: en-* → locale: en
      ii. 그 외 또는 없음  → locale: ko (기본)
```

**근거**:
- **URL 최우선**: 북마크·공유 링크의 로케일을 항상 존중. SEO hreflang과 일치.
- **쿠키 2순위**: 언어 스위처로 선택한 로케일을 기억. prefix 없는 URL에서도 사용자 설정 유지.
- **Accept-Language 3순위**: 최초 방문 신규 사용자에게 브라우저 설정 기반 자동 감지. 단, URL과 쿠키가 없을 때만 작동.
- **기본 ko**: 대다수 기존 사용자가 한국어 사용자이므로 감지 실패 시 한국어 제공이 안전하다.

**Fallback 전략**: `next-intl`의 `messages` 옵션에서 `en` 로케일에 번역이 없는 키는 자동으로 `ko`로 폴백하지 않는다 — 누락 키는 빌드 타임 경고로 감지하고, 런타임에는 키 문자열을 그대로 표시한다. 번역 완성도 보장을 위해 CI에서 `next-intl` 키 누락 검사를 추가한다 (Phase F 또는 Sprint 122).

---

## Phase B~F 구현 계획 개요

### Phase B — next-intl 설치 및 App Router 연동

- `npm install next-intl` (frontend 패키지 — 프로젝트는 npm 사용)
- `frontend/i18n.ts` — `routing` 객체 설정 (`locales: ['ko', 'en']`, `defaultLocale: 'ko'`, `localePrefix: 'as-needed'`)
- `frontend/middleware.ts` — 기존 인증 미들웨어와 next-intl `createMiddleware` 체인 연결
- `frontend/app/[locale]/` — App Router locale 세그먼트 구조로 레이아웃 재배치
- `next.config.ts` — `withNextIntl` 래퍼 적용

### Phase C — 번역 리소스 초기화

- `messages/ko/*.json` 4개 파일 생성 (common, landing, auth, difficulty)
- `messages/en/*.json` 4개 파일 생성 (동일 키, 영문 번역)
- TypeScript 타입 자동 생성 설정 (`global.d.ts` 또는 next-intl 타입 플러그인)

### Phase D — Landing 페이지 번역 적용 (시범 1)

- `app/[locale]/(marketing)/landing/page.tsx` 서버 컴포넌트에서 `getTranslations('landing')` 사용
- `messages/{locale}/landing.json` 키 매핑 완성
- 메타데이터 (`metadata`) 로케일별 분기 적용

### Phase E — Auth 페이지 번역 적용 (시범 2)

- `app/[locale]/(auth)/login/page.tsx` 클라이언트 컴포넌트에서 `useTranslations('auth')` 사용
- OAuth 에러 메시지 (`auth.json` `errors.*` 키) 번역
- `app/[locale]/(auth)/callback/page.tsx` 에러 안내 문구 번역

### Phase F — 언어 스위처 UI + Critic 수정 + ADR 최종화

**실행 결과** (Palette — 4 commits):

| 커밋 | 내용 |
|------|------|
| `6379fb5` | fix(frontend): callback OAuth 에러 한국어 fallback 제거 [M-E2] |
| `b1c3590` | fix(frontend): callback Suspense fallback 접근성 보강 [L-E1] |
| `588f968` | feat(frontend): LanguageSwitcher 컴포넌트 + TopNav 통합 |
| (본 커밋) | docs(adr): Sprint 121 ADR 최종화 |

**변경 파일**:

| 파일 | 작업 | 설명 |
|------|------|------|
| `components/layout/LanguageSwitcher.tsx` | 신규 | ko/en 로케일 전환 버튼 (radiogroup, Glassmorphism) |
| `components/layout/__tests__/LanguageSwitcher.test.tsx` | 신규 | 단위 테스트 10건 |
| `components/layout/TopNav.tsx` | 수정 | LanguageSwitcher 삽입 (테마 토글 좌측) |
| `components/layout/__tests__/TopNav.test.tsx` | 수정 | LanguageSwitcher mock 추가 |
| `app/[locale]/(auth)/callback/page.tsx` | 수정 | M-E2 한국어 fallback 제거 + L-E1 Suspense aria-label |
| `messages/{ko,en}/auth.json` | 수정 | errors.accountConflict 키 추가 |
| `messages/{ko,en}/common.json` | 수정 | loading.verifying + language.* 키 추가 |

**Critic M-E1 검증 결과**: `expired.*`, `demo.*`, `guest.*` 키는 모두 `login/page.tsx`에서 사용 중 — 미사용 아님, 제거 불요.

**검증**:
- `tsc --noEmit` 통과
- `next lint` 경고/에러 없음
- `next build` 성공
- Jest 122 suites / 1308 tests 전체 통과 (LanguageSwitcher 10건 포함)

### Phase F 긴급 수정 — Critic 6차 리뷰 M-F1/M-F2 (Palette)

**발견**: Critic 6차 리뷰에서 Sprint 121 핵심 목표 미달성 판정. TopNav.tsx는 앱 렌더링에서 실제로 import/사용되지 않으며, 사용자가 보는 레이아웃은 AppLayout.tsx. LanguageSwitcher가 TopNav에만 통합되어 사용자 시야에 노출 불가.

**실행 결과** (Palette — 2 commits):

| 커밋 | 내용 |
|------|------|
| `f864cf5` | feat(frontend): LanguageSwitcher AppLayout 통합 [M-F1] |
| `466d658` | fix(frontend): LanguageSwitcher 쿼리 파라미터 보존 [M-F2] |

**변경 파일**:

| 파일 | 작업 | 설명 |
|------|------|------|
| `components/layout/AppLayout.tsx` | 수정 | 사이드바 하단(테마 토글 아래) + No-study 상단바에 LanguageSwitcher 삽입 |
| `components/layout/__tests__/AppLayout.test.tsx` | 수정 | LanguageSwitcher mock + 렌더링 테스트 1건 추가 |
| `components/layout/LanguageSwitcher.tsx` | 수정 | useSearchParams 추가로 쿼리 파라미터 보존, @related AppLayout 추가 |
| `components/layout/__tests__/LanguageSwitcher.test.tsx` | 수정 | next/navigation mock + 쿼리 파라미터 보존 테스트 3건 추가 |

**검증**:
- `tsc --noEmit` 통과
- `next lint` 경고/에러 없음
- `next build` 성공
- Jest 122 suites / 1312 tests 전체 통과 (+4건: AppLayout 1 + LanguageSwitcher 3)

### 마감 후 발견된 UX 결함 (Sprint 122 이관 확정)

**증상**: 머지 후 사용자 리포트 — "토글버튼 미동작, 영문 사이트에서도 한글".

**진단**:
- `LanguageSwitcher`는 `AppLayout`에만 통합되어 있음 (로그인 후 화면에서만 노출).
- **랜딩 페이지(`LandingContent.tsx`)와 인증 레이아웃(`app/[locale]/(auth)/layout.tsx`)에는 토글 버튼이 렌더링되지 않음** — 로그인 전 사용자는 UI로 locale 전환 불가.
- URL 직접 입력(`/en/`)으로 영문 랜딩은 정상 렌더링되나, 그 외 미번역 페이지(dashboard, problems 등 — Sprint 121 범위 외)는 한국어 유지.
- `app/[locale]/layout.tsx`(skip-nav), `app/[locale]/not-found.tsx`, `app/[locale]/*/error.tsx`(12+ 파일), `components/ad/AdBanner.tsx` 등에 **하드코딩 한글 문자열** 잔존.

**판정**: Sprint 121 범위(기반 + 시범 2페이지 = 랜딩/auth)는 기술적으로 충족. 단, 사용자 UX 완성을 위해 Sprint 122 최우선 Phase로 이관.

**Sprint 122 최우선 작업 (영문화 완성 — `sprint-window.md [2]` 참조)**:
1. LanguageSwitcher UX 경로 완성 (LandingContent Nav + Auth layout)
2. 하드코딩 한글 일괄 정리 (layout skip-nav, not-found, error.tsx 12+, AdBanner)
3. 주요 페이지 번역 확장 (dashboard/problems/submissions/reviews/profile/settings)

---

## 이월 항목 (Sprint 122+ 예정)

### 백엔드 응답 메시지 영문화

백엔드(NestJS/FastAPI) 에러 메시지 및 응답 본문의 영문화는 이번 스프린트 범위에서 제외한다.

**보류 근거**: 백엔드 응답은 현재 클라이언트가 직접 노출하지 않고 프론트엔드에서 번역 키로 매핑하는 방식을 선택했다. `Accept-Language` 헤더 기반 서버 응답 국제화는 별도 전략(e.g., NestJS `i18n` 모듈) 수립이 필요하며, Sprint 122에서 검토한다.

### sitemap.xml / robots.txt 로케일 대응

`hreflang` 태그가 포함된 sitemap.xml 생성 및 `robots.txt` 업데이트는 Phase D~E 번역 적용 완료 후 실제 URL 구조가 확정되면 진행한다.

**예정 내용**:
```xml
<url>
  <loc>https://algosu.kr/problems</loc>
  <xhtml:link rel="alternate" hreflang="ko" href="https://algosu.kr/problems"/>
  <xhtml:link rel="alternate" hreflang="en" href="https://algosu.kr/en/problems"/>
</url>
```

### 나머지 페이지 번역 적용 (Sprint 122+)

이번 스프린트는 Landing + Auth 시범 2페이지로 한정한다. 이후 페이지는 우선순위 순으로 적용 예정:

| 우선순위 | 페이지/컴포넌트 | 네임스페이스 추가 |
|----------|----------------|-------------------|
| 1 | Dashboard | `dashboard.json` |
| 2 | Problems 목록/상세 | `problems.json` |
| 3 | Submissions | `submissions.json` |
| 4 | Nav, Footer 공통 컴포넌트 고도화 | `common.json` 확장 |
| 5 | Admin 패널 | `admin.json` |

### Frontend P1 보안 3건 (p1-023~025, Sprint 122로 이월)

Sprint 120 Frontend 재감사에서 발견된 P1 3건은 i18n 작업과 독립적이므로 Sprint 122에서 처리한다.

| Finding | 파일 | 내용 |
|---------|------|------|
| p1-023 | middleware.ts | /shared 경로 PUBLIC_PATHS 누락 |
| p1-024 | admin/layout.tsx | admin 권한 CSR 전용 |
| p1-025 | callback/page.tsx | OAuth error fragment 직접 표시 |

### Sprint 122 이월 시드 (Phase F 도출)

| 항목 | 출처 | 설명 |
|------|------|------|
| 동적 번역 키 타입 안전성 | Critic Low-2 | `t(\`login.provider.${providerId}\`)` 등 동적 키의 타입 추론 한계 — next-intl 타입 플러그인 또는 커스텀 타입 맵 검토 |
| CI 번역 키 패리티 검사 | Critic M-C2 | ko/en JSON 키 구조 불일치 자동 감지 CI 스텝 추가 |
| AuthContext locale-aware 전환 | Phase F 발견 | `AuthContext.tsx`의 `window.location.href` 호출이 locale prefix 미고려 — `useRouter` 전환 필요 |
| 백엔드 OAuth 에러 코드 영문화 | M-E2 근본 해결 | 백엔드가 구조화 에러 코드(`account_conflict` 등)를 반환하도록 전환 — 현재 프론트엔드 화이트리스트 기반 임시 대응 |
| register 페이지 번역 | 범위 외 | `register/`, `register/github`, `register/profile` 3페이지 i18n 적용 |
| renderWithI18n 테스트 마이그레이션 확대 | Critic Low-2 | 기존 `render()` 직접 호출 테스트 → `renderWithI18n()` 점진 전환 |

---

## 관련 문서

- ADR 이전 스프린트: [sprint-120.md](./sprint-120.md)
- i18n 라이브러리: [next-intl 공식 문서](https://next-intl-docs.vercel.app/)
- 디자인 토큰: `CLAUDE.md` § 디자인 토큰 (UI v2)
- 언어 스위처 UI: Palette 에이전트 가이드 준수 (`components/layout/` 배치)
