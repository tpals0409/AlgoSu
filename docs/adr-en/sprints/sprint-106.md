---
sprint: 106
title: "3 Carry-Over Items Batch Processing — Coverage 70% + L2 Cache + Frontend Optimization"
period: "2026-04-21"
status: complete
start_commit: f05c3ba
end_commit: 672929d
---

# Sprint 106 — 3 Carry-Over Items Batch Processing: Coverage 70% + L2 Cache + Frontend Optimization

## Background

Sprints 102–105 completed the 4-sprint CI refactoring roadmap based on the Channeltalk reference: composite action introduction → expansion → rebuild_all operations convention → commitlint automation. Three items were deferred during that process as "decide after obtaining actual measurement data" or "scope definition needed":

1. **Coverage threshold upgrade to 70%** — deferred in Sprint 104/105 ADRs. Sprint 105 closing MEMORY.md explicitly states "Global coverage threshold 60% → 70% upgrade consideration — Sprint 106+ data-based decision."
2. **L2 cache layer** — deferred in Sprint 104/105 ADRs. Stated as "proceed after scope definition."
3. **Frontend build optimization** — deferred in Sprint 104/105 ADRs. Stated as "analyze additional room beyond Turbopack/.next/cache."

Sprint 106 batch-processes these 3 carry-over items as 3 parallel tracks ([A]/[B]/[C]). Inheriting Sprint 105's 3 operating principles (runbook immediate rehearsal, Sensei pre-consultation, ±10% practical criteria).

## Goals

| Track | Content | Status |
|-------|---------|--------|
| [A] Coverage Threshold Alignment + 70% Upgrade | Frontend branches 69.55% → 71%+ achieved, global gate 60% → 70% upgrade | ✅ Complete (PR #121–#124 merged) |
| [B] L2 Cache Layer Introduction | NestJS `dist/` + Next.js `.next/cache` GHA caching for 40% Docker build reduction target | ❌ Non-adoption decision (Sensei pre-consultation stop condition met) |
| [C] Frontend Build Optimization | Actual measurement infrastructure + 3 low-complexity improvements simultaneously | ❌ Non-adoption decision (Sensei pre-consultation all items excluded) |

---

## [A] Coverage Threshold Alignment + 70% Upgrade

### Background (Problem Definition)

After Sprint 105, the global coverage-gate was at `scripts/check-coverage.mjs coverage/ 60` (60% baseline). Each service's jest/pytest threshold already greatly exceeded 60% (Node 92–100%, Python 98%, Frontend lines 83%), creating a coherence problem where the global gate provided no real protection.

Sensei pre-consultation (task-20260421-134249) before Sprint 106 start analyzed the actual mechanism. The sole bottleneck for global 70% upgrade was confirmed to be **Frontend branches as a single axis (69.55%)**.

### Decision Basis

#### Core Mechanism — Path-filter Structure Analysis

3-stage pipeline structure confirmed by Sensei:

1. `test-node` / `test-ai-analysis` / `test-frontend` jobs each upload `coverage-{service}` artifact
2. `coverage-gate` job collects with `merge-multiple: false` → `coverage/coverage-{service}/lcov.info` hierarchy
3. `check-coverage.mjs coverage/ 60` recursively discovers and **weighted-sums** all lcov.info files, verifying lines AND branches simultaneously

**Problem path:** PR that changes only frontend code → only `coverage/coverage-frontend/lcov.info` exists → aggregate result = frontend standalone branches **69.55%** → **FAIL** with 70% gate.

By contrast, full-service weighted aggregate global branches is approximately 82%, already exceeding 70%. The paradoxical bottleneck structure: "global passes but frontend-only PRs are blocked."

#### Service-level Threshold vs Actual Values

##### Contract values (jest.config.ts / pyproject.toml)

| Service | Lines T | Branches T | Functions T | Statements T | Notes |
|---------|---------|-----------|------------|-------------|-------|
| gateway | 98 | 95 | 96 | 98 | NestJS |
| submission | 97 | 92 | 96 | 97 | NestJS (Saga) |
| problem | 98 | 96 | 98 | 98 | NestJS |
| github-worker | 98 | 92 | 100 | 98 | NestJS |
| identity | 98 | 98 | 98 | 98 | NestJS |
| ai-analysis | 98* | — | — | — | Python, lines only |
| **frontend** | **83** | **69→71** | **82** | **81** | Next.js — bottleneck → raised to 71 |

\* Python `fail_under=98` single criterion. `branch = true` not set → branches not tracked (BRF:0/BRH:0).

##### Actual values (lcov.info, Sensei aggregate)

| Service | Lines actual | Lines T | Margin | Branches actual | Branches T | Margin |
|---------|-------------|---------|--------|----------------|-----------|--------|
| gateway | 98.9% (2174/2198) | 98 | +0.9% | 95.4% (640/671) | 95 | +0.4% |
| github-worker | 100.0% (402/402) | 98 | +2.0% | 95.0% (134/141) | 92 | +3.0% |
| frontend (Before) | 83.5% (1690/2024) | 83 | +0.5% | **69.55%** (1302/1872) | 69 | +0.55% |
| frontend (After) | — | 83 | — | **76.42%** (target 71% exceeded) | 71 | +5.42% |

Full-service weighted aggregate estimate: Lines ≈94.3%, Branches ≈81.9% — 70% gate passes ✅

#### 71%+ Achievement Scenario (Sensei consultation → Architect execution)

Gap analysis from Sensei pre-consultation:

| Target | Branches hit needed | Current (Before) | Gap |
|--------|-------------------|-----------------|-----|
| 70.0% | 1311 | 1302 | +9 |
| **71.0% (contract target)** | 1330 | 1302 | **+28** |
| 72.0% (safety buffer) | 1348 | 1302 | +46 |

**Recommended scenario (3 files, 72%+ safety buffer):** `lib/feedback.ts` + `components/ui/CodeBlock.tsx` + `components/providers/EventTracker.tsx` approximately 120–190 LOC of new tests. Judged achievable within 1 sprint scope.

### Implementation Results (Architect, task-20260421-135617)

#### PR A-1 — Test Strengthening + jest threshold upgrade

- Branch: `feat/sprint-106-coverage-frontend-tests`
- PR: [#121](https://github.com/tpals0409/AlgoSu/pull/121)
- 77 new tests (3 files, 603 LOC total):

| Test file | Test count | LOC | Coverage target |
|-----------|-----------|-----|----------------|
| `frontend/src/lib/__tests__/feedback.test.ts` | 42 | 288 | Validation branches, null/empty/invalid cases |
| `frontend/src/components/ui/__tests__/CodeBlock.test.tsx` | 24 | 143 | lang prop presence/absence, copy button branch |
| `frontend/src/components/providers/__tests__/EventTracker.test.tsx` | 11 | 172 | GA environment branch (window.gtag presence/absence) |

- `frontend/jest.config.ts` branches: **69 → 71**
- Local actual: Branches **69.55% → 76.42%** (+6.87pp, +5.42pp above target 71%)
- Test Suites: 116 passed, Tests: 1231 passed / `tsc --noEmit`: PASS

#### PR A-2 — CI Gate Upgrade + Per-service Log Enhancement

- Branch: `feat/sprint-106-ci-coverage-gate-70`
- PR: [#122](https://github.com/tpals0409/AlgoSu/pull/122)
- `scripts/check-coverage.mjs`: +15 lines per-service breakdown log
- `.github/workflows/ci.yml` L521: **60 → 70**
- PR body includes Sensei warning citation ("A-1 CI green must precede")

#### PR A-3 — CLAUDE.md Coverage Specification Update (Gatekeeper)

- Content: "test coverage 60%+" → "global 70%+ / individual service-level threshold maintained"
- Status: PR created (Gatekeeper follow-up)

### Sequencing Protection

**Required PR merge order:**

```
PR A-1 (#121) → confirm CI green → merge PR A-2 (#122) → merge PR A-3 (Gatekeeper)
```

**⚠️ PR A-2 standalone merge prohibited:** With `check-coverage.mjs coverage/ 70`, if PR A-1 is absent, frontend-only PRs will cause coverage-gate to FAIL at 69.55%. PR A-1's `jest.config.ts branches: 71` change and 3 new test files must precede. Sensei warning noted in PR A-2 body.

### Track [A] Lessons Learned

1. **Sprint 105 Sensei pre-consultation pattern remains valid in Sprint 106** — Pre-consultation (sufficient N=1 judgment) confirmed no need to repeat Post measurement. 76.42% achievement vs 71% target (+5.42pp overshoot) proves the recommended 3-file scenario was conservatively designed. Post-hoc confirmation that "1 CI pass after Architect execution = optimal verification path."

2. **Global gate single number creates misunderstanding in path-filter structure** — The intuition "global 82% means global 70% achieved" is refuted in the frontend-only PR path. `check-coverage.mjs` per-service breakdown log output (PR A-2) is the key improvement that resolves this structural visibility problem. When designing path-filter-based CI, "which lcov set does coverage-gate operate on" must be specified per PR scope.

3. **Coverage is deterministic measurement — Sprint 105 ±10% practical criteria is selected based on measurement nature** — CI timing is probabilistic due to jitter, requiring Pre n=4 + Post n=3 + Welch t-test. Coverage, by contrast, is a binary gate where same code = same number. Sprint 105 Lesson 3 ("CI timing uses ±10% practical criteria") applies only to timing measurement; the principle "only consider work complete when actual measurement is done" applies equally regardless of measurement nature (deterministic/probabilistic).

---

## [B] L2 Cache Layer Introduction

> **Status: ❌ Non-adoption decision — Sensei pre-consultation (task-20260421-143704) stop condition met. Zero code changes.**

### Original Plan

GHA filesystem caching for NestJS `dist/` of 5 services (gateway, identity, submission, problem; excluding github-worker) + Next.js `.next/cache` of 2 (frontend, blog) to achieve **40% reduction** from Docker build 3–5 min. New composite action `.github/actions/cache-build-output/action.yml`, `problem` service pilot → Pre/Post measurement → full-service expansion.

### Decision: Non-adoption (stop condition met)

Sensei pre-consultation (task-20260421-143704) confirmed the approved plan's explicit stop condition ("0 benefit when Docker multi-stage internal cache and L2 GHA cache duplicate → stop") was met. **Track [B] closed early. Zero code changes. Analysis results documented in ADR, Sprint 107 seed registered.**

### 4 Structural Findings (Sensei pre-consultation report)

#### Finding 1: Docker buildkit `type=gha,mode=max` already performs L2 role

`mode=max` saves **all intermediate layers** of builder stages to GHA cache. NestJS `RUN npm run build` (= `dist/` generation) is already saved as a GHA cache layer → Adding external GHA filesystem cache is **100% duplicate**.

```
# NestJS example (problem/Dockerfile) — mode=max cache coverage
Layer 1: FROM node:22-alpine AS builder         [cached]
Layer 2: COPY package*.json ./                  [HIT if package.json unchanged]
Layer 3: RUN npm ci                             [HIT if package.json unchanged]
Layer 4: COPY . .                               [MISS on source change]
Layer 5: RUN npm run build   ← dist/ generated  [re-run if Layer 4 MISS]
```

`mode=max` **already** saves Layer 5 result (dist/) to GHA cache = L2 cache effectively already exists as Docker layers.

#### Finding 2: Frontend `.next/cache` GHA step already exists but non-functional (ci.yml L624–630)

`build-frontend` job already has `actions/cache@v5 path: frontend/.next/cache` step. However, that job has no host-side `npm run build` — only `docker/build-push-action` → `.next/cache` not generated on host → **repeated empty directory save/restore**. Judged as legacy from the host-side build era before Docker migration.

Non-functional mechanism:
1. `actions/cache restore` → restores `frontend/.next/cache` to host (if cache exists)
2. `docker/build-push-action context: ./frontend` → included in Docker context
3. `docker/build-push-action` executes → image pushed to GHCR. **Container internal `.next/cache` not exported to host**
4. `actions/cache save (post)` → saves empty directory. Same repetition on next run

#### Finding 3: Adding `.next/cache` GHA step to Blog reproduces same non-functionality

`build-blog` also has no host-side `npm run build` → same structure → non-functional even if added. Blog Dockerfile SSG `out/` build is also Docker-internal only.

#### Finding 4: All build jobs are Docker-internal only → no GHA filesystem cache utilization path at all

In the entire pipeline, **not a single job executes `npm run build` on the host filesystem**. All TypeScript/Next.js compilation occurs only inside Docker containers. GHA filesystem cache applies only to host filesystem → structurally no utilization path in the current Docker-only architecture.

### 40% Reduction Target Reassessment

| Scenario | Current time | After L2 GHA cache | Improvement |
|----------|-------------|-------------------|-------------|
| No source changes | ~30–60s (Docker HIT) | Same | **0%** |
| Source changes (typical PR) | 3–5 min (Docker MISS) | Same | **0%** |
| package.json changes | 4–6 min including npm ci | Same | **0%** |

**Conclusion:** In the current Docker build architecture (all compilation Docker-internal only), adding GHA filesystem cache cannot achieve 40% reduction. True L2 effect requires host-side build migration first.

### Track [B] Lessons Learned

1. **Sprint 105 "Sensei pre-consultation → original plan reduction" pattern hits again in Sprint 106 [B] — achieving 0 implementation lines** — In Sprint 105, pre-consultation reduced Post sample N to 1. In Sprint 106 [B], the same pattern went one step further and made the implementation itself 0 lines (100% runner-minutes savings). Reconfirmed twice that Sensei pre-consultation functions not just as a simple optimization tool but as "a gate validating whether implementation is necessary at all."

2. **Explicit stop conditions in plans ("0 benefit when duplicate") are effective safeguards** — The approved plan's risk response clause triggered accurately at pre-consultation. "Including stop conditions in plans" plays a structural role by providing judgment criteria at the Sensei pre-consultation stage. Without a stop condition, there was risk of processing pre-consultation results ambiguously as "partial application."

3. **Detection of "seemingly implemented but non-functional code"** — `ci.yml L624–630` Frontend `.next/cache` GHA step could have been recognized as "already implemented cache step" during the Explore phase, but Sensei judged it non-functional in the Docker architecture context. Code existence ≠ functional operation. Confirmed that verifying the "host-side vs Docker-internal" boundary is essential preliminary analysis when exploring CI pipelines.

### Sprint 107 Seeds — "True L2 Achievement Path"

Within the current Docker-only architecture, realizing GHA filesystem cache effectiveness requires host-side build migration. Register the following 4 items as Sprint 107 follow-up consideration items.

| Approach | Description | Expected reduction | Difficulty |
|----------|-------------|-------------------|------------|
| **Blog host-side SSG build** | CI runs `npm ci + npm run build` on host → `out/` GHA cache → Docker only `COPY out/` | 40–60% on MISS | Medium (Dockerfile + ci.yml) |
| **Frontend host-side build** | CI runs `npm ci + npm run build` on host → `.next/standalone` GHA cache → Docker COPY only | 40–60% on MISS | Medium (Dockerfile + ci.yml) |
| **`APK_CACHE_BUST` conditionalization** | Invalidate apk only when security patches needed (currently forced invalidation every run) | 20–30s/service | Low (security trade-off decision needed) |
| **NestJS tsc incremental** | Host-side build migration + `tsBuildInfoFile` utilization | 20–40% on MISS | Medium–High (major Dockerfile changes) |

---

## [C] Frontend Build Optimization

> **Status: ❌ Non-adoption decision — Sensei pre-consultation (task-20260421-150311) all items excluded. Zero code changes.**

### Original Plan

Add build step timing records (`::notice` or job summary) to `test-frontend`/`build-frontend` jobs in `.github/workflows/ci.yml` + simultaneously apply 3 low-complexity improvements to `frontend/next.config.ts`:

1. Explicit `swcMinify: true` (Next.js 14+ default, but for documentation purposes)
2. `experimental: { optimizePackageImports: ['@radix-ui/react-*', 'lucide-react'] }` — Radix-UI + lucide-react tree-shaking
3. `productionBrowserSourceMaps: false` + Sentry source-map upload only retained

### Decision: Non-adoption (Sensei pre-consultation based)

Sensei pre-consultation (task-20260421-150311) confirmed all 3 low-complexity items were inapplicable, duplicate, or already defaults in Next.js 15.5.15 actual measurement. **Track [C] closed early. Zero code changes. No Architect dispatch required.**

Same pattern as Track [B] (Docker buildkit mode=max already performing L2 role): pre-consultation → all items excluded → immediate closure.

### 4 Structural Findings (Sensei pre-consultation report)

#### Finding 1: `swcMinify` — Completely removed (HARD BLOCK)

Confirmed via grep actual measurement that `swcMinify` entry is **completely removed** from Next.js 15.5.15 `config-schema.js` and `config.js`:

```
grep -c "swcMinify" frontend/node_modules/next/dist/esm/server/config-schema.js  → 0
grep -c "swcMinify" frontend/node_modules/next/dist/esm/server/config.js         → 0
```

Schema is structured as `z.strictObject()`, causing validation error on unknown keys. Adding `swcMinify` would cause:
- TypeScript error: `Object literal may only specify known properties`
- Runtime: `z.strictObject` validation failure → build error

Verdict: **HARD BLOCK — Cannot be added even for documentation purposes.**

#### Finding 2: `optimizePackageImports` — All targets already in defaults + wildcard not supported

Direct inspection of `config.js L786–870`. Default include list already contains `lucide-react`·`recharts`. Source comment:

> `We don't support wildcard imports for these configs, e.g. react-icons/*`

| Planned item | Actual result | Verdict |
|-------------|--------------|---------|
| `@radix-ui/react-*` | Wildcard not supported. Radix UI uses individual package structure (no barrel file) | Excluded |
| `lucide-react` | Already in default include list → Set duplicate, no effect | Excluded (duplicate) |

#### Finding 3: `productionBrowserSourceMaps` — Default false

`config-schema.js L609`: `productionBrowserSourceMaps: z.boolean().optional()`. Default `false`. Current unset = already `false`.

Sentry interaction: `@sentry/nextjs` v10.47.0 webpack plugin generates → uploads → deletes source maps **independently** from `productionBrowserSourceMaps`. Setting `false` explicitly doesn't affect symbolication. No conflict.

Verdict: **Excluded — already the default. No effect from explicit setting.**

#### Finding 4: CI build timing direct measurement not possible (reconfirms Track [B] finding)

Reconfirms Track [B] Sensei analysis conclusion: `build-frontend` job is a completely Docker-only pipeline. No host-side `npm run build`. Even adding `::notice` step has no Next.js build time measurement target.

### Track [C] Lessons Learned

1. **Sensei pre-consultation triggered twice ([B] and [C] both closed early) — Sprint 105 "pre-consultation N=1 optimal" pattern evolved to "0 implementation lines conclusion"** — In Sprint 105, pre-consultation was an optimization tool to reduce Post sample N to 1. In Sprint 106 [B], the same pattern made implementation itself unnecessary; in [C], the pattern repeated. Consecutively proven twice that pre-consultation extends its functional role from "sampling optimization" to "implementation necessity gate."

2. **Library version upgrades often promote existing optimization options to defaults or remove them — Explore phase without source-level actual measurement is insufficient** — `swcMinify` was a valid option when the plan was written for Next.js 14.x but was removed from the config schema itself in 15.5.15. `optimizePackageImports` default include list also expands with each version upgrade. Proven that "official documentation or source-level (`node_modules/`) direct grep" is the only accuracy guarantee method when version upgrades occur between plan drafting and execution.

3. **Docker-only architecture blocks both L2 cache (Track [B]) and build timing measurement (Track [C]) — Whether to switch to host-side is itself the core Sprint 107+ decision** — The "all build jobs Docker-only" constraint discovered in Track [B] was reconfirmed equally in Track [C] CI timing measurement. Both deferred items stem from the same structural bottleneck. Resolving this constraint through host-side build migration is a Sprint 107+ architectural decision, not a single optimization PR.

---

## Overall Summary

The 3 carry-over items from the Sprint 102–105 CI refactoring 4-sprint roadmap were batch-processed in Sprint 106.

Of 3 tracks, **only [A] was actually implemented**; **[B]/[C] were closed with non-adoption decisions based on Sensei pre-consultation**. A mature manifestation of Sprint 105's "pre-consultation → reduce original plan" lesson. Pre-consultation proved its functional evolution from "simple sampling optimization tool" to "implementation necessity gate" twice consecutively ([B], [C]).

Results: **7 PRs total**, significant runner-minutes savings, prevented incorrect direction entry. The fundamental constraint of CI build structure (Docker-only pipeline) was reconfirmed across both L2 cache and build timing measurement items, and host-side build migration was clearly identified as the core Sprint 107+ decision task.

---

## Carried Over (Sprint 107+)

### Track [A] Follow-up

- **ai-analysis `branch = true` activation** — Add `[tool.coverage.run] branch = true` to `pyproject.toml` → enable branches axis measurement and verify 98% achievement
- **submission/problem/identity lcov local actual measurement collection** — Currently only threshold contract values, no actual margin. Obtainable via local `npm test -- --coverage --ci`
- **Per-service independent gate introduction consideration** — Structurally resolve global single gate limitations (path-filter misunderstanding structure) by configuring per-service thresholds in `check-coverage.mjs`
- **Global coverage 70% stabilization verification** — Confirm coverage-gate passes in Sprint 107's first frontend-only PR (Sprint 106 [A] completeness verification)

### Sprint 107 Seeds — Build Optimization Achievement Path ([B]+[C] integrated)

Host-side build migration is the common prerequisite for both L2 cache (Track [B]) and build timing measurement (Track [C]) deferred items.

**Architecture migration (preliminary decision needed):**

| Approach | Description | Expected effect | Difficulty |
|----------|-------------|----------------|------------|
| **Blog host-side SSG build** | CI `npm ci + npm run build` on host → `out/` GHA cache → Docker `COPY out/` only | 40–60% MISS reduction | Medium (Dockerfile + ci.yml) |
| **Frontend host-side build** | CI `npm ci + npm run build` on host → `.next/standalone` GHA cache → Docker COPY only | 40–60% MISS reduction | Medium (Dockerfile + ci.yml) |
| **`APK_CACHE_BUST` conditionalization** | Invalidate apk only when security patches needed | 20–30s/service | Low (security trade-off decision needed) |
| **NestJS tsc incremental** | Host-side build + `tsBuildInfoFile` | 20–40% MISS reduction | Medium–High (major Dockerfile changes) |

**Immediately actionable without host-side migration:**

| Approach | Description |
|----------|-------------|
| **Bundle size static analysis (Option D)** | Possible via local `next build` — independent of CI timing measurement |
| **Monaco Editor dynamic import verification** | CSP `unsafe-eval` already allowed → evaluate runtime chunk separation, FCP improvement potential |
| **`motion` (Framer Motion) `optimizePackageImports`** | Not in default include list → confirm benefit potential after host-side migration |
| **heavy deps audit (`react-dnd`, `react-slick`)** | Evaluate alternative lightweight libraries and bundle size impact |

## References

- Sprint 105 ADR: `docs/adr/sprints/sprint-105.md`
- Sprint 104 ADR: `docs/adr/sprints/sprint-104.md`
- Approved Sprint 106 execution plan: `/Users/leokim/.claude/plans/iterative-hugging-reddy.md`
- Sensei [A] pre-consultation report: `~/.claude/oracle/inbox/sensei-task-20260421-134249.md`
- Sensei [B] L2 cache pre-consultation report: `~/.claude/oracle/inbox/sensei-task-20260421-143704.md`
- Sensei [C] build optimization pre-consultation report: `~/.claude/oracle/inbox/sensei-task-20260421-150311.md`
- Architect implementation report: `~/.claude/oracle/inbox/architect-task-20260421-135617.md`
- rebuild_all runbook: `docs/runbook/ci-rebuild-all.md`
- Channeltalk CI refactoring: https://channel.io/ko/team/blog/articles/backend-ci-refactoring-73fca77d
- PR #121 (A-1 test strengthening): https://github.com/tpals0409/AlgoSu/pull/121
- PR #122 (A-2 CI gate 70%): https://github.com/tpals0409/AlgoSu/pull/122
- PR #123 (A-3 CLAUDE.md): https://github.com/tpals0409/AlgoSu/pull/123
- PR #124 (ADR [A] section): https://github.com/tpals0409/AlgoSu/pull/124
- PR #125 (ADR [B] section): https://github.com/tpals0409/AlgoSu/pull/125
- PR #126 ([B] ci.yml cleanup): https://github.com/tpals0409/AlgoSu/pull/126
