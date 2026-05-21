---
sprint: 194
title: "Redis Stats Cache — Dashboard Direct DB Aggregation → Cache"
date: "2026-05-22"
status: completed
agents: [Oracle, Architect, Conductor, Critic]
related_adrs: []
related_memory: ["sprint-window"]
topics: ["data", "operations"]
tldr: "Convert the Submission service's getStudyStats() dashboard stats query from per-request 9~12 GROUP BY/COUNT/DISTINCT aggregations to a Redis Cache-Aside. New global CacheModule (REDIS_CLIENT) + StatsCacheService (get/set/SCAN invalidation/Fail-Open), cache key stats:{studyId}:w={week}:u={user}:p={SHA256 fingerprint}, TTL 300s safety net + event invalidation (create/updateAiResult + 3 Saga DONE paths). Critic 3 rounds resolved all 3 P2s (activeProblemIds fingerprint, empty-array guard, Saga external DONE paths); CI 1st failure (no-explicit-any) → resolved by extracting StudyStatsResult type. tsc 0, jest 376 pass, CI #341 36 pass / 0 fail, Critic final 0 findings."
---
# Sprint 194 — Redis Stats Cache (Dashboard Direct DB Aggregation → Cache)

## Goal

- Convert the Submission service's `getStudyStats()` dashboard stats query to a **Redis Cache-Aside**.
- Reduce the structure where 9~12 GROUP BY/COUNT/DISTINCT aggregations ran on every request to 0 queries on a cache hit.
- Clearly define the cache-miss/invalidation policy and guarantee dashboard freshness right after a submission (minimal staleness).

## Background

- The stats requested by the dashboard (`/dashboard`) and Analytics pages flow as Gateway `GET /api/studies/:id/stats` → Submission `GET /internal/stats/:studyId` → `submission.service.ts getStudyStats()`. With no cache, every request ran 9~12 aggregation queries.
- The Redis infrastructure was already complete (ioredis 5.10.1, `infra/k3s/redis.yaml`, `docker-compose.dev.yml`, `REDIS_URL`). The Problem service already operated a global `cache.module.ts` (REDIS_CLIENT) + `deadline-cache.service.ts` (Cache-Aside + Fail-Open) pattern.
- However, **the Submission service had no global Redis module** — `study-member.guard.ts` only held a standalone instance via `new Redis()`. A new Submission-wide global cache module was required.

## Decision

### D1. Invalidation strategy — TTL + event invalidation (user)

- Confirmed via AskUserQuestion. **TTL (300s safety net) + event invalidation**. On submission create / analysis completion / Saga DONE transition, the matching `studyId` stats cache is deleted immediately → guarantees "what I just submitted shows on the dashboard immediately." TTL is a safety net for any missed path.
- The alternative (short TTL-only) can be stale up to the TTL — rejected as a UX weakness.

### D2. Cache key granularity — single key + parameter reflection (user)

- Confirmed via AskUserQuestion. Cache the entire response under a single key while reflecting the `weekNumber`/`userId` parameters in the key. Invalidation deletes all combinations at once via a `stats:{studyId}:*` SCAN pattern.
- Key format: `stats:{studyId}:w={weekNumber|'-'}:u={userId|'-'}:p={fingerprint|'-'}`.

### D3. Include activeProblemIds fingerprint (Critic R1 P2)

- The initial design treated `activeProblemIds` as "deterministic at a point in time, so exclude from key," but Critic flagged a correctness defect: if a result filtered by `activeProblemIds` is not reflected in the key, a request with a different active set (or unfiltered) can receive the wrong cache (during the TTL). → Resolved by including a **sorted SHA-256 first-8-chars fingerprint** in the key. Same fingerprint guaranteed regardless of order.

### D4. Move the empty-array fast-path before cache lookup (Critic R2 P2)

- If `activeProblemIds` is an empty array ([]), `buildProblemFingerprint([])` returns `-` → collides with the unfiltered key. The empty array is the "no ACTIVE problems → empty result" fast-path, so it is moved **before the cache lookup** to eliminate the collision at the source.

### D5. Invalidate on Saga external DONE transitions too (Critic R2 P2)

- Stats derived from `saga_step='DONE'` (uniqueAnalyzed, doneCount, analyzedCount, etc.) are also changed outside `SubmissionService`, in `SagaOrchestratorService`. Added `statsCache.invalidate(studyId)` to the 3 paths: AI quota-exceeded DONE direct, TOKEN_INVALID DONE, and compensateAiFailed DONE (paths without studyId fetch it via `findOne(select: ['studyId'])`).

## Implementation

### Implementation commits (4 commits, PR #341 squash → `91f50b3`)

- `d028e78` feat(submission) — base Redis stats cache implementation (7 files)
  - New: `cache/cache.module.ts` (REDIS_CLIENT @Global, ConfigService REDIS_URL, retry/error handling) · `cache/stats-cache.service.ts` (get/set JSON+EX 300/invalidate SCAN+DEL/Fail-Open) · `cache/stats-cache.service.spec.ts`
  - Modified: `app.module.ts` (CacheModule import) · `submission.service.ts` (StatsCacheService injection + cache-aside + create/updateAiResult invalidate) · `submission.service.spec.ts` · `ai-satisfaction.spec.ts` (DI mock)
- `dc41511` fix(submission) — include activeProblemIds fingerprint in the cache key (Critic R1 P2). `createHash('sha256')` import, `buildProblemFingerprint()` helper, get/set signature extension + test reinforcement.
- `23bd5ce` fix(submission) — move empty-array guard before cache + SagaOrchestrator 3-path invalidation (Critic R2 P2 ×2). Inject StatsCacheService into saga-orchestrator.service.ts/spec.ts.
- `[CI fix]` fix(submission) — extract `getStudyStats` inline return type into a `StudyStatsResult` interface, replace the cache-hit return's `as any` with `as StudyStatsResult` (resolves `@typescript-eslint/no-explicit-any`).

## Verification

- **Type/build**: `tsc --noEmit` 0 errors. `eslint src` **0 errors** (the remaining 9 are pre-existing warnings, unrelated to this change).
- **Tests**: jest **376 passed / 0 failed** (23 suites). Coverage threshold passed (statements 98.40%, branches 94.40%, functions 96.22%). StatsCacheService 14 (hit/miss/set/SCAN invalidation/Fail-Open/fingerprint), SubmissionService cache-aside 3, SagaOrchestrator 47 (StatsCacheService mock injected).
- **CI 1st failure → resolved**: `Quality — submission` failed with `submission.service.ts:328 Unexpected any`. Root cause: local verification ran only `tsc` and skipped ESLint. Fixed by extracting the `StudyStatsResult` type → 2nd CI.
- **Critic**: `codex review --base main` (gpt-5.5) **3 rounds**. R1 P2 1 (activeProblemIds fingerprint), R2 P2 2 (empty-array guard, Saga external DONE paths) → all applied. **Final 0 findings** ("the added invalidation/cache-aside paths appear consistent with the existing stats logic. I did not identify any discrete correctness, security, or performance regression").
- **CI #341 (2nd)**: **Passed 36 / Failed 0** — Quality submission, Coverage Gate, Build Submission, E2E Programmers, Trivy all pass.

## Lessons / Patterns

- ① **A cache key must reflect every input that determines the result** — the 4th input of `getStudyStats(studyId, weekNumber, userId, activeProblemIds)` was excluded from the key as "deterministic at a point in time," and Critic caught the correctness defect. Array inputs are included stably via a **sorted hash fingerprint**, and the empty array is pulled before the cache as a fast-path to prevent key collisions. "Missing cache key = silent wrong response," so suspect missing inputs to the end.
- ② **Derived-data invalidation must trace every code path that changes that data** — stats derived from `saga_step='DONE'` are changed not only in `SubmissionService` but also in the compensation/skip paths of `SagaOrchestratorService`. Invalidating only the "primary change point" leaves staleness during the TTL on external transition paths. Critic pointed out the external paths, adding invalidation to 3 paths.
- ③ **The local quality gate must match CI — tsc alone is insufficient** — `as any` passes `tsc` but is blocked by ESLint `no-explicit-any`. Local verification before commit must **include ESLint** (specified in the CLAUDE.md quality gate) to prevent a 1st CI failure. This time it was missed → CI failure → re-fix as learning.

## New Patterns

- **Array inputs become cache keys via sort + hash fingerprint** — guarantees the same key regardless of order + fixed key length. The empty array is separated into its own fast-path.
- **Derived stats invalidation = exhaustively trace changing code paths** — invalidate at every state-transition point of the primary service + orchestrator. Paths without studyId are supplemented by a minimal select query (the added SELECT cost is negligible since they are failure/exception paths).
- **Submission global CacheModule** — borrow the Problem service pattern (REDIS_CLIENT @Global + Fail-Open) to ensure cross-service cache infrastructure consistency.

## Carryover

- (Optional carryover) **Raise CI PYTHON_VERSION 3.12 → 3.13** (align with Dockerfile 3.13) — separated in Sprint 192/193, to be reviewed in a dedicated sprint.
- (Follow-up) Redis stats cache → **done** (this sprint).
- Cumulative UAT (user directly): Programmers re-submission grading / English production Grafana CB dashboard / Sprint 160~194 cumulative.
