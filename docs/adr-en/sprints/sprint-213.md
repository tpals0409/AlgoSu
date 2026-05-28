---
sprint: 213
title: "NEXT_PUBLIC_BASE_URL fallback literal centralization (getBaseUrl SSOT)"
date: "2026-05-28"
status: completed
agents: [Oracle, Architect, Scribe, Critic]
related_adrs: ["sprint-212", "sprint-210"]
related_memory: ["sprint-window", "project-deploy-and-domain"]
topics: ["frontend", "seo", "i18n", "refactor"]
tldr: "We resolved the re-drift risk identified in Sprint 212. The NEXT_PUBLIC_BASE_URL fallback `?? 'https://algo-su.com'` was duplicated across four sites (sitemap/robots/[locale]layout/i18n metadata), so a domain change risked missing one site and ending up partially aligned. We centralized the fallback literal into a single constant DEFAULT_BASE_URL + getBaseUrl() helper in a dedicated module frontend/src/lib/site-url.ts (the sole SSOT) and replaced the four call sites with helper calls. getBaseUrl is a plain function that evaluates process.env on every call with no module caching, so both evaluation timings are preserved — import-time for sitemap/robots/layout and call-time for metadata (the env override test). We verified directly that the build artifacts sitemap.xml/robots.txt emit only algo-su.com with 0 remaining algosu.kr occurrences."
---
# Sprint 213 — NEXT_PUBLIC_BASE_URL fallback literal centralization (getBaseUrl SSOT)

## Goal

- Structurally resolve the **re-drift risk** identified in Sprint 212.
- Centralize the four duplicated `NEXT_PUBLIC_BASE_URL` fallback literals into a single helper (`getBaseUrl()`) as an SSOT.
- Preserve each call site's evaluation timing (import-time vs call-time) and the existing test behavior (env override) unchanged.

## Background

In [Sprint 212](./sprint-212.md) we aligned the `NEXT_PUBLIC_BASE_URL` fallback default from the dead domain `algosu.kr` to the actual live domain `algo-su.com`. During that work it became clear that the same fallback expression `process.env.NEXT_PUBLIC_BASE_URL ?? 'https://algo-su.com'` was **copied verbatim** across four sites: changing the domain once more would require updating all four simultaneously, and missing one would leave a partial alignment (Sprint 212 lesson 3 — "Four duplicated fallback literals are a re-drift risk", carried over as a Sprint 213+ centralization candidate).

The four duplicated sites:

- `src/app/sitemap.ts:14` — `BASE_URL` (sitemap URLs + ko/en hreflang)
- `src/app/robots.ts:13` — `BASE_URL` (the sitemap.xml link)
- `src/app/[locale]/layout.tsx:31` — `metadataBase` (the basis of all OG/twitter URLs)
- `src/lib/i18n/metadata.ts:40` — `baseUrl` (canonical + hreflang alternates, inside `buildLocaleAlternates`)

This work is a pure behavior-preserving refactor that gathers the point where the fallback literal is defined into a single SSOT.

## Decision

### D0. Helper location — new dedicated module `frontend/src/lib/site-url.ts`

Two locations were considered.

- **Alternative**: add `getBaseUrl()` to the existing `src/lib/i18n/metadata.ts`. But this would make `robots.ts` / `sitemap.ts` **import an i18n-domain file**, which crosses domains (the site URL is a broader, site-wide concern than i18n). Rejected to avoid that unnatural dependency.
- **Decision**: create a new site-URL-only common module `src/lib/site-url.ts` (`@domain common`). The site URL is a site-wide concern shared by i18n, sitemap, robots, and layout alike, so a separate common module fits single responsibility (SRP).

### D1. Core design constraint — a plain function with no caching (preserving evaluation timing)

`getBaseUrl()` is a plain function that evaluates `process.env` on every call **with no module-scope caching** (`return process.env.NEXT_PUBLIC_BASE_URL ?? DEFAULT_BASE_URL`). The fallback literal `'https://algo-su.com'` is defined exactly once as the `DEFAULT_BASE_URL` constant in `site-url.ts` — the **sole SSOT**.

By not caching, each call site's evaluation timing is preserved as-is.

| Call site | Usage form | Evaluation timing |
|-----------|------------|-------------------|
| `sitemap.ts:14` | `const BASE_URL = getBaseUrl()` | module-level const → **import-time** (preserved) |
| `robots.ts:13` | `const BASE_URL = getBaseUrl()` | module-level const → **import-time** (preserved) |
| `[locale]/layout.tsx:31` | `new URL(getBaseUrl())` | module-level metadata → **import-time** (preserved) |
| `i18n/metadata.ts:40` | `const baseUrl = getBaseUrl()` (inside `buildLocaleAlternates`) | inside the function → **call-time** (preserved) |

Because the call-time evaluation in `metadata.ts` is preserved, the env-override assertions in `metadata.test.ts` keep passing (behavior that module caching would have broken).

### D2. No dependency changes — npm install forbidden

This work is only a new helper module + import/substitution; there are no new npm packages. To prevent a recurrence of the [Sprint 210](./sprint-210.md) lockfile prune, we do not run `npm install` and do not change `package.json` / `package-lock.json`. Verification reproduces the CI environment with `npm ci`.

## Implementation

A single atomic commit by Architect: `b74f1f4` (`refactor(frontend): centralize NEXT_PUBLIC_BASE_URL fallback into getBaseUrl SSOT`).

### New files (2)

- `src/lib/site-url.ts` — the `DEFAULT_BASE_URL` constant (the sole definition of the fallback literal) + the `getBaseUrl()` helper. File header `@domain common` / `@layer lib`; the function JSDoc documents the evaluation timing and nullish coalescing (an empty string is not treated as falsy and is returned as-is).
- `src/lib/__tests__/site-url.test.ts` — 3 cases:
  - env set → returns that value
  - env unset → returns the fallback `https://algo-su.com`
  - empty string (`''`) set → nullish coalescing returns the empty string as-is

  branch coverage 100%. Since `getBaseUrl` reads env at call time, restoring env after each test is sufficient (no module reset needed).

### Modified files (4)

Each file adds `import { getBaseUrl } from '@/lib/site-url';` and replaces the fallback expression with a helper call:

- `sitemap.ts:14` — `const BASE_URL = getBaseUrl()` (import-time evaluation preserved)
- `robots.ts:13` — `const BASE_URL = getBaseUrl()` (import-time evaluation preserved)
- `[locale]/layout.tsx:31` — `metadataBase: new URL(getBaseUrl())` (import-time evaluation preserved)
- `i18n/metadata.ts:40` — `const baseUrl = getBaseUrl()` (call-time evaluation preserved) + adjusted the `buildLocaleAlternates` JSDoc for consistency with the helper delegation

Since there are no new dependencies, `package.json` / `package-lock.json` are unchanged (D2).

## Verification

Oracle verified directly (CI environment reproduced via `npm ci`):

- `npm ci` → EXIT=0 (lockfile aligned — 0 prunes, no dependency drift)
- `npx tsc --noEmit` → No errors found (0)
- `npx next lint` (raw) → 0 errors / 0 warnings (0 new warnings in the changed files)
- `npx next build` → ✓ Compiled successfully, static pages 5/5 generated (the "Errors: 2" in the RTK summary is a miscount of the `@sentry/nextjs` configuration notice — the build is actually fine)
- `npx jest --coverage` → 135 suites / 1393 tests PASS (the prior 1390 + 3 new). `site-url.ts` **100%** (stmt/branch/func/line), `metadata.ts` 100% retained, All files 86.47% stmt / 78.36% branch — global thresholds (lines 83 / branches 71 / functions 82 / statements 81) satisfied

### Build artifact domain verification (direct)

```
.next/server/app/sitemap.xml.body:
  <loc>https://algo-su.com/</loc>  (0 remaining algosu.kr)
  hreflang ko 7 + en 7 (7 pages × 2 locales)

.next/server/app/robots.txt.body:
  Sitemap: https://algo-su.com/sitemap.xml
```

- **0** remaining `algosu.kr` occurrences in the SEO artifacts (sitemap/robots); all are `algo-su.com`
- Because "the code reads the helper" and "the actual emitted SEO domain" are separate layers, even after helper centralization the emitted domain is confirmed end-to-end via an artifact grep

### ADR index gates

- `node scripts/check-adr-index-count.mjs` → sprint **151**
- `node scripts/check-adr-en-coverage.mjs` → **160/160 (100%)**
- `node scripts/check-doc-refs.mjs` → 0 broken
- `node scripts/check-i18n-residue.mjs` → prose Hangul within the threshold (8%)

## Lessons

1. **Duplicated public env fallback literals are the root cause of re-drift risk** — the reason Sprint 212 had to edit the same fallback at four sites simultaneously when aligning the domain was exactly this duplication. Gathering them into a single SSOT helper means the next domain change only edits one site (`DEFAULT_BASE_URL`), propagates to all call sites, and eliminates the partial-alignment risk.
2. **Evaluation timing is preserved naturally by making the helper a "plain function with no caching"** — module-scope caching would evaluate once at import time and break the call-time env-override test in `metadata.ts`. When the helper reads `process.env` on every call, module-level const call sites stay import-time and in-function call sites stay call-time, each keeping its own evaluation timing.
3. **A direct build-artifact grep complements code verification** — passing tsc/lint/test only proves "the call sites read the helper correctly." Helper centralization is a code-level change, so the actual emitted SEO domain must still be confirmed end-to-end by grepping `.next/server/app/sitemap.xml.body` / `robots.txt.body`.

## New patterns

- **Public env default SSOT helper pattern** — do not copy the fallback literal of a public env (`NEXT_PUBLIC_*`) inlined at build time across many call sites; centralize it into a single constant (`DEFAULT_BASE_URL`) + a plain function (`getBaseUrl()`). The function evaluates env on every call with no module caching, so call sites keep their own evaluation timing (an import-time const / an in-function call-time evaluation) while calling the helper. Domain/default changes touch only the one SSOT constant.

## Sprint 214+ carry-over

- **Server redeploy + live SEO verification** (user/ops): merge ≠ live rollout (build is automatic, rollout is manual ops, [project-deploy-and-domain](../../../.claude/projects/-Users-leokim-Desktop-leo-kim-AlgoSu/memory/project-deploy-and-domain.md)). After redeploy, confirm live domain alignment via `curl https://algo-su.com/sitemap.xml` / `robots.txt` <!-- doc-ref-lint: ignore -->
- **GA4 data stream URL alignment** (user): set the stream URL to `algo-su.com` in the GA4 admin console
- **GA4 admin Enhanced Measurement history page_view OFF** (user, ongoing Sprint 211 carry-over)
- **GA4 production page_view UAT** (user, ongoing Sprint 210/211 carry-over)
- **Operational Sprint 196 migration run** (user/ops)
- **Harness `--full` CI scheduled-run automation review** (ongoing Sprint 209 carry-over)

## Critic cross-review

**R1 — CLEAN** (Codex, `codex review --base 87c983c`, codex-cli 0.130.0 / gpt-5 family, session `019e6e92-77d6-7a33-af5c-caff700744ab`)

> "The changes centralize the base URL fallback without altering the observable behavior of the existing call sites. I did not find any introduced correctness, security, performance, or maintainability issue that warrants an inline finding."

Findings Critical / High / Medium / Low **all 0**. Confirmed that the fallback centralization is a pure refactor that does not change the observable behavior of the existing call sites (import-time/call-time evaluation timing, env override).
