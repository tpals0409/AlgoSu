# ADR-024: Admin Server-side Authorization Guard — CSR → Server Component Migration

- **Status**: Accepted
- **Date**: 2026-04-24
- **Sprint**: Sprint 124 Phase C
- **Decision maker**: Oracle
- **Implementer**: Palette
- **Consulted**: Architect (task-20260424-103725-44440)

---

## Context

### Problem: Sprint 118 Finding p1-024

In the Sprint 118 Critic comprehensive audit (56,812 LOC), it was found that `admin/layout.tsx` was verifying authorization at the CSR stage using a `'use client'`-based `useAuth` + `useRouter` + `useEffect` combination.

**Limitations of CSR-only guards:**

1. **Bundle exposure**: Next.js App Router streams React Server Component data along with the HTML payload when the Server Component tree renders. For `'use client'` layouts, child component JS chunks are sent to the browser before client-side authorization runs — meaning the admin bundle is sent even to non-admin users.
2. **UX flash**: The admin UI may briefly render before the browser checks auth state.
3. **Bypass possibility**: CSR guards can be bypassed by blocking JS execution or manipulating client state.

### Actual Codebase State (Discovered via Architect Consultation)

| Item | Task description (initial assumption) | Actual code |
|------|----------------------|----------|
| JWT storage location | localStorage | **httpOnly Cookie** (`token` cookie) — migrated in Sprint 120 |
| Middleware cookie access | Not possible | **Already possible** (`request.cookies.has('token')`) |
| JWT payload | Not mentioned | `{ sub, email, oauth_provider, isDemo? }` — **isAdmin not included** |
| Admin determination | Not mentioned | Gateway runtime comparison against `ADMIN_EMAILS` env (no DB query) |
| JWT_SECRET (frontend) | Not mentioned | **Not injected in frontend Deployment** (exists only in Gateway Sealed Secret) |
| ADMIN_EMAILS (frontend) | Not mentioned | **Not injected in frontend Deployment** |

---

## Decision — Option B: Server Component Migration

### 4 Options Evaluated

| Option | Description | Verdict |
|------|------|------|
| **A — Middleware JWT decode** | `jose` package + JWT_SECRET frontend injection + middleware.ts modification | **Rejected** |
| **B — Server Component migration** | `admin/layout.tsx` async Server Component, Gateway `/auth/profile` internal call | **✅ Selected** |
| **C — Retain CSR** | Keep current `useAuth` + `useEffect` guard | **Rejected** |
| **D — Cookie mirror** | Cookie-based server-side determination variant | **Unnecessary** (Option B is already cookie-based) |

#### Option A (Middleware JWT) rejection rationale

- **JWT_SECRET frontend exposure required**: The symmetric key, which only exists in Gateway Sealed Secret, must be added to the frontend Deployment — requires creating a new Sealed Secret + infra changes
- **ADMIN_EMAILS frontend injection required**: Admin policy changes require synchronizing env on both frontend + gateway
- **jose dependency added**: Package added to frontend `package.json`
- **middleware.ts modification**: Requires re-verification of Sprint 121~123 i18n chain (intlMiddleware, PUBLIC_PATHS)
- **JWT payload dependency**: No isAdmin claim, so email comparison logic must go into middleware

#### Option B (Server Component) selection rationale

| Decision criterion | Option B (selected) | Option A (rejected) |
|-----------|-----------------|-----------------|
| JWT_SECRET exposure | Keep frontend non-injected ✅ | Must add to frontend Deployment ❌ |
| Sealed Secret change | Not required ✅ | New creation required ❌ |
| Implementation scope | 3 files, 1 non-sensitive env | jose + Sealed Secret + middleware modification |
| Next.js pattern | App Router official Server Component pattern | Edge Middleware official pattern |
| Bundle blocking point | Server Component render (SSR) | Edge (before SSR, earliest) |
| Latency overhead | gateway internal HTTP ~5–20ms (admin only) | Edge stateless, no round trip |
| Sprint 121~123 compatibility | No middleware.ts changes — **100% compatible** ✅ | Middleware chain order re-verification needed |
| Admin policy change | Update gateway env only | Must synchronize frontend + gateway both |
| JWT structure change | No impact | Middleware update required |

#### Option C (keep CSR) rejection rationale

Does not resolve the p1-024 bundle exposure issue. Admin JS chunks continue to be sent to non-admin users,
perpetuating security principle violations (least privilege, information exposure minimization).

### Selected Design Flow

```
[Unauthenticated]   → existing middleware guard → /login redirect (existing behavior preserved)
[Authenticated, non-admin] → middleware pass → Server Component → redirect('/dashboard')
[Authenticated, admin]     → middleware pass → Server Component → AppLayout + children rendered
```

When Server Component executes redirect, children (admin page JS chunks) are not sent to the client
→ **Complete blocking of admin bundle exposure (p1-024 resolved)**.

---

## Implementation

### Changed Files (3 files, Sprint 124 Phase C commit)

| File | Operation | Commit |
|------|------|------|
| `frontend/src/lib/server/admin-guard.ts` | New — requireAdmin() server-side authorization validation utility | `3b955d9` |
| `frontend/src/app/[locale]/admin/layout.tsx` | Modified — `'use client'` → async Server Component migration | `1ef4ced` |
| `infra/k3s/frontend.yaml` | Modified — add `GATEWAY_INTERNAL_URL` env | `6122469` |

### admin-guard.ts Core Design

```typescript
/**
 * @file Admin server-side authorization validation utility
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
    // fail-secure: block access on gateway failure
  }

  if (!authenticated) redirect(localePath(locale, '/login'));
  if (!profile?.isAdmin) redirect(localePath(locale, '/dashboard'));
}
```

Design points:
- `redirect()` throws internally in Next.js, so it must only be called outside try/catch (prevents NEXT_REDIRECT conflicts)
- **Fail-secure principle**: On gateway failure, redirect to dashboard instead of allowing admin access
- **Locale-aware redirect**: Complies with as-needed prefix policy (ko → no prefix, en → `/en/...`)

### admin/layout.tsx Migration

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

- **Non-sensitive environment variable** — k3s cluster-internal URL, Sealed Secret not required
- Standard k3s internal service DNS format (`{service}.{namespace}.svc.cluster.local`)

---

## Consequences

### Positive Effects

1. **Admin bundle exposure blocked** (p1-024 fully resolved): Server Component redirect → children not rendered
   → admin page JS chunks not sent to client
2. **JWT_SECRET kept off frontend**: No changes to Gateway Sealed Secret structure, least privilege principle maintained
3. **middleware.ts untouched**: Sprint 121~123 i18n 100% compatible — intlMiddleware chain, PUBLIC_PATHS,
   locale detection/rewrite all unchanged
4. **Single source for admin policy**: `ADMIN_EMAILS` managed only in gateway env — no frontend sync obligation
5. **Next.js 15 compatible**: Follows `params: Promise<{ locale: string }>` async pattern
6. **Phase B linkage**: Since admin/layout.tsx is a Server Component, `getTranslations('admin')` can be called
   directly when adding admin translations in Sprint 124 Phase B

### Trade-offs

1. **Added latency**: Gateway `/auth/profile` internal HTTP call (~5–20ms) per admin request
   — admin-only path, no impact on overall service performance
2. **Gateway dependency**: Admin access unavailable if Gateway is down (fail-secure design, intentional behavior)
3. **defaultLocale hardcoded**: `locale === 'ko'` comparison inside `localePath(locale, ...)` — needs improvement
   to reference `i18n.config.ts` `defaultLocale` in Sprint 125+

### Security Analysis

| Threat | Impact | Assessment |
|------|------|------|
| XSS | httpOnly cookie → JS inaccessible | Safe |
| CSRF | Server Component fetch is server→server (not browser-initiated) | Not applicable |
| Token theft → admin access | Gateway verifyAdmin double verification maintained | Protected |
| Gateway failure | admin layout fetch fails → fail-secure redirect | UX impact (admin only) |
| Expired JWT token | Gateway 401 → /login redirect | Handled correctly |
| GATEWAY_INTERNAL_URL misconfiguration | Internal fetch fails → redirect | Infra verification required |

---

## Follow-up Tasks

- **Sprint 125+**: Remove `defaultLocale` hardcoding (`locale === 'ko'`) in `admin-guard.ts`
  → dynamic reference to `i18n.config.ts` `defaultLocale`
- **Sprint 125+**: Add unit tests for `requireAdmin()` (using `fetch` mocks)
- **Phase B handoff**: When adding admin translations, use `getTranslations('admin')` instead of `useTranslations`
  (direct call from Server Component)

---

## References

- Architect consultation: `~/.claude/oracle/inbox/architect-task-20260424-103725-44440.md`
- Palette implementation: `~/.claude/oracle/inbox/palette-task-20260424-105135-45018.md`
- Related commits: `3b955d9` (admin-guard.ts), `1ef4ced` (admin/layout.tsx), `6122469` (infra env)
- Related ADR: ADR-025 (Gateway OAuth Error Code Normalization)
- Original finding: Sprint 118 Critic comprehensive audit — p1-024
