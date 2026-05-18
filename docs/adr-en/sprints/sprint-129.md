---
sprint: 129
title: "Post-login Language Toggle Regression Fix — H3 usePathname locale-aware + H1 Suspense Boundary"
period: "2026-04-25"
status: completed
start_commit: 355da52
end_commit: "(Updated after PR squash — Wave A last commit: 5f42157)"
prs:
  - "(Integrated PR planned) Sprint 129 Wave A: AppLayout usePathname locale-aware + LanguageSwitcher Suspense boundary"
---

# Sprint 129 — Post-login Language Toggle Regression Fix

## Background

User report: "Language toggle button does not work after login." Toggle works normally in non-logged-in state
(landing/other public pages), but symptom only reproduces on protected routes like dashboard/admin after login.
Suspected regression since Sprint 126 Wave P0 (`lib/api/client.ts` locale-aware redirect).

Delegated **Phase 1 static analysis** to Herald → Established 5 hypotheses (H1~H5), then verified against entire codebase.
H3 (Secondary Bug) + H1 (partial confirmed) that can be confirmed by static analysis → immediately fixed in Wave A.
H4 (Primary Suspect) requiring runtime verification → deferred to Wave B.

### Processing Status

| # | Item | Wave | Status |
|---|------|------|--------|
| H3 | `AppLayout.tsx` usePathname import → locale-aware replacement | A-1 | ✅ |
| H1 | LanguageSwitcher 4 locations Suspense boundary added | A-2 | ✅ |
| Regression tests 8 new | isActive locale-aware 4 + Suspense + EN locale 4 | A-3 | ✅ |
| H4 | `client.ts:113-117` window.location.href hard override | B | ⏸ Deferred |

---

## Phase 1 — Hypothesis Verification Matrix (Herald Static Analysis)

Herald inbox: `~/.claude/oracle/inbox/herald-task-20260425-122835-21417.md`

| Hypothesis | Content | Verdict |
|-----------|---------|---------|
| **H1** | useSearchParams Suspense absence → SSR error | Possible (partial) — admin layout Server Component boundary |
| **H2** | LanguageSwitcher multiple instance race | Ruled out — simultaneous 1 instance via `hasStudy` branching, TopNav L335 is dead code |
| **H3** | Dynamic route usePathname — locale prefix issue | **Confirmed (Secondary Bug)** — `AppLayout.tsx:17` `next/navigation` import (locale prefix not removed) |
| **H4** | SWR 401 redirect conflict | **Primary Suspect** — `client.ts:113-117` `window.location.href` hard override, static analysis limit prevents confirmation |
| **H5** | next-intl version bug | Ruled out — static analysis limit (version compatibility requires runtime verification) |

**Decision principle**: Static analysis confirmed → Wave A immediate fix, runtime verification needed → Wave B defer.

---

## Wave A — H3 + H1 Immediate Fix

Assigned: Herald (implementation), Critic (cross-review)

Herald inbox: `~/.claude/oracle/inbox/herald-task-20260425-125011-22404.md`

### A-1 — H3 fix: `AppLayout.tsx` usePathname import replacement (commit `a4fa7c9`)

**Problem**: `AppLayout.tsx:17` imports `usePathname` from `next/navigation`.
`next/navigation` usePathname returns full path including locale prefix (`/en`, `/ko`).
`isActive` discrimination logic expecting locale-stripped pathname (`/dashboard`) always mismatches →
sidebar nav highlight disappears in English locale.

**Fix**: Replace `next/navigation` → `@/i18n/navigation` (next-intl wrapper).
`@/i18n/navigation`'s `usePathname` returns path with locale prefix removed.

```diff
- import { usePathname, useRouter } from 'next/navigation';
+ import { usePathname } from '@/i18n/navigation';
+ import { useRouter } from 'next/navigation';
```

**Impact**: `isActive('/dashboard')` correctly evaluates to true in English locale (`/en/dashboard`) → sidebar
highlight restored.

### A-2 — H1 fix: LanguageSwitcher 4 locations Suspense boundary added (commit `bddb225`)

**Problem**: `LanguageSwitcher` calls `useSearchParams()` internally. In Next.js 14 App Router,
Suspense boundaries without `useSearchParams()` may interrupt SSR rendering. May cause toggle mount
failure due to hydration instability when entering protected routes after login.

**Fix points 4 locations**:

| File | Location | Treatment |
|------|----------|-----------|
| `AppLayout.tsx` | L383 — Desktop sidebar | Added `<Suspense fallback={null}>` |
| `AppLayout.tsx` | L461 — Mobile sidebar | Added `<Suspense fallback={null}>` |
| `AuthShell.tsx` | L43 — Auth Shell header | Added `<Suspense fallback={null}>` |
| `LandingContent.tsx` | L80 — Landing header | Added `<Suspense fallback={null}>` |

admin layout requires no changes — already resolved by AppLayout internal Suspense.

```tsx
// Before
<LanguageSwitcher />

// After
<Suspense fallback={null}>
  <LanguageSwitcher />
</Suspense>
```

### A-3 — 8 New Regression Tests (commit `5f42157`)

**AppLayout.test.tsx — isActive locale-aware 4 items**:
- `ko` locale: `/ko/dashboard` pathname → `isActive('/dashboard')` true
- `en` locale: `/en/dashboard` pathname → `isActive('/dashboard')` true
- locale-stripped `/dashboard` → `isActive('/dashboard')` true (preserve existing behavior)
- Non-matching path → `isActive('/settings')` false

**LanguageSwitcher.test.tsx — Suspense + EN locale 4 items**:
- Rendering success when mounted within Suspense boundary
- Normal rendering in EN locale
- `aria-label` locale-aware verification
- Current locale display accuracy

**Jest result**: 1400 → **1408** (+8 new) PASS.

### Change Summary

| File | Task | Content |
|------|------|---------|
| `frontend/src/app/[locale]/(protected)/AppLayout.tsx` | Modified | usePathname import replacement + Suspense 2 locations |
| `frontend/src/app/[locale]/auth/AuthShell.tsx` | Modified | Suspense added |
| `frontend/src/app/[locale]/(public)/LandingContent.tsx` | Modified | Suspense added |
| `frontend/src/app/[locale]/(protected)/__tests__/AppLayout.test.tsx` | Modified | isActive locale-aware 4 cases added |
| `frontend/src/components/LanguageSwitcher/__tests__/LanguageSwitcher.test.tsx` | Modified | Suspense + EN locale 4 cases added |

5 files, +167/-15

---

## Critic 1st Cross-Review

Critic inbox: `~/.claude/oracle/inbox/critic-task-20260425-130033-23349.md`

| Item | Level | Content | Action |
|------|-------|---------|--------|
| — | Critical | None | — |
| — | High | None | — |
| `TopNav.tsx:335` Suspense boundary missing | Medium | AppLayout/AuthShell/LandingContent 3 locations fixed, TopNav not fixed. Currently 0 TopNav imports in app (dead code) → no runtime impact | Sprint 130 seed |
| `AppLayout.test.tsx:193~207` duplicate cases | Low | `locale-stripped /dashboard` case 2 identical mock+assertion, no coverage contribution | Sprint 130 seed or cleanup |

**Codex verdict original**:
> "The changes appear to correctly wrap the existing LanguageSwitcher call sites in Suspense and
> switch AppLayout to the locale-aware pathname hook without introducing any clear regressions.
> I did not find a discrete, actionable bug in the diff."

**Session ID**: `019dc2cc-4408-7803-af83-7094fe8c85e4`

**Summary: ✅ Ready to merge** (No Critical/High, Medium is dead code so not a blocker)

---

## Wave B Deferral Decision — H4 (Primary Suspect)

### Deferral Reason

Phase 1 static analysis identified the possibility that `client.ts:113-117`'s `window.location.href`
hard override conflicts with 401 redirect occurring during locale-switch, but:

- Cannot confirm actual collision path by static analysis (depends on component mount order + SWR revalidation timing)
- Possibility exists that H3/H1 fix alone resolves the post-login toggle symptom

### Decision Criteria

After Wave A merge:
- **Toggle works normally** → H4 is a false alarm, concluded, Wave B unnecessary
- **Toggle still not working** → Start Wave B:
  - Option A: `isLocaleTransitioning` flag — temporarily suppress 401 redirect during locale-switch
  - Option B: SWR `onError` per-component handling — router branching instead of global window.location.href

### Planned Implementation Location

Sprint 129 follow-up Wave B or Sprint 130 new item (decided based on user reproduction results).

---

## Verification Results

- `npx tsc --noEmit`: passed
- `npx next lint`: 0 new warnings
- `npx jest`: **131 suites, 1408 tests** passing (+8 new)
- Critic 1st codex passed (session `019dc2cc`)

## Agent Collaboration

| Agent | Responsibility |
|-------|---------------|
| herald | Phase 1 static analysis (H1~H5 hypothesis verification) + Wave A implementation (H3/H1 fix + regression tests) |
| critic | Wave A codex cross-review (1st) |
| scribe | Sprint 129 ADR writing |

---

## New Patterns / Lessons

### 1. usePathname import always prefers locale-aware version

`next/navigation`'s `usePathname` returns full path including locale prefix (`/en`, `/ko`).
Use `@/i18n/navigation`'s `usePathname` in all places that need locale-stripped pathname.

```ts
// ❌ includes locale prefix — isActive('/dashboard') mismatch
import { usePathname } from 'next/navigation';

// ✅ removes locale prefix — isActive('/dashboard') correct evaluation
import { usePathname } from '@/i18n/navigation';
```

This pattern is registered as a Sensei education session candidate (`@/i18n/navigation` vs `next/navigation` mixed use detection).

### 2. Components using useSearchParams must be wrapped in Suspense at call site

Components that internally call `useSearchParams()` (`LanguageSwitcher`) must be wrapped in
`<Suspense fallback={null}>` at each **call site** in the rendering tree to ensure SSR hydration stability.
Self-wrapping Suspense inside the component is insufficient — boundary must be specified at every mount point.

### 3. Phase 1 static analysis → hypothesis classification → Wave-unit progression pattern

```
Phase 1 (Herald static analysis)
  └─ Statically confirmable (H3/H1) → Wave A immediate fix
  └─ Runtime verification needed (H4) → Wave B deferred
       └─ Determined by reproduction after Wave A merge
```

Fixing statically confirmed bugs first and confirming runtime bugs later via user reproduction reduces
unnecessary speculative fixes and lowers risk.

### 4. dead code TopNav — incremental cleanup pattern

Critic identified TopNav:335 Suspense missing as Medium, but "0 imports" makes it non-blocking.
Pattern of registering as seed and removing in a separate Wave (or fixing together when going live)
rather than immediate deletion. Even when Critic finds dead code, blocker level is downgraded (Medium → sprint seed).

---

## Sprint 130 Seeds (3 items)

| # | Item | Level | Assigned | Reason |
|---|------|-------|---------|--------|
| S1 | `TopNav.tsx:335` LanguageSwitcher Suspense boundary add or dead code removal | Medium | Herald | Critic 1st identified — not immediate blocker since dead code |
| S2 | `AppLayout.test.tsx` duplicate case cleanup (`locale-stripped /dashboard` 2 → 1) | Low | Herald or Scout | Critic 1st identified — duplicate with no coverage contribution |
| S3 | Wave B (H4) — `client.ts` 401 handler locale-switch defense | TBD | Architect | Determined based on user reproduction results after Wave A merge |

---

## Reference

| Item | Path |
|------|------|
| Phase 1 hypothesis verification report | `~/.claude/oracle/inbox/herald-task-20260425-122835-21417.md` |
| Wave A implementation result | `~/.claude/oracle/inbox/herald-task-20260425-125011-22404.md` |
| Critic 1st codex review | `~/.claude/oracle/inbox/critic-task-20260425-130033-23349.md` |
| Critic session ID | `019dc2cc-4408-7803-af83-7094fe8c85e4` |
| Wave A commits | `a4fa7c9` / `bddb225` / `5f42157` |
| start_commit | `355da52` |
