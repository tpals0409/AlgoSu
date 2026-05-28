---
sprint: 212
title: "NEXT_PUBLIC_BASE_URL domain alignment + SEO audit (algosu.kr → algo-su.com)"
date: "2026-05-28"
status: completed
agents: [Oracle, Architect, Scribe, Critic]
related_adrs: ["sprint-210", "sprint-211"]
related_memory: ["sprint-window", "project-deploy-and-domain"]
topics: ["frontend", "seo", "i18n", "config"]
tldr: "The project config's NEXT_PUBLIC_BASE_URL pointed at the dead domain algosu.kr (HTTP 000), and the variable was not injected into the Dockerfile, so the production build inlined the code fallback algosu.kr into the bundle — meaning the live site's (algo-su.com) sitemap/robots/canonical/hreflang/OG pointed at a dead domain (a silent SEO loss). We aligned the four code fallbacks + JSDoc example + test assertions + .env.example to algo-su.com, and — following the GA4/AdSense precedent — explicitly injected ENV NEXT_PUBLIC_BASE_URL into the Dockerfile (removing the implicit fallback dependency). We verified directly that the build artifacts sitemap.xml/robots.txt emit algo-su.com."
---
# Sprint 212 — NEXT_PUBLIC_BASE_URL domain alignment + SEO audit (algosu.kr → algo-su.com)

## Goal

- Align the `NEXT_PUBLIC_BASE_URL` default (`algosu.kr`) with the actual live domain (`algo-su.com`).
- Fix SEO artifacts (sitemap / robots / canonical / hreflang / Open Graph) that pointed at the dead domain.
- Ensure the production build inlines the correct domain into the bundle.

## Background

During the Sprint 210 GA4 integration work, a mismatch was discovered: the real service domain is **`algo-su.com`** (HTTP 200), whereas `NEXT_PUBLIC_BASE_URL` in `frontend/.env.example` was set to `https://algosu.kr` (HTTP 000, no response) ([sprint-210](./sprint-210.md), [project-deploy-and-domain](../../../.claude/projects/-Users-leokim-Desktop-leo-kim-AlgoSu/memory/project-deploy-and-domain.md)). <!-- doc-ref-lint: ignore -->

The investigation confirmed two layers of the problem.

1. **Code fallback drift** — the `process.env.NEXT_PUBLIC_BASE_URL ?? 'https://algosu.kr'` fallback is duplicated across four sites, all defaulting to the dead domain:
   - `src/app/sitemap.ts:14` — sitemap URLs + ko/en hreflang
   - `src/app/robots.ts:13` — the sitemap.xml link
   - `src/app/[locale]/layout.tsx:32` — `metadataBase` (the basis of all OG/twitter URLs)
   - `src/lib/i18n/metadata.ts:40` — canonical + hreflang alternates
2. **Dockerfile not injecting the variable** — the production `frontend/Dockerfile` did not inject `NEXT_PUBLIC_BASE_URL`, so at build time the code fallback `algosu.kr` was inlined verbatim into the bundle. In other words, **the live site's SEO artifacts were already pointing at a dead domain** (a real SEO loss — diluted canonical authority, sitemap/robots steering crawlers toward a non-live domain).

JSON-LD structured data and an explicit og:image are not present in the code, so they are out of scope here.

## Decision

### D0. Fix the fallback + explicit Dockerfile injection (Option B)

Two approaches were considered.

- **Option A**: fix only the code fallback default to `algo-su.com`. Production gets the correct domain via the fallback, but **implicitly**.
- **Option B**: fix the fallback default + explicitly inject `ENV NEXT_PUBLIC_BASE_URL` in the Dockerfile. **Explicit** injection consistent with the GA4 (`G-NMNVNCKW37`) / AdSense precedent, plus a safe default that also covers dev/test/non-Docker builds.

**Decision: Option B.** Fixing only the fallback makes the production domain implicit (you cannot tell from the Dockerfile alone), and fixing only the Dockerfile leaves the dev/test default and `.env.example` inconsistent. Both changes are cheap, so we align both sides. `NEXT_PUBLIC_BASE_URL` is a public client value (inlined into the bundle and exposed to the browser), so no SealedSecret is needed — the same public-value precedent as the GA4 measurement ID and AdSense client ID.

### D1. Dev/demo mock emails are out of scope

The mock emails in `src/contexts/AuthContext.tsx:107` (`dev@algosu.kr`) and `src/components/layout/AppLayout.tsx:512` (`demo@algosu.kr`) are internal identifiers unrelated to SEO. The demo banner display condition depends on the `user?.email === 'demo@algosu.kr'` equality check, so changing only one side would break the banner. These are **intentionally excluded** from this work.

### D2. No dependency changes — npm install forbidden

This work is only string-literal corrections + one Dockerfile ENV line; there are no new npm packages. To prevent a recurrence of the [sprint-210](./sprint-210.md) lockfile prune, we do not run `npm install` and do not change `package.json` / `package-lock.json`. Verification reproduces the CI environment with `npm ci`.

## Implementation

### Phase A — Code fallback alignment (Architect)

`'https://algosu.kr'` → `'https://algo-su.com'`:

- `src/app/sitemap.ts:14` — `BASE_URL` fallback
- `src/app/robots.ts:13` — `BASE_URL` fallback
- `src/app/[locale]/layout.tsx:32` — `metadataBase` fallback
- `src/lib/i18n/metadata.ts:40` — `baseUrl` fallback
- `src/lib/i18n/metadata.ts:27~31` — `buildLocaleAlternates` JSDoc example (doc accuracy)

### Phase B — Test assertion alignment (Architect)

`src/lib/i18n/__tests__/metadata.test.ts` — default-value assertions when the env var is unset:

- L32: `expect(result?.canonical).toBe('https://algo-su.com/')`
- L38: `x-default` assertion `'https://algo-su.com/problems'`

### Phase C — Config/build alignment (Architect)

- `.env.example:5` — `NEXT_PUBLIC_BASE_URL=https://algo-su.com`
- `Dockerfile` — add `ENV NEXT_PUBLIC_BASE_URL=https://algo-su.com` after the GA4 ENV block (build-time bundle inlining)

### Phase D — Critic R1 follow-up: legal contact email alignment

The initial SEO grep only checked `src` / `.env.example` / `Dockerfile` and missed the `messages/` directory. Critic R1 (Codex) caught that the privacy-policy §7 contact in `messages/ko/legal.json:50` / `messages/en/legal.json:50` still exposed the dead domain `privacy@algosu.kr` (cannot receive mail). This is a **user-facing legal contact**, not an internal identifier, so it falls within the domain-alignment scope.

Per the user's decision, rather than a plain domain substitution (`privacy@algo-su.com`) we replaced it with the operational email `tpalsdlapfnd@gmail.com` (an address with a guaranteed mailbox — actual deliverability prioritized over domain matching). The two internal dev/demo mock emails remain out of scope per D1.

## Verification

Oracle verified directly (CI environment reproduced via `npm ci`):

- `npm ci` → EXIT=0, 1064 packages (lockfile unchanged — no dependency drift)
- `npx tsc --noEmit` → EXIT=0, 0 errors
- `npx next lint` (raw) → EXIT=0. 0 new warnings in the changed SEO files (sitemap/robots/metadata/layout); only pre-existing inline-style / exhaustive-deps warnings in UI components and hooks remain, unrelated to this change
- `npx next build` → EXIT=0, ✓ Compiled 8.4s
- `npx jest --coverage` → EXIT=0, 1390 PASS / 0 FAIL, global thresholds (lines 83 / branches 71 / functions 82 / statements 81) satisfied

### Build artifact domain verification (direct)

```
.next/server/app/sitemap.xml.body:
  <loc>https://algo-su.com/</loc>
  <xhtml:link rel="alternate" hreflang="ko" href="https://algo-su.com/" />
  <xhtml:link rel="alternate" hreflang="en" href="https://algo-su.com/en/" />

.next/server/app/robots.txt.body:
  Sitemap: https://algo-su.com/sitemap.xml
```

- **0** remaining `algosu.kr` occurrences in the SEO artifacts (sitemap/robots); all are `algo-su.com`
- The initial grep only checked SEO code, but Critic R1 additionally caught the user-facing legal contact in `messages/{ko,en}/legal.json` → aligned in Phase D. **Finally**, the only remaining `algosu.kr` occurrences across `frontend` are the 2 dev/demo mock emails (intentionally excluded per D1)

### ADR index gates

- `node scripts/check-adr-index-count.mjs --strict` → permanent 8 / topic 1 / sprint **150**
- `node scripts/check-adr-en-coverage.mjs --lint` → **159/159 (100%)**
- `node scripts/check-doc-refs.mjs` → 0 broken
- `node scripts/check-i18n-residue.mjs --strict` → prose Hangul max 2.19% (within the 8% threshold)

## Lessons

1. **Domain drift in a public env fallback is a silent SEO loss** — for a public variable inlined into the bundle at build time like `NEXT_PUBLIC_BASE_URL`, if it is not injected in the Dockerfile, the code fallback gets baked into production verbatim. Even when the fallback points at a dead domain the build/tests pass, so the live SEO degrades quietly with no runtime/CI signal. When the live domain changes, the `NEXT_PUBLIC_*` fallbacks and the Dockerfile injection must be checked together.
2. **The fallback default and the explicit injection must both be aligned** — fixing only the fallback makes the production domain implicit; fixing only the Dockerfile leaves dev/test and `.env.example` inconsistent. For a public env, both layers — (a) the code fallback set to the real default, and (b) explicit Dockerfile injection — must match so drift does not recur.
3. **Four duplicated fallback literals are a re-drift risk** — the `?? 'https://...'` fallback is copied across sitemap/robots/layout/metadata, so changing the domain risks missing one site and ending up partially aligned. Verifying full alignment via a build-artifact grep (`algosu.kr` 0 occurrences) is safer. (Centralization is a Sprint 213+ candidate.)
4. **Direct build-artifact verification complements code verification** — passing tsc/lint/test only proves "the code reads the correct fallback." The actual SEO effect must be confirmed end-to-end by grepping `.next/server/app/sitemap.xml.body` / `robots.txt.body` for the emitted domain.

## New patterns

- **Public env domain alignment pattern** — when the live domain changes, perform four steps together: (a) fix all code fallback defaults, (b) explicitly inject the Dockerfile `ENV`, (c) align `.env.example`, (d) verify exhaustively via a build-artifact grep. Fixing only the fallback or only the injection leaves implicit/inconsistent drift.
- **SEO artifact build-verification pattern** — when changing sitemap/robots/canonical, read `.next/server/app/sitemap.xml.body` / `robots.txt.body` directly to confirm the emitted domain and hreflang. Separate code-level verification (fallback value) from artifact-level verification (actual output).

## Sprint 213+ carry-over

- **Server redeploy + live verification** (user/ops): merge ≠ live rollout (build is automatic, rollout is manual ops, [project-deploy-and-domain](../../../.claude/projects/-Users-leokim-Desktop-leo-kim-AlgoSu/memory/project-deploy-and-domain.md)). After redeploy, confirm live domain alignment via `curl https://algo-su.com/sitemap.xml` / `robots.txt` <!-- doc-ref-lint: ignore -->
- **GA4 data stream URL alignment** (user): set the stream URL to `algo-su.com` in the GA4 admin console
- **Fallback literal centralization review** (Sprint 213+ candidate): centralize the four duplicated fallbacks into a single helper (`getBaseUrl()`) to block re-drift
- **GA4 admin Enhanced Measurement history page_view OFF** (user, ongoing Sprint 211 carry-over)
- **GA4 production page_view UAT** (user, ongoing Sprint 210/211 carry-over)
- **Operational Sprint 196 migration run** (user/ops)
- **Harness `--full` CI scheduled-run automation review** (ongoing Sprint 209 carry-over)

## Critic cross-review

**R1 — 1 × P3** (Codex, `codex review --base ae25f51`)

> "[P3] Correct the remaining algosu.kr inventory — `docs/adr/sprints/sprint-212.md:101`. This verification note is inaccurate: `frontend/messages/en/legal.json` and `frontend/messages/ko/legal.json` still contain the user-facing `privacy@algosu.kr` contact address, so the remaining frontend occurrences are not limited to the two dev/demo mock emails."

The runtime code/config changes are consistent with the intent (domain switch) and non-blocking. The sole finding is a **non-blocking P3**: the user-facing legal contact in `messages/{ko,en}/legal.json`, missed by the SEO code grep, still pointed at the dead domain. → **Resolved at the root in Phase D** (replaced with a user-specified operational email) + this ADR's inventory corrected.

**R2 — CLEAN** (Codex, `codex review --base ae25f51`, re-reviewed after Phase D)

> "The changes consistently update the public base URL fallbacks, Docker build-time environment, examples, and tests to the new domain. I did not find a discrete regression or blocking issue in the modified lines."

Findings Critical / High / Medium / Low **all 0**. Confirmed that the R1 P3 was resolved in Phase D.
