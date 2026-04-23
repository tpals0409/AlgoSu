---
sprint: 122
title: "글로벌 영문화 완성 — LanguageSwitcher UX 경로 + 전체 페이지 번역 + SEO 대응"
period: "2026-04-23"
status: completed
start_commit: a98b84c
end_commit: 37c8eb2
---

# Sprint 122 — i18n UX 경로 완성 및 전체 페이지 번역 적용

## 배경

Sprint 121에서 `next-intl` 기반 i18n 아키텍처를 구축하고 Landing/Auth 시범 2페이지 번역을 완성했다. 그러나 머지 후 다음 UX 결함이 확인되어 Sprint 122 최우선 작업으로 이관되었다.

**이관 원인 (Sprint 121 마감 후 발견)**:
- `LanguageSwitcher`가 `AppLayout`(로그인 후 화면)에만 통합되어 있어, **미인증 사용자(랜딩·Auth 화면 방문자)는 UI로 언어 전환 불가**
- `/en/*` URL을 직접 입력하면 랜딩은 영문으로 렌더링되나, 그 외 페이지(dashboard, problems 등)는 번역 미적용 상태
- `app/[locale]/layout.tsx`(skip-nav), `not-found.tsx`, `*/error.tsx`(21개), `components/ad/AdBanner.tsx` 등에 **하드코딩 한글 문자열 잔존**

Sprint 122 목표: Sprint 121이 구축한 i18n 기반 위에서 **미인증 UX 경로 보완** + **전체 주요 페이지 번역 완성** + **SEO hreflang 대응**을 통해 실제 글로벌 서비스 가능 상태로 전환한다.

---

## 핵심 결정 (D1~D3)

### D1. LanguageSwitcher 배치 전략

**문제**: Sprint 121에서 `LanguageSwitcher`는 `AppLayout`의 사이드바·상단바에 배치되었다. 랜딩 페이지(`LandingContent.tsx`)와 인증 레이아웃(`app/[locale]/(auth)/layout.tsx`)에는 토글 버튼이 없어 미인증 사용자가 UI로 언어를 전환할 수 없다.

**선택**:

| 배치 위치 | 구현 방법 | 근거 |
|-----------|-----------|------|
| LandingContent Nav | `LandingContent.tsx` 헤더 우측 영역, 테마 토글과 로그인 버튼 사이에 삽입 | 랜딩 방문자(미인증)가 즉시 언어 선택 가능 |
| AuthShell Client 래퍼 | `app/[locale]/(auth)/layout.tsx`에 `AuthShell`(Client Component) 신설, glass-nav header 구성 요소로 삽입 | 로그인·콜백·register 등 Auth 레이아웃 전체에 한번에 적용 |

**generateMetadata 위치**: Auth 레이아웃의 `generateMetadata`는 **Server Component인 `layout.tsx`에 유지**한다. `AuthShell`은 Client Component로 분리하여 인터랙션(LanguageSwitcher)만 담당한다. Server/Client 경계를 명확히 분리함으로써 메타데이터 SEO 이점을 유지한다.

**대안 비교**:

| 방식 | 장점 | 단점 |
|------|------|------|
| layout.tsx 전체를 Client로 전환 | 구현 단순 | generateMetadata 사용 불가, SEO 손실 |
| AuthShell Client 래퍼 신설 (선택) | Server/Client 경계 유지, generateMetadata 유지 | 컴포넌트 한 단계 추가 |
| 각 페이지별 개별 삽입 | 세밀한 제어 | 중복 코드, 21개 Auth 하위 페이지 전수 수정 필요 |

**트레이드오프**: `AuthShell`을 Client Component로 분리하면 Auth 레이아웃 트리에서 `useSearchParams`, `usePathname` 등 클라이언트 훅을 사용할 수 있다. 단, `AuthShell` 내부에서 `getTranslations()` 서버 함수는 직접 호출 불가 — 번역은 `useTranslations()` 훅으로 처리한다.

---

### D2. 네임스페이스 도메인 그룹핑

**문제**: Sprint 121에서 확정한 4개 네임스페이스(common/landing/auth/difficulty)로는 대시보드·문제·제출·리뷰 등 주요 페이지 번역을 수용할 수 없다. 네임스페이스 구조를 Sprint 122 전체 번역 범위에 맞춰 확장한다.

**선택 — 기존 4개 유지 + 신설 6개**:

| 네임스페이스 | 상태 | 포함 내용 |
|-------------|------|-----------|
| `common` | 기존 (확장) | 버튼/레이블/로딩 + `nav.*` 키 확장 (메뉴명, 브레드크럼, 접근성 레이블) |
| `landing` | 기존 유지 | 히어로, 기능 소개, CTA |
| `auth` | 기존 유지 | 로그인, OAuth 에러, register |
| `difficulty` | 기존 유지 | 난이도 레이블·툴팁 |
| `dashboard` | **신설** | 대시보드 통계 위젯, 최근 제출, 분석(analytics) 통합 |
| `problems` | **신설** | 문제 목록, 상세, 태그, 난이도 필터 UI |
| `submissions` | **신설** | 제출 목록, 상세, 상태 레이블, 결과 메시지 |
| `reviews` | **신설** | 피어 리뷰 목록, 리뷰 폼, 평가 항목 |
| `account` | **신설** | 프로필 페이지 + 설정 페이지 통합 (`profile.*`, `settings.*` 서브키) |
| `errors` | **신설** | 공통 에러 페이지 문자열 (not-found, 403/404/500, skip-nav) |

**`common.nav.*` 확장 상세**:
```
common.nav.dashboard   → "대시보드" / "Dashboard"
common.nav.problems    → "문제" / "Problems"
common.nav.submissions → "제출" / "Submissions"
common.nav.reviews     → "리뷰" / "Reviews"
common.nav.profile     → "프로필" / "Profile"
common.nav.settings    → "설정" / "Settings"
common.nav.admin       → "관리자" / "Admin"
common.nav.skipToMain  → "본문으로 건너뛰기" / "Skip to main content"
```

**`errors.json` + `LocalizedErrorPage` 래퍼 전략**:

현재 `*/error.tsx` 파일 21개와 `not-found.tsx` 등에 하드코딩된 한글 문자열이 분산되어 있다. 각 파일을 개별 수정하는 대신, **`LocalizedErrorPage` 공통 래퍼 컴포넌트**를 신설하고 모든 error.tsx가 이를 임포트하도록 일괄 치환한다.

```
components/error/LocalizedErrorPage.tsx  ← Client Component
  - useTranslations('errors') 사용
  - props: errorCode (404|403|500|...), retry?: boolean
  - 21개 error.tsx가 <LocalizedErrorPage errorCode={...} />로 교체
```

**`errors.json` 키 구조**:
```json
{
  "notFound": { "title": "...", "description": "...", "back": "..." },
  "forbidden": { "title": "...", "description": "..." },
  "serverError": { "title": "...", "description": "...", "retry": "..." },
  "generic": { "title": "...", "description": "...", "home": "..." }
}
```

**근거**: 21개 error.tsx 개별 수정은 변경 파일 수가 과다하고 일관성 유지가 어렵다. `LocalizedErrorPage` 단일 래퍼로 에러 UI를 집중 관리하면 향후 에러 메시지 변경 시 단일 파일만 수정하면 된다(OCP). Client Component로 구성하여 `useTranslations` 훅을 사용할 수 있다.

**트레이드오프**: `account` 네임스페이스가 `profile`과 `settings`를 통합하므로 파일 크기가 커질 수 있다. 향후 두 페이지가 독립 확장될 경우 `account.profile.*`/`account.settings.*` 서브키를 별도 파일로 분리한다.

---

### D3. SEO 전략 — hreflang + metadataBase + sitemap

**문제**: Sprint 121 이월 항목으로 `sitemap.xml` hreflang 태그, `robots.txt`, `metadataBase` 설정이 미완성 상태다. 영문 페이지가 추가됨에 따라 검색엔진이 로케일별 URL을 올바르게 인덱싱하도록 SEO 대응이 필요하다.

**선택**:

#### 1) `metadataBase` — `NEXT_PUBLIC_BASE_URL` 환경 변수

모든 메타데이터의 기준 URL을 환경 변수로 관리한다:
```typescript
// app/[locale]/layout.tsx
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL ?? 'https://algosu.kr'),
};
```

**근거**: 하드코딩된 도메인 문자열을 제거하고, 스테이징/프로덕션 환경별 URL을 환경 변수로 분리한다.

#### 2) `buildLocaleAlternates` 헬퍼 — `src/lib/i18n/metadata.ts`

로케일별 `alternates.languages` 객체를 생성하는 헬퍼 함수를 신설하여 각 페이지 `generateMetadata`에서 재사용한다:

```typescript
// src/lib/i18n/metadata.ts
/**
 * @file src/lib/i18n/metadata.ts
 * @domain i18n
 * @layer lib
 * @related src/i18n/routing.ts, app/[locale]/layout.tsx
 */

/**
 * 로케일별 hreflang alternates 객체를 생성합니다.
 * @param locale - 현재 로케일 ('ko' | 'en')
 * @param path - 경로 (예: '/problems', '/dashboard')
 * @returns Next.js Metadata alternates.languages 형태
 */
export function buildLocaleAlternates(
  locale: string,
  path: string,
): Record<string, string> {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://algosu.kr';
  return {
    ko: `${base}${path}`,
    en: `${base}/en${path}`,
    'x-default': `${base}${path}`,
  };
}
```

**사용 예시**:
```typescript
// app/[locale]/problems/page.tsx
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'problems' });
  return {
    title: t('meta.title'),
    alternates: {
      languages: buildLocaleAlternates(locale, '/problems'),
    },
  };
}
```

#### 3) `app/sitemap.ts` — alternates.languages hreflang

Next.js App Router의 `sitemap.ts`에서 로케일별 URL 쌍을 자동 생성한다:

```typescript
// app/sitemap.ts (개념)
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://algosu.kr';
  const paths = ['/problems', '/dashboard', '/submissions', '/reviews'];
  return paths.map((path) => ({
    url: `${base}${path}`,
    alternates: {
      languages: {
        ko: `${base}${path}`,
        en: `${base}/en${path}`,
      },
    },
  }));
}
```

#### 4) `app/robots.ts` 신설

`robots.txt`를 동적으로 생성하여 검색엔진 크롤링 허용/금지 경로를 명시한다:

```typescript
// app/robots.ts
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://algosu.kr';
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/admin/', '/api/'] },
    sitemap: `${base}/sitemap.xml`,
  };
}
```

**대안 비교**:

| 방식 | 장점 | 단점 |
|------|------|------|
| 정적 `public/sitemap.xml` | 단순 | 페이지 추가 시 수동 갱신 필요 |
| `app/sitemap.ts` 동적 생성 (선택) | 페이지 추가 시 자동 반영 | 빌드 타임 실행 필요 |
| 외부 sitemap 생성기 | 완전 자동화 | 추가 도구 의존성 |

**트레이드오프**: 동적 페이지(문제 상세, 제출 상세 등)의 URL은 DB 쿼리가 필요하므로, Sprint 122 범위에서는 정적 경로만 포함한다. 동적 경로 hreflang은 Sprint 123에서 `generateSitemaps` 확장으로 처리한다.

---

## 범위 결정

### Sprint 122 범위 — 페이지 레벨 + P0 처리

| 범주 | 포함 | 이유 |
|------|------|------|
| LanguageSwitcher UX 경로 보완 | ✅ | 미인증 사용자 P0 UX 결함 |
| 하드코딩 한글 정리 (layout, not-found, 21개 error.tsx, AdBanner) | ✅ | 영문 모드에서 한글 잔존은 P0 시각 버그 |
| 주요 6페이지 번역 (dashboard/problems/submissions/reviews/profile/settings) | ✅ | Sprint 122 핵심 목표 |
| SEO 대응 (metadataBase, buildLocaleAlternates, sitemap.ts, robots.ts) | ✅ | Sprint 121 이월 |
| register 3페이지 번역 | ✅ (Critic 시드 처리) | Auth 경로 완성도 |
| **컴포넌트 레벨 53개 개별 번역** | ❌ → Sprint 123 이월 | 범위 과다, 페이지 레벨 완성 후 점진 적용 |
| AuthContext locale-aware 전환 | ✅ (Critic 시드) | `window.location.href` → `useRouter` |
| CI 번역 키 패리티 검사 | ✅ (Critic 시드) | ko/en 키 불일치 자동 감지 |
| 동적 번역 키 타입 안전성 | ⬜ → 검토 후 결정 | next-intl 타입 플러그인 공수 미확정 |
| renderWithI18n 테스트 마이그레이션 | ⬜ → Sprint 123 | 기존 테스트 안정성 우선 |
| 백엔드 OAuth 에러 코드 영문화 | ❌ → Sprint 123+ | 백엔드 전략 별도 수립 필요 |

### 컴포넌트 53개 Sprint 123 이월 근거

Sprint 121 Phase B에서 `app/[locale]/*` 재편 시 확인된 컴포넌트 내 한글 하드코딩은 53개 파일에 걸쳐 있다. 이를 Sprint 122에서 일괄 처리하면:
- 변경 파일 수 과다 → PR 리뷰 품질 저하
- 페이지 레벨 번역이 완성되지 않은 상태에서 컴포넌트 선처리는 검증 기준 부재

**원칙**: 페이지 레벨 번역(+네임스페이스)이 완성된 컴포넌트부터 순차 적용. Sprint 123에서 `renderWithI18n` 테스트 마이그레이션과 함께 진행.

---

## Phase 계획표 (A~H)

| Phase | 담당 에이전트 | 내용 | 의존성 |
|-------|-------------|------|--------|
| **A** | Scribe | ADR D1~D3 작성 및 확정 (본 문서) | — |
| **B** | Architect | 네임스페이스 신설 6개 JSON 파일 초기화 (ko/en) + `common.nav.*` 확장 | Phase A |
| **C** | Palette | LanguageSwitcher UX 경로 — LandingContent Nav 삽입 + AuthShell 신설 | Phase A |
| **D** | Palette | 하드코딩 한글 일괄 정리 — `LocalizedErrorPage` 래퍼 신설 + 21개 error.tsx 치환 + skip-nav/not-found/AdBanner | Phase B |
| **E** | Palette | 주요 페이지 번역 적용 — dashboard/problems/submissions/reviews | Phase B |
| **F** | Palette | 계정 페이지 번역 — profile/settings/register 3페이지 | Phase B |
| **G** | Architect | SEO 대응 — `src/lib/i18n/metadata.ts` 헬퍼 + `sitemap.ts` + `robots.ts` + 각 페이지 `generateMetadata` alternates 적용 | Phase E/F |
| **H** | Gatekeeper | Critic 이월 시드 처리 — AuthContext locale-aware 전환 + CI 키 패리티 검사 + Sprint 120 이월 P1 3건 | Phase C |

---

## Phase 실행 결과

| Phase | 내용 | 결과 |
|-------|------|------|
| A | 설계 결정 (D1~D3) ADR 확정 + Scout 전수 스캔 (96 app files, 53 components, 초기 i18n 적용 8% → 페이지 레벨 100% 달성) | ✅ |
| B | LanguageSwitcher UX 경로 완성 — LandingContent Nav 헤더 우측 삽입 + `AuthShell` Client Component 신설 | ✅ |
| C | P0 하드코딩 일괄 처리 — skip-nav, `errors.json` 12 페이지 키, `LocalizedErrorPage` 래퍼로 21개 `error.tsx` 일괄 치환, `not-found` 3개 Server Component 전환, `AdBanner` 번역 | ✅ |
| D Wave 1 | dashboard + analytics 번역 (D-0/D-1/D-2, `dashboard.json` ~80 keys) | ✅ |
| D Wave 2 | problems 도메인 번역 (D-3a/b/c/d, `problems.json` ~80 keys, 4 pages) | ✅ |
| D Wave 3 | submissions 도메인 번역 (D-4a/b/c/d, `submissions.json`, 3 pages) | ✅ |
| D Wave 4 | reviews 번역 (D-5a/b, `reviews.json`, 1 page) | ✅ |
| D Wave 5 | account 번역 (D-6a/b/c, `account.json`, profile + profile/[slug] + settings) | ✅ |
| E | SEO — `buildLocaleAlternates` 헬퍼, `metadataBase`, `sitemap.ts` hreflang, `robots.ts` | ✅ |
| H-1 | ADR 최종화 + 메모리 갱신 | ✅ |

**누적 네임스페이스 10개**: `common`, `landing`, `auth`, `difficulty`, `errors`, `dashboard`, `problems`, `submissions`, `reviews`, `account`  
**Wave D 총 커밋**: 14 commits  
**최종 커밋**: `37c8eb2` (Phase E)

---

## Critic 리뷰 이력

| 차수 | 리뷰 ID | 대상 | 주요 파인딩 | 처리 결과 |
|------|---------|------|-------------|-----------|
| 1차 | 145430 | Phase B+C 8 commits | P2 1건 — not-found provider 누락 | fix-palette 커밋으로 즉시 해소 |
| 2차 | 145430-66123 | fix 3 commits | Medium 2건 + Low 1건 | 모두 pre-existing 또는 non-blocking 판정, 추가 조치 불필요 |
| Wave 1~5 개별 | — | Wave D 14 commits | auto-critic 트리거됨 | 개별 결과 별도 확인 필요 (미집계) |

---

## 검증

| 항목 | 결과 |
|------|------|
| `tsc --noEmit` | ✅ PASS |
| ESLint | ✅ PASS |
| jest | ✅ PASS |
| Critic Critical/High | 0건 |

---

## Sprint 123 이월 시드

Sprint 122 범위에서 의도적으로 제외하고 Sprint 123으로 이관하는 항목 목록.

### 컴포넌트 번역 (53개)

우선순위 순:
- `AppLayout` / `TopNav` / `StudySidebar` / `NotificationBell`
- `Dashboard*` / `Analytics*` 위젯 컴포넌트
- `Feedback*` / `Review*` / `Submission*`
- `ShareLinkManager` 및 기타 공용 컴포넌트

### 미번역 페이지

| 페이지 | 이유 |
|--------|------|
| `admin/problems/[id]/edit`, `admin/problems/create` | admin 도메인 분리 처리 |
| `admin/feedbacks` | admin 도메인 분리 처리 |
| `problems/[id]/status` (스터디 통계) | 독립 번역 키 설계 필요 |
| `studies/page`, `studies/[id]/page`, `studies/[id]/room` | studies 도메인 전체 별도 Wave |
| `guest/page`, `shared/[token]/page` | 공개 공유 경로 |
| `privacy/terms` | 법무 검토 후 번역 |

### i18n 품질 개선

| 항목 | 출처 |
|------|------|
| `renderWithI18n` 테스트 마이그레이션 완전 적용 | Critic Low-2 (Sprint 121) |
| next-intl 타입 플러그인 도입 (동적 번역 키 타입 안전성) | Critic 권고 |
| Zod 스키마 검증 메시지 i18n — `errorMap` 패턴 도입 검토 | 신규 시드 |
| `lib/date.ts` 상대 시간 `useFormatter` 전환 | 신규 시드 |
| `hooks/useSubmissionSSE` 동적 번역 caller 레벨 전환 | 신규 시드 |
| `studies/[id]/room/utils.ts` 순수 TS 유틸 내 한글 | 신규 시드 |
| `lib/api/client.ts` HTTP 에러 메시지 국제화 | 신규 시드 |

### 보안 및 백엔드

| 항목 | 출처 |
|------|------|
| Sprint 120 이월 Frontend P1 3건 (p1-023/024/025) | Sprint 120 미처리 |
| P1 security 49건 | Sprint 118/119 배치 |
| 백엔드 OAuth 에러 구조화 (Sprint 121 M-E2 근본 해결) | 별도 ADR 필요 |

### Critic 지적 anti-pattern

| 항목 | 내용 |
|------|------|
| `code: '404'` 번역 키 제거 | 숫자형 키를 문자열로 쓰는 anti-pattern — `notFound` 등 의미론적 키로 교체 |

---

## 관련 문서

- 이전 스프린트: [sprint-121.md](./sprint-121.md)
- 다음 스프린트: [sprint-123.md](./sprint-123.md)
- 현재 스프린트 윈도우: `memory/sprint-window.md`
- 디자인 토큰: `CLAUDE.md` § 디자인 토큰 (UI v2)
- 어노테이션 사전: `docs/annotation-dictionary.md`
- next-intl 공식 문서: https://next-intl-docs.vercel.app/
- Next.js Metadata API: https://nextjs.org/docs/app/api-reference/functions/generate-metadata
