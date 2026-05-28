---
sprint: 210
title: "Google Analytics (GA4) Cumulative Visitor Tracking Integration (Lightweight, Frontend-Only)"
date: "2026-05-28"
status: completed
agents: [Oracle, Architect]
related_adrs: ["sprint-209"]
related_memory: ["sprint-window"]
topics: ["frontend", "analytics", "ga4", "csp"]
tldr: "Integrated GA4 tracking into the AlgoSu frontend (Next.js 15.5.15 App Router) to enable cumulative visitor monitoring via the Google GA4 dashboard. Selected Option A (direct GA4 dashboard review, lightweight) — no in-app display, no GA4 Data API, no service account, no backend. Used the @next/third-parties/google GoogleAnalytics component; returns no-op when the measurement ID is unset (inheriting the Sentry enabled pattern); updated CSP. Key lesson: npm install vs. npm ci lockfile consistency trap — Architect's npm install pruned 49 packages, causing local tests to pass but CI npm ci to fail; caught at Oracle verification stage and corrected by restoring the original lockfile and running npm install --package-lock-only."
---
# Sprint 210 — Google Analytics (GA4) Cumulative Visitor Tracking Integration (Lightweight, Frontend-Only)

## Goals

- Integrate GA4 tracking into the AlgoSu frontend (Next.js 15.5.15 App Router).
- Enable cumulative visitor monitoring via the Google GA4 dashboard.
- Limit scope to the lightweight option (direct GA4 dashboard review), excluding in-app display, Data API, and backend dependencies.

## Background

An analytics tool was needed to track cumulative visitors to AlgoSu. Two implementation options were considered.

- **Option A**: Check visitor counts directly from the GA4 dashboard. Completed by inserting the `@next/third-parties/google` component only. Visitor figures are visible via the GA4 dashboard after the measurement ID is provisioned.
- **Option B**: Display visitor counts in-app. Requires the full stack: GA4 Data API + service account (SealedSecret) + backend endpoint + frontend component.

The user selected **Option A (lightweight)**.

## Decisions

### D0. Cumulative Visitor Data Access Path — Direct GA4 Dashboard (Option A)

Option B (in-app display) requires the GA4 Data API + service account SealedSecret + backend endpoint, which exceeds this sprint's scope. **Decision: proceed with Option A; Option B is deferred as a separate sprint candidate.**

### D1. GA Integration Approach — `@next/third-parties/google` Official Component

Use the `GoogleAnalytics` component from the official Next.js `@next/third-parties` package. The measurement ID is injected via the `NEXT_PUBLIC_GA_MEASUREMENT_ID` environment variable.

| Approach | Details | Choice |
|----------|---------|--------|
| `@next/third-parties/google` | Official Next.js third-parties, server-component compatible, automatic script optimization | ✅ |
| Direct `<script>` injection | Manual gtag.js injection | ❌ (non-idiomatic, no optimization) |

### D2. Conditional Activation — No-op When Measurement ID Is Unset

When the measurement ID is falsy (unset or empty string), the component returns `null` (no-op). This inherits the existing Sentry pattern (`enabled: !!NEXT_PUBLIC_SENTRY_DSN` in `sentry.client.config.ts`).

## Implementation

### Phase A — Dependency Addition

Added `@next/third-parties@^15.5.15` (resolves to `15.5.18` on `npm install`).

**Lockfile correction (key incident)**:
During Architect's initial `npm install` run, `monaco-editor` (a peer of `@monaco-editor/react`) and 49 other required packages including `webpack`, `dompurify`, and `marked` were incorrectly pruned from `package-lock.json` (−662 lines). Because `npm install` is lenient, the local `test:coverage` run (1381 tests passing) succeeded, but the CI-used strict `npm ci` failed with `EUSAGE Missing: monaco-editor from lock file`. This was caught at the Oracle verification stage: the original `02018fc` lockfile was fully restored, then `npm install --package-lock-only` was used to add only the 2 new deps, normalizing the diff to +24/−11 and confirming `npm ci` EXIT=0 (1112 packages).

### Phase B — New GoogleAnalytics Server Component Wrapper

New `src/components/analytics/GoogleAnalytics.tsx`:
- Imports `GoogleAnalytics as GA` from `@next/third-parties/google` (alias to avoid naming collision)
- Returns `null` when `NEXT_PUBLIC_GA_MEASUREMENT_ID` is falsy

### Phase C — RootLayout Integration

`src/app/layout.tsx` — inserted `<GoogleAnalytics />` after `children` inside the body.

### Phase D — CSP Update

Updated the Content-Security-Policy header in `next.config.ts`:
- `script-src`: added `googletagmanager.com`
- `img-src`: added `googletagmanager.com`, `google-analytics.com`, `*.google-analytics.com`
- `connect-src`: added `google-analytics.com`, `*.google-analytics.com`, `*.analytics.google.com`, `googletagmanager.com`

Existing origins (e.g., `cdn.jsdelivr.net`) were preserved.

### Phase E — `.env.example` Update

Added `NEXT_PUBLIC_GA_MEASUREMENT_ID=` with a descriptive comment.

### Phase F — 7 Test Cases

New `src/components/analytics/GoogleAnalytics.test.tsx` — 7 cases:
- Verifies `<GoogleAnalytics>` renders when a measurement ID is set
- Verifies `null` return (no-op) when ID is `undefined`, empty string, or unset
- Component branch coverage 100%

Restored `@testing-library/dom` devDependency (collateral damage from the initial `npm install` prune).

## Verification

### Gates

- `npm ci` → added 1112 packages, EXIT=0 (CI install consistency confirmed)
- `npx tsc --noEmit` → EXIT=0, 0 errors
- `npx next lint` → EXIT=0 (Error 0; only pre-existing UI-component Warnings)
- `npx jest src/components/analytics` → **7/7 passing** (branch coverage 100%)
- `test:coverage` (full): 133 suites, 1381 tests, thresholds met (lines 83 / branches 71 / functions 82 / statements 81)

### ADR Index Gates

- `node scripts/check-adr-index-count.mjs --strict` → permanent 8 / topic 1 / sprint **148**
- `node scripts/check-adr-en-coverage.mjs --lint` → **157/157 (100%)**
- `node scripts/check-doc-refs.mjs` → 0 broken

## Lessons

1. **npm install vs. npm ci lockfile consistency trap** — `npm install` is lenient: it installs packages directly into node_modules but may prune existing packages from `package-lock.json` when recalculating peer dependencies. `npm ci` treats the lockfile as the SSOT and rejects with `EUSAGE` any package missing from the lock. Consequently, `npm install` passing ≠ `npm ci` passing. **Any PR that adds dependencies must be verified with `npm ci`.** Using `npm install --package-lock-only` for new-dep additions updates only the lockfile without touching node_modules.
2. **Pruned node_modules artifacts misidentified as pre-existing bugs** — The 'pre-existing CodeEditor.tsx L262 tsc error' reported by Architect was in fact an artifact of the pruned node_modules. It resolved naturally to 0 errors after restoring the lockfile and running `npm ci`. Lockfile consistency should be verified before diagnosing build or type errors.
3. **Oracle verification stage catches lockfile drift** — Even though all local tests (npm install environment) passed, the Oracle verification stage directly ran `npm ci` to reproduce the CI environment, catching the issue before merge. The Oracle direct-verification step is a defensive line that surfaces hidden defects caused by environmental differences after agent delegation.

## New Patterns

- **`npm install --package-lock-only` + `npm ci` verification pattern for dependency additions** — When adding new npm packages, update only the lockfile with `npm install --package-lock-only` (node_modules unchanged), then verify `npm ci` EXIT=0. Using `npm install` alone carries the risk of lockfile pruning.
- **Sentry no-op inheritance pattern** — For environment-variable-based optional third-party integrations, return `null` (no-op) from the component when `!!ENV_VAR` is falsy. Generalized from `sentry.client.config.ts`'s `enabled: !!NEXT_PUBLIC_SENTRY_DSN` to the `GoogleAnalytics` component.

## Critic Cross-Review

- **R1 CLEAN ✅** (Codex `codex review --base 02018fc`, model gpt-5.5, session `019e6d5d-5dfb-7e23-9aa7-f26ad2bdc863`): "The GA4 integration is conditionally enabled, wired into the root layout, and the CSP/dependency updates appear consistent with the new third-party script usage. I did not identify any discrete regression introduced by the diff."
- Findings: Critical/High/Medium/Low all **0**. The Critic directly inspected the `@next/third-parties/google` GA implementation source, CSP, and dependencies. R2+ unnecessary — complying with the placeholder regression-prevention decision, only R1 is persisted.

## Sprint 211+ Carryover

- **Production GA4 measurement ID (G-XXXXXXX) provisioning + frontend Dockerfile ENV/ARG injection** (operations/user track, following the Sentry DSN precedent).
- **Cookie consent (GDPR consent mode)** — separate sprint candidate.
- **GA4 Data API in-app display** (Option B, excluded this sprint because the user selected Option A).
- **Operational Sprint 196 migration execution + server redeploy** (user/operations) — problem_db jsonb transition + GIN index.
- **Accumulated UAT** (user-direct) — Programmers re-submission grading / English production Grafana CB dashboard.
