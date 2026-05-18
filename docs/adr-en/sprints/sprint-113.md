---
sprint: 113
title: "SWR Data Fetching Standardization"
period: "2026-04-22"
status: complete
start_commit: 75cb80f
end_commit: 2c7fd08
---

# Sprint 113 — SWR Data Fetching Standardization

## Background

AlgoSu's frontend was manually managing all data fetching with `useState + useEffect + useCallback` boilerplate. The same 3-state pattern (data/isLoading/error) was repeated across all pages — problems, submissions, settings, dashboard — with high maintenance cost and lacking basic features like caching, revalidation, and duplicate request prevention.

Selected as the top priority among MEMORY.md "ongoing follow-up" section's 3 items (SWR introduction, Redis statistics cache, problem.tags JSON migration) and organized as a single sprint.

## Goals

| Item | Content | Status |
|------|---------|--------|
| Phase A | SWR infrastructure setup (fetcher, Provider, 4 hooks, test-utils) | ✅ Complete |
| Phase B | 3 page migrations (problems/submissions/settings) | ✅ Complete |
| Phase C | NotificationBell polling → refreshInterval migration | ✅ Complete |
| Phase D | New hook tests + existing page test updates | ✅ Complete |

---

## Decisions

### D1. SWR Selection (vs TanStack Query / React Query)

**Background**: Frontend data fetching library selection. Comparison of two candidates needed.

**Options**:
- (A) TanStack Query (React Query) — advanced caching/sync, bundle ~40KB, rich DevTools
- (B) SWR — lightweight ~8KB, simple API, httpOnly Cookie friendly ← **selected**

**Selected**: (B) — Precisely matches AlgoSu's tech stack:
- httpOnly Cookie auth: automatic `credentials: 'include'` handling, no manual Authorization header injection
- Minimal change integration with existing fetch wrapper (`fetchApi`) — use API path as key directly
- No conflicts with SSE + polling real-time features
- Bundle size advantage (~8KB)
- Current data fetching complexity (simple CRUD) doesn't require React Query's advanced features

**Result**: `swr@2.x` introduced. Common fetcher + cacheKeys factory in `lib/swr.ts`, global config via `SWRProvider`.

---

### D2. Cache Key = API path (No Separate Key Scheme)

**Background**: SWR indexes cache by key — key naming convention needed.

**Options**:
- (A) Domain-based tuple keys (e.g., `['problems', 'all', studyId]`)
- (B) API path directly (e.g., `/api/problems/all`) ← **selected**

**Selected**: (B) — `fetchApi(path)` signature is already path-based, so key = path makes fetcher (`(key) => fetchApi(key)`) naturally valid. 1:1 mapping with network tab for cache key debugging. Type safety ensured only via `cacheKeys` factory.

**Result**: `cacheKeys.problems.all()` → returns `/api/problems/all`. Query parameters serialized to path via `URLSearchParams`.

---

### D3. `invalidateAllCache()` Call on Study Switch

**Background**: `fetchApi` internally reads module-level `_currentStudyId` to inject `X-Study-ID` header. Even with the same path, server responses differ when study changes — if studyId is absent from SWR cache key, previous study data appears stale.

**Options**:
- (A) Include studyId in all study-scoped keys (e.g., `['study-1', '/api/problems/all']`)
- (B) Invalidate entire SWR cache on study switch event ← **selected**

**Selected**: (B) — High key management cost for (A) due to many scoped data items. Study switching is an infrequent event — full revalidation overhead is acceptable. `invalidateAllCache()` called in `StudyContext.setCurrentStudy`.

**Result**: `invalidateAllCache()` exported from `lib/swr.ts`. Called in `StudyContext.tsx` on studyId change → all SWR caches revalidated.

---

### D4. SWR Exclusions: SSE hooks / useAutoSave / Search hooks

**Background**: 7 custom hooks in frontend. Need to decide scope for SWR migration.

**Selected**: 4 to migrate + 3 to exclude:
- **Migrate**: useProblems, useStudyStats, useSubmissions, useProfileSettings (simple GET read cache)
- **Exclude**:
  - `useNotificationSSE`, `useSubmissionSSE` — real-time streams (not SWR targets, retain ReadableStream)
  - `useAutoSave` — localStorage + 30s server sync (not suited for SWR read-cache pattern)
  - `useBojSearch`, `useProgrammersSearch` — user action-driven form state integration (SWR migration would increase complexity)

**Result**: SWR introduction scope clarified to "declarative GET + automatic caching" purpose. Real-time/form retains existing patterns.

---

## Outputs

### New Files (7)

| File | Role |
|------|------|
| `frontend/src/lib/swr.ts` | swrFetcher + cacheKeys + invalidateAllCache |
| `frontend/src/components/providers/SWRProvider.tsx` | Global SWRConfig (401/403/404 retry blocking, dedupingInterval 2s) |
| `frontend/src/lib/test-utils.tsx` | SWRTestWrapper (test cache isolation) |
| `frontend/src/hooks/use-problems.ts` | Problem list SWR hook |
| `frontend/src/hooks/use-study-stats.ts` | Study statistics SWR hook |
| `frontend/src/hooks/use-submissions.ts` | Submission list pagination SWR hook |
| `frontend/src/hooks/use-profile-settings.ts` | Profile settings SWR hook |

### Modified Files (7)

| File | Change | Description |
|------|--------|-------------|
| `frontend/src/lib/api.ts` | +1 | `fetchApi` export added (SWR fetcher reuse) |
| `frontend/src/app/layout.tsx` | +3 | SWRProvider inserted (StudyProvider > SWRProvider) |
| `frontend/src/contexts/StudyContext.tsx` | +2 | invalidateAllCache call on setCurrentStudy |
| `frontend/src/app/problems/page.tsx` | +12/-22 | useState+useEffect → useProblems+useStudyStats migration |
| `frontend/src/app/submissions/page.tsx` | +31/-35 | useSubmissions+useProblems migration (Herald) |
| `frontend/src/app/settings/page.tsx` | +26/-19 | useProfileSettings migration + useEffect form initialization |
| `frontend/src/components/layout/NotificationBell.tsx` | +52/-70 | 60s setInterval removed → useSWR refreshInterval (Herald) |

### New Test Files (4)

| File | Test count |
|------|-----------|
| `use-problems.test.tsx` | 5 |
| `use-study-stats.test.tsx` | 5 |
| `use-submissions.test.tsx` | 6 |
| `use-profile-settings.test.tsx` | 5 |

### Modified Test Files (2)

| File | Change | Description |
|------|--------|-------------|
| `NotificationBell.test.tsx` | +90/-30 | notificationApi mocking → swrFetcher mocking (26 tests reactivated) |
| `settings/__tests__/page.test.tsx` | +37/-20 | settingsApi mocking → swrFetcher mocking |

### Commits (6, all atomic)

```
2c7fd08 feat(frontend): SWR infrastructure + problems page
6f2e591 test(frontend): NotificationBell/settings test updates
192170a test(frontend): 4 SWR hook tests added (21 tests)
8c5614d refactor(frontend): NotificationBell SWR refreshInterval
1e57f71 refactor(frontend): settings page SWR
4d7425d refactor(frontend): submissions page SWR
```

## Verification

- `npx tsc --noEmit`: 0 errors
- `npm test`: **1259/1259 passed** (120 suites, 21 new included)
- Coverage: All 4 new hooks cover conditional fetch/success/failure/mutate cases

## Lessons Learned

### Herald tmux dispatch characteristics

**Observation**: Success rate varies significantly by task scope for the same agent (Herald).
- ✅ Success pattern: Single file target + explicit instruction (submissions, NotificationBell, 4 hook tests)
- ❌ Failure pattern: Multiple files + broad scope (initial "3 pages + tests" task → 945s timeout, 17s cumulative CPU)
- ⚠️ Partial success: Test modification task completed work but timed out before commit/inbox writing

**Lesson**: Herald as a `claude -p` independent process must be narrowed to **single file unit dispatch** for stability. Multi-file batch work should be performed directly by Oracle or split into sequential dispatch.

### SWR Integration Minimal Invasion Principle

Strategy of delegating to SWR fetcher using the existing `fetchApi` wrapper as-is was effective.
- 0 API namespace changes (16 maintained — compatibility preserved)
- Cache key = API path → 1:1 mapping with network tab debugging
- `cache: 'no-store'` Next.js HTTP setting and SWR in-memory cache have no conflict

### Incremental Migration is the Right Choice

Only 3 representative pages + 1 component migrated instead of full migration. dashboard/admin-feedbacks have high complexity — split to future sprints. This split made single-sprint completion possible.

### React Anti-pattern Detection — Herald Output Review Required

Oracle corrected a render-phase state update pattern that Herald used in settings/page.tsx to useEffect. Herald's outputs must not be unconditionally accepted — review before commit.

## Carried Over

None.

## Ongoing Follow-up (Always in MEMORY.md)

- Redis statistics cache (dashboard statistics DB direct query → cache migration)
- problem.tags JSON column migration + seed data enrichment
- dashboard/page.tsx SWR migration (4 parallel fetches → individual SWR hooks)
- admin/feedbacks/page.tsx SWR migration (useSWRInfinite consideration)
- useSWRMutation-based mutation pattern (alternative to current direct call + mutate approach)
