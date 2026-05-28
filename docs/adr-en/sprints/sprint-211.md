---
sprint: 211
title: "GA4 page_view Tracking Reinforcement for All Pages (App Router Soft-Navigation)"
date: "2026-05-28"
status: completed
agents: [Oracle, Architect, Scribe]
related_adrs: ["sprint-210"]
related_memory: ["sprint-window"]
topics: ["frontend", "analytics", "ga4", "app-router"]
tldr: "Diagnosed that the GA4 integration from Sprint 210 — injected once into RootLayout — only fires a page_view on the initial load, and reinforced client-side navigation (soft navigation) page_view tracking with a code-based solution. The user selected Option B (code-based tracker) — sends sendGAEvent('page_view') on usePathname + useSearchParams changes without depending on Enhanced Measurement history events, fully testable. Key requirements: Suspense boundary mandatory for useSearchParams in App Router; initial mount skip prevents duplicate page_view from the gtag config call."
---
# Sprint 211 — GA4 page_view Tracking Reinforcement for All Pages (App Router Soft-Navigation)

## Goals

- Reinforce GA4 tracking so that page_view events are captured during App Router client-side navigation (soft navigation) as well, building on the Sprint 210 integration.
- Introduce a code-based route tracker that guarantees tracking independently of GA4 admin settings (Enhanced Measurement) and makes tracking testable.
- Prevent duplicate page_view events on the initial mount.

## Background

In Sprint 210, the `GoogleAnalytics` component from `@next/third-parties/google` was inserted into RootLayout. This component makes a single `gtag('config', gaId)` call, so only the initial-load page_view is fired. Because the App Router does not perform a full page refresh during client-side route transitions (soft navigation), `gtag config` is not called again.

**Current state**: soft-navigation page_view events depend entirely on GA4 Enhanced Measurement's 'page changes based on browser history events' setting (ON by default).

Two options were considered.

- **Option A**: Rely on Enhanced Measurement (lightweight). When the GA4 admin setting is ON, GA4 automatically processes history-event-based page_view. No code changes needed.
- **Option B**: Code-based tracker. Detects `usePathname` + `useSearchParams` changes and calls `sendGAEvent('event', 'page_view', ...)` directly. Independent of GA4 admin settings, fully testable. Recommends turning off Enhanced Measurement's history-based page changes to prevent double-counting.

The user selected **Option B (code-based tracker)**.

## Decisions

### D0. Route Tracking Approach — Code-Based Tracker (Option B)

Option A depends on GA4 admin configuration state, which cannot be guaranteed in code and cannot be tested. **Decision: proceed with Option B.**

It is recommended that the user turn off 'page changes based on browser history events' in GA4 admin → Enhanced Measurement settings to prevent double-counting (user action required; outside code scope).

### D1. Mandatory Suspense Boundary for useSearchParams

In Next.js App Router, client components using `useSearchParams()` must be wrapped in a `<Suspense>` boundary. Without it, a static-rendering deopt warning is emitted at build time, and potentially the entire route is downgraded from SSR to client-side rendering.

### D2. Initial Mount Skip — Duplicate page_view Prevention

The parent `GoogleAnalytics` component's `gtag('config', gaId)` call already fires a page_view on the initial load. A `useRef(true)` flag detects the initial mount and skips the `sendGAEvent` call on the first render.

## Implementation

### Phase A — New GoogleAnalyticsRouteTracker

New `src/components/analytics/GoogleAnalyticsRouteTracker.tsx` ('use client'):

- Uses `usePathname` and `useSearchParams` (next/navigation) to detect the current path and query parameters (including the full path with next-intl localePrefix 'as-needed')
- `useRef(true)` initial-mount flag — skips on first render (prevents duplicate with gtag config initial page_view)
- `useEffect([pathname, searchParams])` — on change, calls `sendGAEvent('event', 'page_view', { page_location: window.location.href, page_title: document.title })`
- Returns `null` (no UI)

### Phase B — GoogleAnalytics.tsx Update

Updated `src/components/analytics/GoogleAnalytics.tsx`:

- When `measurementId` is present, renders `NextGoogleAnalytics` together with `<Suspense fallback={null}><GoogleAnalyticsRouteTracker /></Suspense>`
- `GoogleAnalyticsRouteTracker` uses `useSearchParams`, which requires a Suspense boundary in App Router
- When the measurement ID is unset, returns `null` no-op (inheriting the Sprint 210 pattern)

### Phase C — Tests

New `src/components/analytics/GoogleAnalyticsRouteTracker.test.tsx` — 7 cases:

- Confirms `sendGAEvent` is not called on the initial mount (skip)
- Confirms `null` return
- Confirms `sendGAEvent` is called on `pathname` change
- Verifies `sendGAEvent` arguments — event name `'event'`, action `'page_view'`
- Confirms `sendGAEvent` is called on `searchParams` change
- `page_location` string type verification (jsdom `window.location.href` is non-configurable; type verification used instead of exact value assertion)
- `page_title` — precise `document.title` verification

Augmented `src/components/analytics/GoogleAnalytics.test.tsx` — 2 additional cases:

- Confirms `GoogleAnalyticsRouteTracker` renders alongside when measurement ID is set
- Confirms `GoogleAnalyticsRouteTracker` does not render when measurement ID is unset

### Phase D — No Dependency or CSP Changes

`sendGAEvent` is a wrapper around the existing dataLayer push, so no new external domains are introduced. No new npm packages, no `npm install` run, no `package-lock.json` changes (following the Sprint 210 lockfile-prune prevention pattern).

## Verification

Oracle direct verification (`npm ci`-based CI environment reproduction):

- `npm ci` EXIT=0 — monaco-editor and other dependencies preserved; no lockfile drift
- `npx tsc --noEmit` → EXIT=0, 0 errors
- `npx next lint` (raw) → EXIT=0, 0 warnings on new analytics files (only pre-existing chart/sidebar warnings)
- `npx next build` → EXIT=0, ✓ Compiled 16.6s, static 5/5 (no Suspense deopt)
- `test:coverage` → EXIT=0, 134 suites / 1390 tests (1381 existing + 9 new)
  - `GoogleAnalytics.tsx` 100% (stmts/branch/funcs/lines)
  - `GoogleAnalyticsRouteTracker.tsx` 100% (stmts/branch/funcs/lines)
  - Global thresholds met (lines 83 / branches 71 / functions 82 / statements 81)

Commit: `20a8eed feat(frontend): GA4 라우트 변경 page_view 추적 트래커 추가`

### ADR Index Gates

- `node scripts/check-adr-index-count.mjs --strict` → permanent 8 / topic 1 / sprint **149**
- `node scripts/check-adr-en-coverage.mjs --lint` → **158/158 (100%)**
- `node scripts/check-doc-refs.mjs` → 0 broken
- `node scripts/check-i18n-residue.mjs --strict` → prose Hangul max 2.19% (within 8% threshold)

## Lessons

1. **`@next/third-parties` GoogleAnalytics does not include SPA route tracking** — A single `gtag('config', gaId)` call fires only the initial-load page_view. Tracking App Router soft navigation requires either Enhanced Measurement or an explicit route tracker. When adding analytics libraries, verify their behavior in SPA environments.
2. **`useSearchParams` requires a Suspense boundary in App Router** — Client components using `useSearchParams()` must be wrapped in `<Suspense>` or a static rendering deopt occurs at build time. Always isolate `useSearchParams`-dependent client components behind Suspense.
3. **Initial mount skip prevents duplicate page_view from gtag config** — A `useRef(true)` flag skips the event dispatch on first render, preventing a duplicate from the parent `gtag config` initial page_view. This is a simple and reliable pattern that operates independently of Effect cleanup.
4. **jsdom `window.location` constraint — substitute type verification** — In the jsdom environment, `window.location.href` is non-configurable and cannot be mocked or overridden. Substitute exact URL value assertions with `string` type verification to balance testability and practicality.

## New Patterns

- **Explicit page_view tracker pattern for App Router route changes** — Detects `usePathname` + `useSearchParams` changes + skips initial mount with `useRef` + calls `sendGAEvent('event', 'page_view', ...)` directly. Independent of GA4 admin settings, fully testable, prevents double-counting.
- **`useSearchParams` Suspense isolation pattern** — Wrap client components that depend on `useSearchParams()` with `<Suspense fallback={null}>` at the parent level. Standard pattern for preventing static rendering deopt in App Router.

## Sprint 212+ Carryover

- **GA4 admin Enhanced Measurement history page_view OFF** (user action: configure in GA4 admin directly — prevents double-counting with the code-based tracker)
- **Production page_view UAT** (user-direct): verify that page_view events accumulate in the GA4 Realtime report when navigating between pages on `algo-su.com`
- **GA4 production UAT** (Sprint 210 carryover continued): confirm visit aggregation in GA4 Realtime report + verify cumulative users after a few days
- **NEXT_PUBLIC_BASE_URL domain alignment** (algosu.kr → algo-su.com) + SEO sitemap/robots/hreflang/canonical review
- **Operational Sprint 196 migration execution + server redeploy** (user/operations)
- **Harness `--full` CI scheduled automation review**

## Critic Cross-Review

Critic cross-review result — to be persisted by Oracle
