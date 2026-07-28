---
sprint: 256
title: "Recommendation Difficulty Selection + Trivy HIGH CVE Resolution"
date: "2026-07-22"
status: completed
agents: [Oracle]
related_adrs: ["sprint-255", "sprint-254"]
related_memory: ["sprint-window"]
topics: ["frontend", "problem", "recommendation", "security", "ci"]
tldr: "Following Sprint 255's platform-toggle-scoped recommendations, this adds a path for users to directly select the recommendation difficulty. Previously difficulty was only inferred from the study's own problems; now it can be explicitly chosen — BE `RecommendQueryDto.difficulty` (@IsIn Difficulty 6 tiers) parameter + `recommendForStudy` ignoring inference when selected and filtering cross-study candidates + Tier3 seed by that difficulty, while preserving the existing inference contract when unspecified (backward compatible). FE adds difficulty selection chips (auto + Bronze/Silver/Gold) to the recommendation section, exposing only the 3 seed-covered tiers to prevent empty recommendations, toggling back to auto on re-click, and using `platform+difficulty` as the hook reset key. Then the transitive-CVE-drift-failing `Trivy Scan — frontend` was cleared via sharp `^0.35.3`/fast-uri `^3.1.4` overrides to unblock the deploy gate (orthogonal to feature code). PR #484 `3f6212c2` (BE 266 pass, cov 99.2%/97.3%) + PR #485 `bf006748` (tsc clean, jest 1812, next build exit 0)."
---
# Sprint 256 — Recommendation Difficulty Selection + Trivy HIGH CVE Resolution

_Date: 2026-07-22_

## Goal

Following Sprint 255, which scoped recommendations to the problem-add modal's platform toggle, allow users to **directly select the recommendation difficulty**. Previously recommendations only inferred difficulty from the study's own problems, so add an explicit-selection path. Also clear the frontend Trivy gate that failed on transitive-dependency CVE drift, preventing a deployment gap (isomorphic to Sprint 255 D1).

**Targets**
- PR #484 `3f6212c2` — `services/problem` BE + `frontend` difficulty selection feature
- PR #485 `bf006748` — `frontend/package.json` overrides resolving Trivy HIGH CVEs

**Constraint**: When difficulty is unspecified, the existing inference contract must not break (backward compatible). Exposed chips must show only actually-servable (seed-covered) tiers so no empty recommendations are produced.

## Decisions

### D1. Coexist explicit selection with inference (backward compatible) (#484)

Add a `difficulty?` parameter to `RecommendQueryDto` (validated via @IsIn against the 6-tier Difficulty enum), delegated by the controller to `recommendForStudy`. When set, `recommendForStudy` **ignores study inference** and filters cross-study candidates + Tier3 seed fallback by that difficulty. When unspecified, **the existing inference contract is preserved**, guaranteeing backward compatibility. The new parameter is a pure extension with no impact on existing callers.

### D2. Limit exposed chips to the 3 seed-covered tiers, re-click auto-toggle (#484)

The FE recommendation section adds difficulty selection chips (auto + Bronze/Silver/Gold). Since the static seed at this point covers only 3 tiers, **only those 3 tiers are exposed to prevent empty recommendations** (higher-tier expansion deferred to Sprint 258). Re-clicking the same chip toggles back to auto (inference) mode. The hook uses `platform+difficulty` as its reset key so exposure history resets/refetches on combination change.

### D3. Resolve transitive CVEs via overrides (real fix, gate unblock) (#485)

The frontend `Trivy Scan — frontend` job failed on **feature-unrelated transitive CVE drift**:
- next's nested `sharp@0.34.5` → GHSA-f88m-g3jw-g9cj (libvips, fixed in 0.35.0)
- ajv's transitive `fast-uri@3.1.2` → CVE-2026-13676/16221 (fixed in 3.1.4)

Instead of `.trivyignore` suppression, force `sharp ^0.35.3` / `fast-uri ^3.1.4` via `frontend/package.json` overrides (real security fix + unblock simultaneously). This preemptively applies the Sprint 255 D1 lesson (service-scoped fail-closed gates block deploys even on transitive CVE drift) and is an orthogonal change unrelated to the difficulty feature.

## Implementation

- **#484**:
  - BE (`services/problem`): `recommend-query.dto.ts` `difficulty?` (@IsIn 6 tiers) + `problem.controller.ts` one-line delegation + `problem.service.ts` `recommendForStudy` difficulty filter (cross-study + Tier3 seed)
  - FE: `problem.ts` `getRecommendations`/`buildRecommendationQuery` difficulty serialization, `use-problem-recommendation.ts` difficulty option + `platform+difficulty` reset key, `SearchStep.tsx` difficulty chips (auto + 3 tiers, re-click toggle), `messages/{ko,en}/problems.json` `difficultyAria`/`difficultyAuto` keys
- **#485**: `frontend/package.json` overrides `sharp ^0.35.3` / `fast-uri ^3.1.4` (+ regenerated `package-lock.json`)

**Verification (Oracle re-verified directly — distrust self-reports)**: #484 BE 266 pass (coverage 99.2%/97.3%), FE suites (DTO 6 tiers + invalid, service select/new-study/seed-filter/backward-compat, controller passthrough, hook forward/reset, SearchStep chip render/refetch/toggle, api query serialization) green. #485 tsc clean, jest 1812 pass, next build exit 0. Both PRs merged to origin/main (squash).

## Incidents

1. **Gate failure from transitive CVE drift**: sharp/fast-uri transitive CVEs unrelated to the difficulty feature were newly disclosed and blocked the frontend Trivy gate. Isomorphic to the deployment gap problem-service hit in Sprint 255 — resolved immediately with a real overrides fix to prevent the gap.
2. **Empty-recommendation risk**: exposing all 6 tiers as chips could produce empty recommendations for seed-uncovered higher tiers, so a conservative decision exposed only the 3 covered tiers (full-tier expansion split off to Sprint 258).

## Carryover

- [ ] Branch recommendation difficulty chips into platform-native labels (BOJ tier / Programmers Lv) — Sprint 257
- [ ] Expand difficulty chips from 3 seed tiers to platform-native full tiers — Sprint 258
- [ ] Re-examine the actual representativeness of the BOJ recommendation seed list (ongoing from Sprint 255)

## Lessons

- **Design new parameters as pure extensions that preserve the existing contract when unspecified.** The "difficulty unspecified = existing inference" backward-compatibility rule keeps existing callers intact.
- **Constrain UI options to the actually-servable range** to prevent empty results at the source. If the seed covers 3 tiers, expose 3 tiers, and split expansion to when data is ready (Sprint 258).
- **Transitive CVE drift blocks deploy gates independently of feature PRs**: per the Sprint 255 deployment-gap lesson, unblock immediately with a real overrides fix, not `.trivyignore` suppression.
