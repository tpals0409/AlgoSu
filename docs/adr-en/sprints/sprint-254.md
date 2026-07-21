---
sprint: 254
title: "Problem Add [Recommendation] Feature — Internal-Pool P2 Hybrid Recommendation + Refresh Rotation"
date: "2026-07-21"
status: completed
agents: [Oracle, Curator]
related_adrs: ["sprint-248", "sprint-249"]
related_memory: ["sprint-window"]
topics: ["frontend", "problem", "recommendation", "ux"]
tldr: "Added a [Recommendation] problem suggestion to the search step of the add-problem modal. To handle cold start (few real users), adopted a P2 hybrid: internal problem-pool 3-tier matching (difficulty+tags → difficulty-only → seed fallback) with server bundle prefetch (8) + client-side [Refresh] rotation. Shows 1 by default. PR #479 `4b60583` (squash), 23 files +1729/−16. All 3 Critic rounds of findings (P2·P2·P3) fixed; the final round lost its verdict to an ACP turn-reap → local verdict adopted (all findings closed). A parallel Oracle session had already completed the full pipeline, so Oracle switched to independent verification→Critic→merge without rebuilding."
---
# Sprint 254 — Problem Add [Recommendation] Feature

_Date: 2026-07-21_

## Goal

Add a **recommended-problem suggestion** to the search step of the add-problem modal (a `search → confirm` 2-step flow). Suggest difficulty/tag-based candidates so users quickly find problems suited to their study.

**Background / constraint**: AlgoSu has few real users, so the internal problem pool is thin (cold start). There is also no official recommendation API from external platforms (Programmers/BOJ) → empty/sparse recommendations are a UX risk.

## Decisions

### D1. Recommendation source = internal problem pool (P2), no external API dependency

Suggest, among already-registered problems from other studies/weeks, those not present in this study and matching its difficulty/tags. The Problem entity's `difficulty·level·tags·category` provide the criteria data. Stable — no external crawling / solved.ac workaround.

### D2. Cold-start fallback = 3-tier graceful degradation

`recommendForStudy` (`services/problem/src/problem/problem.service.ts`):
1. Tier 1 — internal problems matching the difficulty band + tags
2. If insufficient — drop the tag condition, match **difficulty band only**
3. If still insufficient — fall back to a curated **seed list** (`recommendation-seeds.ts`, representative problems per difficulty, static constants)

The seed fallback means zero external-API dependency and no "empty screen" even with few users. As the pool grows, tiers 1·2 naturally dominate → the structure isn't wasted by building it now.

### D3. Show 1 + [Refresh] rotation, hybrid prefetch

- Show only **1** recommendation by default (strongest for cold start — only one candidate needed).
- **[Refresh]** rotates to the next candidate. Hybrid: on modal open, fetch a **bundle (8)** of candidates once from the server (`use-problem-recommendation.ts`) → refresh is client-side rotation (instant, 0 queries); when the bundle is exhausted, re-fetch the next bundle. Removes the downsides of pure per-refresh queries (latency) and pure single-bundle (only repeats after exhaustion).

### D4. Security — cross-study candidate scoping

Internal candidate query (`findRecommendationCandidates`): a `select` whitelist excludes `description` (prevents problem-body leakage, aligning with the Sprint 252 policy), `studyId: Not(excludeStudyId)` excludes the own study, and `In([])` full-scan is guarded. The exclude (already-seen) list is capped by `@ArrayMaxSize(100)` (`RecommendQueryDto`).

## Completed Items

- PR #479 `4b60583` (squash), 23 files +1729/−16
  - BE (`services/problem`): recommend endpoint (`GET /recommendations`, `RecommendQueryDto`) + `recommendForStudy` 3-tier + `recommendation-seeds.ts` + dual-write update
  - FE: `use-problem-recommendation.ts` (prefetch-8 rotation + shownUrls capping), `SearchStep.tsx` recommendation section, `ConfirmStep.tsx` platform alignment, `problem-search.utils.ts`, i18n ko/en

**Verification (Oracle direct re-check — distrust self-reports)**: BE tsc (feature clean)·ESLint 0·jest 19 suites/245 pass (`problem.service.ts` 99.05%/97.97%, seeds 100%, controller 100%). FE tsc 0·lint Errors 0·jest 6 suites/95 pass.

**Critic (Codex gpt-5.5, base `9c5d188`)**: all 3 rounds of findings fixed — re-delegation to Curator per the rule.
- R1 [P2] `SearchStep.tsx` — on recommendation select, the source platform followed the current tab → fixed to follow the recommendation data (`d2345c6`)
- R2 [P2] `use-problem-recommendation.ts` — `shownUrls` grew unbounded on repeated refresh → capped below the backend limit (100) (`e25ef1b`)
- R3 [P3] `ConfirmStep.tsx` — confirm display followed the tab (ignoring the recommendation platform) → render by `effectivePlatform`, the actual platform (`ecf19b1`)
- R4 final — verdict not emitted due to ACP turn-reap → **local verdict adopted** (all prior findings closed, diff identical)

## Incidents

1. **Parallel Oracle session finished first**: while Oracle was assembling the delegation context, a parallel session had already completed the full pipeline (2 commits → push → PR #479), exactly matching the confirmed spec (P2 3-tier·seed·prefetch 8·rotation) → Oracle switched to **independent verification→Critic→merge** without a blind rebuild.
2. **Repeated Critic ACP turn-reap**: both `run_in_background` and fully-detached `nohup` were SIGKILLed at session boundaries → unstable verdict success (3 of 4 rounds emitted a verdict, 1 lost). The watchdog's "abnormal termination detected" alert must be distinguished from a completion alert.
3. **Trivy Scan — problem FAILURE**: `brace-expansion`·`js-yaml` HIGH DoS transitive-dependency CVEs — unrelated to this feature (not in the diff), drift also present on main. Non-required gate, so mergeable; bump planned as a separate PR.

## Backlog

- [ ] Bump Trivy transitive-dependency CVEs (`brace-expansion`·`js-yaml`) — feature-unrelated, separate PR (not mixed into the feature)
- [ ] GA4 admin Enhanced Measurement OFF / production UAT / data stream URL alignment (user-direct)
- [ ] Server redeploy + live SEO verification (ops, Sprint 212/213 deliverables)
- [ ] Harness checkup `--full` CI scheduled automation (monthly cron) review (Sprint 209 follow-up)

## Lessons

- **When a parallel Oracle session may exist, check `git`·`gh pr list` before committing/PR-ing**: a parallel session can finish and PR first. Prevents blind rebuilds / duplicate PRs — on discovery, switch to independent verification→merge instead of rebuilding.
- **Critic ACP background reap is unsolved even with full detachment**: on repeated verdict loss, if prior-round findings are all fixed and verified (green) and the diff is identical, **adopting the local verdict** is a valid closure path. Read watchdog alerts distinguishing "complete (exit 0)" from "abnormal termination".
- **Display platform ≠ create-payload platform**: for UX where the source may differ from the current tab (like recommendations), platform must be applied consistently by the **data**, not the tab (tab-based render/save causes mismatch) — 2 of the 3 Critic rounds were the same platform-alignment issue.
