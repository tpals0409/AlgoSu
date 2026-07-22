---
sprint: 255
title: "Recommendation Loading Recovery + Platform Toggle Scoping — Deployment Gap Diagnosis and platform Filter"
date: "2026-07-22"
status: completed
agents: [Oracle]
related_adrs: ["sprint-254", "sprint-251"]
related_memory: ["sprint-window"]
topics: ["frontend", "problem", "recommendation", "deployment", "security", "ci"]
tldr: "The Sprint 254 recommendation feature showed a 'cannot load recommendations' symptom in production. Diagnosis found it was not a code bug but a deployment gap — after PR #479 merged, only the `Trivy Scan — problem` job failed on main CI, so the service-scoped fail-closed gate skipped the GitOps tag update for problem-service, pinning the deployed image to an old version (`ee4d4fe`) that lacked the `/recommendations` route. PR #481 `c889092` resolved the transitive CVEs (brace-expansion, js-yaml) via overrides → unblocked the gate → redeploy restored the route. Then feature improvement PR #482 `e14e8c6` scoped recommendations to the problem-add modal's platform toggle (BOJ/Programmers) so only the selected platform's problems appear (BE `platform` parameter for cross-study DB filter + Tier3 seed filter, new BOJ cold-start seeds, FE hook refetch on tab switch). Critic (Codex gpt-5.5, foreground) resolved a P2 tab-switch race with an epoch pattern (`86b041d`)."
---
# Sprint 255 — Recommendation Loading Recovery + Platform Toggle Scoping

_Date: 2026-07-22_

## Goal

Recover the recommendation feature added in Sprint 254 after a report that **recommendations could not be loaded in production**. Then improve the previously platform-mixed recommendation exposure by **scoping it to the problem-add modal's platform toggle (BOJ/Programmers)** so only the selected platform's problems are suggested.

**Background / Constraints**: Reproduced against the actual deployment URL (`https://algo-su.com`). The source-code path (FE hook → gateway → controller route priority → service Tier3 seed fallback) had no defect under static analysis → hypothesis set the cause as a runtime/deployment gap rather than code.

## Decisions

### D1. Root cause = deployment gap (not a code bug)

Confirmed with physical evidence from CI logs. After PR #479 (`4b60583`) merged, **only the `Trivy Scan — problem` job failed** on main CI, and the deploy job's **service-scoped fail-closed gate** skipped the GitOps image-tag update for the Trivy-failed service (log: `⚠ algosu-problem SKIPPED (Trivy status: fail — service-scoped security gate)`). As a result, the deployed problem-service stayed pinned to the old `ee4d4fe` (Sprint 251) → the `/recommendations` route was absent → the new FE called a nonexistent route and failed. The frontend deployed normally, producing a new/old mismatch.

- The `main-4b60583` problem image **built and pushed to GHCR successfully** (only the tag update was skipped) — the image itself exists.

### D2. Recovery = unblock the gate by resolving transitive CVEs (Option A)

The Trivy failure cause was two **newly-published transitive-dependency HIGH CVEs** in problem-service (feature-unrelated drift):
- `brace-expansion` → CVE-2026-13149 (DoS)
- `js-yaml` → CVE-2026-59869 (DoS)

Instead of a temporary `.trivyignore` entry (Option B, fast but defers the DoS), we adopted **pinning patched versions via `services/problem/package.json` overrides** (Option A, real security fix + unblock at once) — service-stability-first. Same pattern as the existing multer·tmp·ajv overrides:
- `brace-expansion@>=3.0.0 <=5.0.6` → `5.0.7`, `brace-expansion@<=1.1.15` → `1.1.16`
- `js-yaml@>=4.0.0 <=4.2.0` → `4.3.0`, `js-yaml@<=3.14.2` → `3.15.0`

PR #481 `c889092` merged → CI green → Trivy problem passed → GitOps tag updated → problem-service redeployed → recommendation route restored.

### D3. Scope recommendations to the platform toggle (feature improvement)

The problem-add modal has a platform toggle, but recommendations ignored it and mixed all platforms. Scope recommendations to the toggle so only the selected platform is suggested:
- **BE**: Add a `platform` parameter to `RecommendQueryDto` → controller → delegate to `recommendForStudy`. Apply a **conditional `sourcePlatform` filter** in the DB `where` of the cross-study candidate query (`findRecommendationCandidates`), and filter the Tier3 seed fallback by platform too. **When unspecified, expose all** (backward compatible).
- **Cold start**: Add a **BOJ representative-problem seed set** (`recommendation-seeds.ts`). Do not assert precise solved.ac tiers — use `level=null`, difficulty macro-category only.
- **FE**: The `use-problem-recommendation` hook takes a `platform` option and **refetches on tab switch** (resetting exposure history). `SearchStep` injects the current tab's platform.

PR #482 `e14e8c6` merged.

### D4. Critic gate = foreground blocking execution (avoiding ACP reap)

The background PTY-wrapper approach was **reaped twice in a row** in this ACP environment (SIGKILL without a verdict, no `.done` marker created). Rather than a third identical retry, switched to **foreground blocking execution** (macOS `script` PTY emulation, base `c889092`, `-c model="gpt-5.5"` pin) → completed without a reap. Verdict: **1 P2** (a race where, if a tab switch occurs while a previous platform query is in-flight, the `loadingRef` guard drops the refetch so the stale-platform response overwrites the screen). Resolved with an **epoch-ref-based stale-discard pattern** + a regression test (`86b041d`).

## Completed Items

- **PR #481 `c889092`** — problem-service Trivy HIGH CVE override resolution (completed first by a parallel Oracle session). Unblocked the deployment gap.
- **PR #482 `e14e8c6`** — recommendation platform-toggle scoping
  - BE(`services/problem`): `RecommendQueryDto.platform` + controller delegation + `recommendForStudy` platform filter + `findRecommendationCandidates` conditional `sourcePlatform` where + new BOJ seeds in `recommendation-seeds.ts`
  - FE: `use-problem-recommendation.ts` (platform option + refetch on tab switch + epoch stale discard), `SearchStep.tsx` current-tab platform injection

**Verification (Oracle direct re-check — distrust self-reports)**: problem BE tsc (feature clean)·ESLint 0·jest 252 pass. FE tsc 0·ESLint 0·jest 98 pass, recommendation hook 14/14 (including the new race regression test).

**Critic (Codex gpt-5.5, base `c889092`, foreground)**: 1 P2 → resolved with the epoch pattern (`86b041d`). Re-check closed on green local gates.

## Incidents

1. **Deployment-gap misdiagnosis risk**: "the code is fine but recommendations don't show" was easy to misread as a code defect from static analysis alone. Reproducing against the live deployment URL + tracing CI-log physical evidence (per-job results, GitOps tags) pinned down the problem-service old-version freeze.
2. **Critic ACP reap twice in a row**: the background PTY wrapper lost the verdict to SIGKILL at session boundaries repeatedly (isomorphic to Sprint 254). Solved with foreground blocking execution.
3. **Parallel Oracle session first (recovery part)**: just before starting Option A, a parallel session had already completed and merged the same overrides / PR #481 → switched from rebuild to CI/redeploy verification.

## Carry-over

- [ ] GA4 admin Enhanced Measurement OFF / production UAT / data-stream URL alignment (user-direct)
- [ ] Server redeploy + live SEO verification (ops, Sprint 212/213 output)
- [ ] Harness checkup `--full` CI periodic-run automation (cron monthly) review (Sprint 209 follow-up)
- [ ] Re-review actual representativeness of the BOJ recommendation seed list (drafted by Oracle judgment — replaceable)

## Lessons

- **A service-scoped fail-closed Trivy gate blocks that service's deployment even on feature-unrelated transitive-CVE drift**: even when code is merged to main, a "deployment gap" leaves it absent at runtime. Verifying a new feature's deployment must check not just CI green but **the GitOps image-tag update** as well.
- **"Code is fine" ≠ "feature works"**: even with clean static analysis, suspect deployment-pipeline/image-version gaps and verify with live-URL reproduction + per-job CI logs.
- **When Critic ACP background reap recurs, foreground blocking execution is the reliable closure path**: it guarantees a recorded verdict (accepting minutes-to-tens-of-minutes of blocking).
- **Display-platform-scoped UX must discard stale responses via an epoch guard on cancel/refetch**: an in-flight guard alone can let a late-arriving stale-platform response overwrite the screen.
