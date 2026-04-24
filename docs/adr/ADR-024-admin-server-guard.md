# ADR-024: Admin 서버사이드 권한 가드 — CSR → Server Component 전환

- **상태**: 수락됨 (Accepted)
- **날짜**: 2026-04-24
- **스프린트**: Sprint 124 Phase C
- **의사결정자**: Oracle (심판관)
- **구현 담당**: Palette
- **자문**: Architect (task-20260424-103725-44440)

---

## 컨텍스트

### 문제: Sprint 118 파인딩 p1-024

Sprint 118 Critic 전수 감사(56,812 LOC)에서 `admin/layout.tsx`가 `'use client'` 기반
`useAuth` + `useRouter` + `useEffect` 조합으로 권한을 CSR 단계에서 검증하고 있음이 발견되었다.

**CSR-only 가드의 한계:**

1. **번들 노출**: Next.js App Router는 Server Component 트리가 렌더링될 때 HTML payload와 함께
   React 서버 컴포넌트 데이터를 스트리밍한다. `'use client'` 레이아웃의 경우 자식 컴포넌트
   JS 청크가 브라우저로 전송된 뒤 클라이언트 권한 검증이 실행된다 — 즉 비admin 사용자에게도
   admin 번들이 전송된다.
2. **UX 플래시**: 브라우저에서 auth 상태를 확인하기 전 admin UI가 일시적으로 렌더링될 수 있다.
3. **우회 가능성**: JS 실행을 차단하거나 클라이언트 상태를 조작하면 CSR 가드를 우회할 수 있다.

### 코드베이스 실제 상태 (Architect 자문 발견)

| 항목 | 과제 설명 (초기 가정) | 실제 코드 |
|------|----------------------|----------|
| JWT 저장 위치 | localStorage | **httpOnly Cookie** (`token` 쿠키) — Sprint 120 전환 |
| middleware 쿠키 접근 | 불가 | **이미 가능** (`request.cookies.has('token')`) |
| JWT payload | 미언급 | `{ sub, email, oauth_provider, isDemo? }` — **isAdmin 미포함** |
| admin 판별 | 미언급 | Gateway 런타임에 `ADMIN_EMAILS` env 비교 (DB 조회 X) |
| JWT_SECRET (frontend) | 미언급 | **frontend Deployment 미주입** (Gateway Sealed Secret에만 존재) |
| ADMIN_EMAILS (frontend) | 미언급 | **frontend Deployment 미주입** |

---

## 의사결정 — Option B: Server Component 전환

### 비교 검토된 4가지 옵션

| 옵션 | 설명 | 판정 |
|------|------|------|
| **A — Middleware JWT 디코딩** | `jose` 패키지 + JWT_SECRET frontend 주입 + middleware.ts 수정 | **기각** |
| **B — Server Component 전환** | `admin/layout.tsx` async Server Component, Gateway `/auth/profile` 내부 호출 | **✅ 선택** |
| **C — CSR 유지** | 현행 `useAuth` + `useEffect` 가드 유지 | **기각** |
| **D — 쿠키 mirror** | 쿠키 기반 서버 판별 variant | **불필요** (Option B가 이미 쿠키 기반) |

#### Option A (Middleware JWT) 기각 근거

- **JWT_SECRET frontend 노출 필요**: Gateway Sealed Secret에만 존재하는 대칭키를 frontend
  Deployment에 추가해야 함 — Sealed Secret 신규 생성 + infra 변경 필요
- **ADMIN_EMAILS frontend 주입 필요**: admin 정책 변경 시 frontend + gateway 양쪽 env 동기화 의무
- **jose 의존성 추가**: frontend `package.json` 패키지 추가
- **middleware.ts 수정**: Sprint 121~123 i18n 체인(intlMiddleware, PUBLIC_PATHS) 재검증 필요
- **JWT payload 의존**: isAdmin 클레임 없어 email 비교 로직이 middleware에 들어가야 함

#### Option B (Server Component) 선택 근거

| 판단 기준 | Option B (선택) | Option A (기각) |
|-----------|-----------------|-----------------|
| JWT_SECRET 노출 | frontend 미주입 유지 ✅ | frontend Deployment 추가 필요 ❌ |
| Sealed Secret 변경 | 불필요 ✅ | 신규 생성 필요 ❌ |
| 구현 범위 | 3파일, 비민감 env 1개 | jose + Sealed Secret + middleware 수정 |
| Next.js 패턴 | App Router 공식 Server Component 패턴 | Edge Middleware 공식 패턴 |
| 번들 차단 시점 | Server Component 렌더 (SSR) | Edge (SSR 이전, 최조기) |
| Latency overhead | gateway 내부 HTTP ~5–20ms (admin only) | Edge stateless, 왕복 없음 |
| Sprint 121~123 호환 | middleware.ts 수정 없음 — **100% 호환** ✅ | middleware 체인 순서 재검증 필요 |
| admin 정책 변경 | gateway env만 업데이트 | frontend + gateway 양쪽 동기화 필요 |
| JWT 구조 변경 | 영향 없음 | middleware 업데이트 필요 |

#### Option C (CSR 유지) 기각 근거

p1-024 번들 노출 문제를 해소하지 못함. admin JS 청크가 비admin에게 계속 전송되어
보안 원칙(최소 권한, 정보 노출 최소화) 위반이 지속된다.

### 선택된 설계 흐름

```
[비인증]         → middleware 기존 가드 → /login redirect (기존 동작 유지)
[인증, 비admin]  → middleware 통과 → Server Component → redirect('/dashboard')
[인증, admin]    → middleware 통과 → Server Component → AppLayout + children 렌더
```

Server Component가 redirect 실행 시 children(admin page JS 청크)이 클라이언트로 전송되지
않음 → **admin 번들 노출 완전 차단 (p1-024 해소)**.

---

## 구현

### 변경 파일 (3파일, Sprint 124 Phase C 커밋)

| 파일 | 작업 | 커밋 |
|------|------|------|
| `frontend/src/lib/server/admin-guard.ts` | 신규 — requireAdmin() 서버사이드 권한 검증 유틸 | `3b955d9` |
| `frontend/src/app/[locale]/admin/layout.tsx` | 수정 — `'use client'` → async Server Component 전환 | `1ef4ced` |
| `infra/k3s/frontend.yaml` | 수정 — `GATEWAY_INTERNAL_URL` env 추가 | `6122469` |

### admin-guard.ts 핵심 설계

```typescript
/**
 * @file Admin 서버사이드 권한 검증 유틸
 * @domain identity
 * @layer lib/server
 * @related admin/layout.tsx, gateway /auth/profile
 */
export async function requireAdmin(locale: string): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get('token');

  if (!token) redirect(localePath(locale, '/login'));

  let authenticated = false;
  let profile: ProfileResponse | null = null;

  try {
    const res = await fetch(`${GATEWAY_URL}/auth/profile`, {
      headers: { cookie: `token=${token.value}` },
      cache: 'no-store',
    });
    authenticated = res.ok;
    if (res.ok) profile = await res.json();
  } catch {
    // fail-secure: gateway 장애 시 접근 차단
  }

  if (!authenticated) redirect(localePath(locale, '/login'));
  if (!profile?.isAdmin) redirect(localePath(locale, '/dashboard'));
}
```

설계 포인트:
- `redirect()`는 Next.js 내부적으로 throw하므로 try/catch 밖에서만 호출 (NEXT_REDIRECT 충돌 방지)
- **fail-secure 원칙**: gateway 장애 시 admin 접근 허용 대신 dashboard 리다이렉트
- **locale-aware redirect**: as-needed prefix 정책 준수 (ko → prefix 없음, en → `/en/...`)

### admin/layout.tsx 전환

```typescript
// Before: 'use client' + useAuth + useRouter + useEffect
// After: async Server Component (no 'use client')
export default async function AdminLayout({ children, params }) {
  const { locale } = await params;  // Next.js 15 Promise params
  await requireAdmin(locale);
  return <AppLayout>{children}</AppLayout>;
}
```

### GATEWAY_INTERNAL_URL

```yaml
# infra/k3s/frontend.yaml
- name: GATEWAY_INTERNAL_URL
  value: "http://gateway.algosu.svc.cluster.local:3000"
```

- **비민감 환경변수** — k3s 클러스터 내부 URL, Sealed Secret 불필요
- k3s 내부 서비스 DNS 표준 형식 (`{service}.{namespace}.svc.cluster.local`)

---

## 결과 (Consequences)

### 긍정적 효과

1. **admin 번들 노출 차단** (p1-024 완전 해소): Server Component redirect → children 미렌더
   → admin 페이지 JS 청크 클라이언트 전송 없음
2. **JWT_SECRET frontend 비노출 유지**: Gateway Sealed Secret 구조 변경 없음, 최소 권한 원칙 준수
3. **middleware.ts 무수정**: Sprint 121~123 i18n 호환 100% — intlMiddleware 체인, PUBLIC_PATHS,
   locale 감지/rewrite 모두 그대로 유지
4. **admin 정책 단일 소스**: `ADMIN_EMAILS`는 gateway env만 관리 — frontend 동기화 의무 없음
5. **Next.js 15 호환**: `params: Promise<{ locale: string }>` 비동기 패턴 준수
6. **Phase B 연계**: admin/layout.tsx Server Component이므로 Sprint 124 Phase B admin 번역 시
   `getTranslations('admin')` 직접 호출 가능

### 트레이드오프

1. **레이턴시 추가**: admin 요청마다 Gateway `/auth/profile` 내부 HTTP 호출 (~5–20ms)
   — admin 전용 경로이므로 서비스 전반 성능 영향 없음
2. **Gateway 의존성**: Gateway 장애 시 admin 접근 불가 (fail-secure 설계, 의도된 동작)
3. **defaultLocale 하드코딩**: `localePath(locale, ...)` 내 `locale === 'ko'` 비교 — Sprint 125+
   `i18n.config.ts` `defaultLocale` 참조로 개선 필요

### 보안 분석

| 위협 | 영향 | 평가 |
|------|------|------|
| XSS | httpOnly cookie → JS 접근 불가 | 안전 |
| CSRF | Server Component fetch는 서버→서버 (브라우저 발신 X) | 해당 없음 |
| Token 탈취 후 admin 접근 | Gateway verifyAdmin 이중 검증 유지 | 보호됨 |
| Gateway 장애 | admin layout fetch 실패 → fail-secure redirect | UX 영향 (admin만) |
| JWT 만료 토큰 | Gateway 401 → /login redirect | 정상 처리 |
| GATEWAY_INTERNAL_URL 오설정 | Internal fetch 실패 → redirect | 인프라 검증 필요 |

---

## 후속 작업

- **Sprint 125+**: `admin-guard.ts`의 `defaultLocale` 하드코딩(`locale === 'ko'`) 제거
  → `i18n.config.ts` `defaultLocale` 동적 참조
- **Sprint 125+**: `requireAdmin()` 단위 테스트 추가 (`fetch` mock 기반)
- **Phase B 인계**: admin 번역 추가 시 `useTranslations` 대신 `getTranslations('admin')` 사용
  (Server Component에서 직접 호출)

---

## 참고

- Architect 자문: `~/.claude/oracle/inbox/architect-task-20260424-103725-44440.md`
- Palette 구현: `~/.claude/oracle/inbox/palette-task-20260424-105135-45018.md`
- 관련 커밋: `3b955d9` (admin-guard.ts), `1ef4ced` (admin/layout.tsx), `6122469` (infra env)
- 관련 ADR: ADR-025 (Gateway OAuth 에러 코드 정규화)
- 파인딩 원본: Sprint 118 Critic 전수 감사 — p1-024
