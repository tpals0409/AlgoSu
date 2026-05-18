---
sprint: 65
title: "Login/Logout/Session Feature Review and Improvements"
date: "2026-04-09"
status: completed
agents: [Oracle, Scout, Gatekeeper]
related_adrs: []
---

# Sprint 65: Login/Logout/Session Feature Review and Improvements

## Decisions
### D1: Add NODE_ENV guard to DEV_MOCK bypass
- **Context**: When `NEXT_PUBLIC_DEV_MOCK=true` is set, Edge Middleware bypasses all authentication. Since `NEXT_PUBLIC_*` variables are determined at build time, accidentally activating this in a production build would neutralize protection for all routes.
- **Choice**: Add `process.env.NODE_ENV !== 'production'` condition so DEV_MOCK is ignored in production builds
- **Alternatives**: Change `DEV_MOCK` env var to server-only without `NEXT_PUBLIC_` prefix — possible since Edge Middleware is server-side, but rejected to maintain consistency with existing DEV_MOCK branches in AuthContext
- **Code Paths**: `frontend/src/middleware.ts`

### D2: Unify 401 session expiry redirect to `?expired=true`
- **Context**: API 401 response redirects with `?error=session_expired` → generic error message. Heartbeat timeout uses `?expired=true` → session expiry modal. The two flows were inconsistent.
- **Choice**: Change `fetchApi`'s 401 redirect to `?expired=true` so all session expiry shows the same modal UI
- **Alternatives**: Add a separate Toast component — over-engineering; a session expiry modal already exists on the login page
- **Code Paths**: `frontend/src/lib/api.ts`

### D3: Bulk removal of localStorage token functions (httpOnly Cookie SSoT)
- **Context**: Even after httpOnly Cookie migration, 11 localStorage token functions (`setToken`, `getToken`, `isTokenExpired`, etc.) remained. Unused in production code (only referenced in tests).
- **Choice**: Remove 11 unused functions; keep `removeToken`/`removeRefreshToken` for legacy cleanup
- **Alternatives**: Remove all including removeToken — rejected because legacy tokens may remain in users' localStorage and cleanup is needed on logout
- **Code Paths**: `frontend/src/lib/auth.ts`, `frontend/src/lib/__tests__/auth.test.ts`, `frontend/src/lib/__tests__/auth-ssr.test.ts`

## Patterns
### P1: Protected route isReady guard pattern
- **Where**: `frontend/src/app/problems/create/page.tsx`, `frontend/src/app/dashboard/page.tsx`, `frontend/src/app/analytics/page.tsx`
- **When to Reuse**: When using `useRequireAuth()` on a page and need to prevent blank screen while auth is loading. Apply `const { isReady } = useRequireAuth();` + `if (!isReady) return <LoadingSpinner />;` pattern.

## Gotchas
### G1: NEXT_PUBLIC_ env vars are bundled even in production builds
- **Symptom**: DEV_MOCK flag included in build, can be activated in production without NODE_ENV check
- **Root Cause**: Next.js `NEXT_PUBLIC_*` variables are inlined at build time, not runtime env vars
- **Fix**: For security-related bypasses, always require `NODE_ENV` double-check

## Metrics
- Commits: 1, Files changed: 7 (+42/-440)
