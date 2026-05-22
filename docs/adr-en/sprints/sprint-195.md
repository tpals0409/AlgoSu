---
sprint: 195
title: "submission CacheModule Circular Dependency Hotfix + StudyMemberGuard Redis Consolidation"
date: "2026-05-22"
status: completed
agents: [Oracle, Conductor, Critic]
related_adrs: []
related_memory: ["sprint-window"]
topics: ["operations"]
tldr: "The submission CacheModule added in Sprint 194 introduced a NestJS DI circular dependency (bidirectional import between cache.module.ts and stats-cache.service.ts), causing the new image to throw deterministically 26ms into bootstrap → CrashLoopBackOff → rollout blocked. Extracted the REDIS_CLIENT token into cache.constants.ts to structurally break the cycle, and added a cache.module.spec.ts regression test that compiles the real module graph (closing the gap unit tests missed). As a side cleanup, consolidated StudyMemberGuard's standalone ioredis instance into the global REDIS_CLIENT DI injection (connection pool 2→1). build 0, ESLint 0 errors, jest 379 pass, Critic (Codex gpt-5.5) 0 findings, CI #343 36 pass / 0 fail. Cluster redeploy is handled server-side."
---
# Sprint 195 — submission CacheModule Circular Dependency Hotfix + StudyMemberGuard Redis Consolidation

## Goal

- Resolve the submission-service bootstrap failure (NestJS DI circular dependency) introduced by Sprint 194 code, **removing the rollout blocker**.
- Add a **regression defense test** so the same class of bug (module graph compilation failure) is caught by CI.
- (Side cleanup) Consolidate `StudyMemberGuard`'s standalone ioredis instance into the global `REDIS_CLIENT`, reducing the connection pool 2→1.

## Background

- Sprint 194 added a global `CacheModule` (REDIS_CLIENT) + `StatsCacheService` to the Submission service (dashboard stats Cache-Aside).
- After merge the new image fell into **CrashLoopBackOff**. A server-agent diagnosis plus code cross-verification confirmed the cause: 26ms into bootstrap the process throws `A circular dependency has been detected inside CacheModule` and exits. Being deterministic, every retry fails at the exact same point.
- **No user impact**: the previous ReplicaSet (2 Pods) kept serving normally. Only the rollout was blocked, so the new feature (stats cache) was not deployed.
- **Not OOM / Redis failure**: Last State Terminated `Exit Code 1` (not 137 OOMKilled), 1Gi memory limit with headroom, init `db-migrate` Exit 0, Redis Pod up 73 days. The prior handoff's "lazy connect non-blocking" analysis was correct, but the throw occurs earlier, during the DI graph build stage.

## Decision

### D1. Scope — Hotfix + Guard Redis consolidation (user)

- Confirmed via AskUserQuestion. ① circular dependency hotfix ② consolidate `StudyMemberGuard`'s standalone ioredis into `CacheModule`'s `REDIS_CLIENT`, in one PR. The originally planned Sprint 195 work (`problem.tags` JSON migration) is **deferred to Sprint 196**.

### D2. Rollout handling — Redeploy server-side after merge (user)

- Since the previous version is serving normally, no emergency rollback is needed. Code hotfix + PR + CI green is handled in this workflow; **the cluster redeploy and CrashLoopBackOff alert clearing are handled server-side (user)**.

### D3. Cycle break — Extract token into a separate file

- Root cause: `cache.module.ts` **defines** the `REDIS_CLIENT` token (`:13`) while also **importing** `StatsCacheService` (`:11`), and `stats-cache.service.ts` **back-references** that token from `cache.module` (`:10`) → at module evaluation time `StatsCacheService` is `undefined`, so Nest throws.
- Extracted `REDIS_CLIENT` into `cache/cache.constants.ts`, with both `cache.module.ts` and `stats-cache.service.ts` importing from there → the bidirectional reference between the two files disappears. Resulting graph: module→service, module→constants, service→constants (zero cycles).

### D4. Regression defense — Real module graph compilation test

- The existing `stats-cache.service.spec.ts` did not import the real `CacheModule`; it assembled providers manually → it never compiled the DI graph that triggers the cycle, so it could not catch the throw.
- Added `cache.module.spec.ts`: `Test.createTestingModule({ imports: [LoggerModule, CacheModule] }).overrideProvider(REDIS_CLIENT).useValue(mockRedis).compile()` **compiles the real module graph** and asserts `StatsCacheService`/`REDIS_CLIENT` resolution. Before the fix it throws (fails); after, it passes → CI blocks this class of regression. (`LoggerModule` is `@Global` so it provides `StructuredLoggerService`; the REDIS_CLIENT override avoids a real Redis connection; afterEach `close()` prevents open handles.)

### D5. Guard Redis consolidation — @Inject(REDIS_CLIENT)

- Removed the `new Redis(redisUrl)` direct instantiation in the `StudyMemberGuard` constructor and injected `@Inject(REDIS_CLIENT) redis: Redis` instead. The redundant `redis.on('error')` handler is removed since the `cache.module` factory centralizes it. `ConfigService` is kept for `GATEWAY_INTERNAL_URL`/`INTERNAL_KEY_GATEWAY`. The guard is used via `@UseGuards` on the submission/review/study-note controllers — since `CacheModule` is `@Global`, `REDIS_CLIENT` resolves globally, so no provider registration change is required.

## Implementation

### Implementation commits (2 commits, PR #343 squash → `2e1502e`)

- `d050b9a` fix(submission) — resolve cache module circular dependency (token extraction) + bootstrap regression test
  - New: `cache/cache.constants.ts` (REDIS_CLIENT token) · `cache/cache.module.spec.ts` (3 DI-graph compilation regression tests)
  - Modified: `cache.module.ts` (remove local token definition → import from constants) · `stats-cache.service.ts` · `stats-cache.service.spec.ts` (import source → constants)
- `60f2e1f` refactor(submission) — consolidate StudyMemberGuard into CacheModule REDIS_CLIENT (ioredis instances 2→1)
  - Modified: `common/guards/study-member.guard.ts` (remove `new Redis()` → `@Inject(REDIS_CLIENT)`, remove redundant handler) · `study-member.guard.spec.ts` (remove `jest.mock('ioredis')` → inject DI mock)

## Verification

- **Type/build**: `tsc --noEmit` 0 errors. `npm run lint` (eslint `{src,test}/**/*.ts`) **0 errors**, 9 warnings (all pre-existing `no-unused-vars`, unrelated to this change). `mockRedis as any` is confined to a spec file — `.eslintrc.js` overrides set `no-explicit-any: 'off'` for `*.spec.ts` (different from Sprint 194's source-file `as any`).
- **Tests**: jest **379 passed / 0 failed** (24 suites). All coverage thresholds pass (statements 98%+, branches 94%+, functions 96%+). The new `cache.module.spec.ts` (3 tests) verifies real DI-graph compilation and StatsCacheService/REDIS_CLIENT resolution.
- **Critic**: `codex review --base main` (gpt-5.5) — **Critical/High/Medium/Low: 0 findings**. "The StudyMemberGuard's new shared Redis injection is backed by the global CacheModule in the application module, and the added tests cover the intended DI regression."
- **CI #343**: **36 pass / 14 skip / 0 fail** — Quality, Coverage Gate, Build Submission, Test Submission, E2E, Trivy all pass.
- **Operations**: no downtime since the previous version keeps serving. The redeploy brings up a healthy new ReplicaSet and clears CrashLoopBackOff (server-side).

## Lessons / Patterns

- ① **A unit test that does not compile the module DI graph cannot catch a circular dependency** — the manually-assembled `stats-cache.service.spec.ts` was all 14 green, yet bootstrap failed 100%. New modules must verify the graph build at least once via a real `imports: [Module]` + `.compile()` regression test, so that "tests green = bootstrap possible" actually holds.
- ② **If the file that defines a token and the file that imports it import each other, you get a cycle** — placing DI tokens/constants in a **dependency-free separate file** (`*.constants.ts`) is the standard way to structurally prevent cycles in NestJS. Module files hold provider definitions (service imports); constant files hold only tokens.
- ③ **Cross-verify the "diagnostic hypothesis" against the code to the end** — after ruling out stale-alert/OOM/Redis-failure hypotheses (Exit 1, init Exit 0, memory headroom, Redis up 73 days), the actual crash-log throw message + the bidirectional import were confirmed in code before starting the fix → avoiding wasted time on the wrong root cause.

## New Patterns

- **Place DI tokens in a dependency-free constants file** — so the module (provider definitions) and the token consumer (service) reference the same token without importing each other. The standard NestJS circular-dependency prevention.
- **New modules require a "DI graph compilation" regression test** — `Test.createTestingModule({ imports: [RealModule] }).compile()` for bootstrap-equivalent verification. A spec that only assembles providers manually cannot catch the graph-build throw. Avoid external connections (Redis, etc.) via `overrideProvider().useValue(mock)`.

## Carry-over Items

- **problem.tags JSON column migration + seed data expansion** → Sprint 196 (originally planned for 195, deferred per D1).
- (optional) **app.module bootstrap smoke test** — defends the entire DI graph in one shot (requires TypeORM/Postgres mocks, heavier than this regression test).
- (optional) **CI PYTHON_VERSION 3.12 → 3.13** bump (Dockerfile alignment) — split off in Sprints 192–194, separate sprint.
- Cumulative UAT (user-driven): Programmers re-submission grading / English production Grafana CB dashboard / Sprint 160–195 cumulative.
