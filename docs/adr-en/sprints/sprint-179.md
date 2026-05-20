---
sprint: 179
title: "Full removal of Google AdSense code from the frontend"
date: "2026-05-20"
status: completed
agents: [Oracle, Architect, Critic, Scribe]
related_adrs: ["sprint-122"]
related_memory: ["sprint-window"]
---
# Sprint 179 — Full removal of Google AdSense code from the frontend

## Goal

- Because ads never actually loaded, `.ad-container` rendered as an "Ad" label + empty box at the bottom/sidebar of 9 pages — ad revenue was zero while **only an empty area remained, hurting user UX**.
- **Fully remove** the AdSense infrastructure (component·script·slots·CSS·env·CSP·ads.txt·i18n·legal copy) from the frontend. Standard cycle (single working branch + PR + Squash merge + Critic) preserved.

## Decisions

### D1. Beyond code removal, trace and remove the entire ad infrastructure (user-approved)

The ad feature was not a single component but infrastructure spread across many layers — the `AdBanner` component, `AD_SLOTS` constants, the AdSense `<Script>` loader in `layout.tsx`, `.ad-container` CSS, the `ad` namespace in `common.json`, 4 test mocks, allowed domains in `next.config.ts`·`ingress.yaml` CSP, `.env.example` env vars, and `public/ads.txt` (publisher verification). "Removing AdBanner" alone would leave dead code/dead permissions, so we **traced every layer — data, config, docs — with a grep sweep** and removed it.

### D2. Remove ad CSP domains as dead permissions (security hardening)

The googlesyndication/doubleclick/googleads/googletagservices/adservice allowances open in `next.config.ts` (script-src/img-src/connect-src/frame-src) and `infra/k3s/ingress.yaml` (script-src) are **unnecessarily broad permissions** as long as no ads are served. We removed them from CSP alongside the ad removal, narrowing the attack surface. The `frame-src` directive was ad-only, so it was removed entirely → it falls back to a stricter `default-src 'self'`.

### D3. Remove AdSense mentions from the privacy policy/legal copy (accuracy, user-approved)

Once we stop running ads, legal phrasing such as "transmits non-identifiable info to Google" · "collection for ad serving" · "AdSense third-party cookies" becomes **factually wrong**. Removing only the code while leaving the policy text would be inaccurate disclosure. We removed section2.item5 (collection purpose "ad serving") · section4.adsense (third-party disclosure) · section5 body (cookie policy) from `legal.json` (ko/en) and the corresponding rendering in `privacy/page.tsx`. Note: section3.item2's "display·advertising records (e-commerce law, 6 months)" is a general statutory retention clause, not AdSense-specific, so it is kept.

## Implementation

### PR #311 — full removal of Google ad code (26 files +9/-258)

- **File deletions (3)**: `components/ad/AdBanner.tsx`, `lib/constants/adSlots.ts`, `public/ads.txt`.
- **9 pages**: removed `AdBanner`/`AD_SLOTS` import + usage from LandingContent·dashboard·problems·problems/[id]·submissions·submissions/[id]/analysis·analytics·profile·studies.
- **`layout.tsx`**: removed the AdSense `<Script>` block·`adsenseEnabled`/`adsenseClientId` consts·`import Script`·doc comment.
- **Test mocks (4)**: removed `AdBanner`/`adSlots` jest.mock from studies·sql-auto-language·[locale]/page·analysis tests (safe — zero assertion sites).
- **i18n/CSS**: `common.json` (ko/en) `ad` namespace, `globals.css` `.ad-container`/`::before`.
- **CSP/env**: ad domains in `next.config.ts`·`ingress.yaml`, `NEXT_PUBLIC_ADSENSE_*` in `.env.example`.
- **Legal**: 3 spots in `legal.json` (ko/en) + 2 spots in `privacy/page.tsx`.

## Critic cycle

`codex review --base main`, 1 round (session `019e4560-0a28-72c3-8a5e-c4ecfcab8f52`): **0 findings** — "the changes consistently remove AdSense script loading, banner usage, slot constants, styles, ads.txt, CSP allowances, and translations/legal copy, with no remaining references that would break build/runtime". Merge-ready.

## Verification

### Local
- `tsc --noEmit` passes.
- ESLint 0 errors / 0 warnings.
- jest 1361 pass / 0 fail (no test-case change — only mock declarations removed).
- Coverage: Lines 86.88% (≥83), Branches 78.19% (≥71), JEST_EXIT=0.
- Residual-reference grep sweep (adsense/adsbygoogle/googlesyndication/pagead/doubleclick/AD_SLOTS/AdBanner/ad-container): 0 in source.

### CI
- PR #311 all jobs green.

## Result

- **Merge**: origin/main `838e51c` → `464836f` (PR #311 squash merge, working branch deleted).
- **Net change**: 26 files +9/-258 (3 files fully deleted).

## New patterns

- **Feature removal = tentacle tracing**: to delete a feature you must trace every layer it reaches (env, CSP, generated files, i18n, legal text, infra manifests), not just the component. Following the code import graph alone misses non-import references like CSP·legal·env — a grep sweep that includes infra/messages/docs is essential.
- **Update legal/policy text alongside feature removal**: removing a user-facing feature requires updating the privacy policy/terms that described it to stay accurate. Bundle code removal and policy removal into one PR.
- **An empty conditional UI is worse than no UI**: a UI that leaves an empty box on ad-load failure hurts UX more than having no area at all. Don't leave externally-dependent content areas empty when the content never arrives — remove them.

## Lessons

- **"Deleting code" was actually infrastructure removal**: it looked like deleting a single component, but startup exploration revealed infrastructure spanning 26 files across 9 pages·layout·CSP (2 spots)·env·legal (5 spots)·generated files. Removal work needs full data-flow/config-flow tracing just as much as additive work.
- **Dead permissions are security debt**: leaving ad domains open in CSP while serving no ads was an unnecessary attack surface. Feature removal is an opportunity to shrink permissions (reduce attack surface).

## Carryover (Sprint 180+)

- **User-driven UAT**: confirm empty ad areas gone from each page's bottom/sidebar / confirm AdSense wording removed from the privacy page / `/en` legal page consistency + Sprint 160–178 accumulation.
- Other follow-ups (inherited from sprint-178 §carryover): remove coverage-gate skipped allowance, post-merge pre-deploy gate, prom-client check automation, `.claude-tools/` Phase 2 deletion, `(adr)` layout split, Programmers URL auto category inference, backfill of existing SQL problem data, etc.
