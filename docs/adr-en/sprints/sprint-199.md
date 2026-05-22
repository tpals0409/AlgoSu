---
sprint: 199
title: "app.module Lifecycle (.init) Bootstrap Smoke Expansion (4 NestJS services)"
date: "2026-05-22"
status: completed
agents: [Oracle, Conductor, Critic]
related_adrs: []
related_memory: ["sprint-window"]
topics: ["testing", "dependency-injection", "lifecycle"]
tldr: "Extended Sprint 197's .compile() bootstrap smoke tests (4 NestJS services) into .init()/.close() lifecycle verification. moduleRef.init() runs onModuleInit + onApplicationBootstrap at bootstrap-equivalent level, catching lifecycle-stage throws that .compile() misses (saga onModuleInit's incompleteSubmissions.length, MqPublisher's amqplib.connect, missing env). Split into a separate spec file (app.module.init.spec.ts) — compile spec failure = DI graph / init spec failure = lifecycle, a diagnostic separation. submission blocks MqPublisher.onModuleInit via jest.mock('amqplib') + mockRepository.find→[] (avoids saga onModuleInit TypeError). Empirical finding: close() works cleanly for a single TypeORM connection (submission/identity/gateway), but problem's dual TypeOrmCoreModule (default + new-problem-db) throws in onApplicationShutdown while strict-resolving the mock DataSource — ScheduleModule cron timers are already cleaned in the earlier onModuleDestroy (detectOpenHandles 0), so only that quirk is narrowly caught while other teardown errors re-throw. forceExit exists only on submission → the other 3 require close(). A negative check (saga onModuleInit throw → compile passes / init fails) proves the lifecycle actually runs. Critic (Codex) independently reproduced the problem quirk, cross-validating the fix — Critical/High 0. tsc 0 · ESLint 0 · coverage thresholds pass (submission 381/problem 185/gateway 785/identity 265) · CI #351 FAIL 0. PR #351 squash → 4853cf2."
---
# Sprint 199 — app.module Lifecycle (.init) Bootstrap Smoke Expansion (4 NestJS services)

## Goal

- Extend Sprint 197's `.compile()` bootstrap smoke tests (which validate only DI-graph build) into `.init()/.close()`, running the **lifecycle hooks** (`onModuleInit` + `onApplicationBootstrap`) at bootstrap-equivalent level.
- Catch **lifecycle-stage throws** that `.compile()` misses (e.g. saga `onModuleInit`'s `incompleteSubmissions.length`, RabbitMQ connection, env required only during lifecycle).
- Complete the "verify up to the RabbitMQ connection step via amqplib mock" that Sprint 197 deferred to a separate scope.

## Background

- Sprint 197 validated the DI graph of 4 services (gateway·submission·problem·identity) via `Test.createTestingModule({imports:[AppModule]}).compile()`. But `.compile()` only runs graph build + `useFactory` and **does not call `onModuleInit`/`onApplicationBootstrap`** (those are `.init()`-only). Thus lifecycle-stage defects such as MqPublisher's `amqplib.connect` and saga's incomplete-Saga resumption remained undefended.
- Target lifecycle (what `.init()` additionally runs):
  - **submission**: MqPublisherService.onModuleInit (`amqplib.connect`), SagaOrchestratorService.onModuleInit (`submissionRepo.find()` then `.length` access, CircuitBreaker registration, `setInterval` timeout timer), ProblemServiceClient.onModuleInit (CB registration), MetricsService.onModuleInit (`collectDefaultMetrics`)
  - **problem**: DualWriteService/ReconciliationService.onModuleInit (`getDualWriteMode()` read), MetricsService, ScheduleModule onApplicationBootstrap (@Cron reconcile timer)
  - **gateway**: MetricsService, ScheduleModule (@Cron ×3: event-log·notification·deadline-reminder)
  - **identity**: MetricsService, ScheduleModule (@Cron ×1: feedback)
- Technical challenge: `.init()` runs lifecycle that attempts real infra connections, so RabbitMQ (amqplib) must also be mocked, and timers registered by lifecycle (@Cron, saga `setInterval`) must be cleaned via `.close()` — yet **only submission has `forceExit`**, so the other 3 hang if timers leak.

## Decision

### D1. Split into a separate spec file (user, AskUserQuestion)

- Create a **new** `src/app.module.init.spec.ts` per service. Sprint 197's `app.module.spec.ts` (`.compile()`) stays intact.
- Rationale: ① diagnostic separation — **compile spec failure = DI graph (circular dependency/missing provider)**, **init spec failure (compile passes) = lifecycle (onModuleInit/bootstrap)**. ② jest isolates the module registry per test file, structurally preventing `prom-client` global-state cross-contamination (`collectDefaultMetrics` runs once per file from fresh module state). ③ Preserves Sprint 197's fast `.compile()` regression signal as a distinct check.
- Alternatives (add an it to the existing spec / replace the existing it with `.init()`) were rejected: the former risks prom-client collision on a second instantiation in the same file, the latter loses the standalone compile-only signal.

### D2. Scope — all 4 NestJS services

- Add an init spec to all of gateway·submission·problem·identity (consistent with Sprint 197). gateway/identity `onModuleInit` is nearly trivial (`collectDefaultMetrics`), but `.init()` also runs `onApplicationBootstrap` (ScheduleModule cron registration, full module runtime wiring), which carries bootstrap-equivalent value.

### D3. amqplib mock — block submission MqPublisher.onModuleInit

- `jest.mock('amqplib')` (hoisted) provides `connect → mockConnection` (`createChannel → mockChannel`: assertExchange/assertQueue/bindQueue/publish/close, `on`) and `connection.on`. Inherits the existing `mq-publisher.service.spec.ts` mock pattern.
- Set env `RABBITMQ_URL` (satisfies `MqPublisher.onModuleInit`'s `getOrThrow('RABBITMQ_URL')`). This runs the RabbitMQ connection step ("RabbitMQ connection and Exchange/Queue setup complete" log) at bootstrap-equivalent level.

### D4. saga onModuleInit — mockRepository.find → []

- `SagaOrchestratorService.onModuleInit` reads `.length` of the result of `submissionRepo.find(...)`, so `find` must resolve an array (a bare `jest.fn()` returns `undefined` → `TypeError`). `find: jest.fn().mockResolvedValue([])` passes the "no incomplete Saga -- normal start" path.

### D5. close() teardown strategy (empirically grounded)

- **Empirical finding**: after `moduleRef.init()`, `moduleRef.close()` works **without throwing** for a single TypeORM connection (submission/identity) or no TypeORM (gateway) — CircuitBreaker/saga/mq/ScheduleModule each clean up via their onModuleDestroy. → The "close() re-resolving the overridden DataSource fails" concern Sprint 197 raised **does not materialize for a single connection**.
- **problem is the sole exception**: with dual `TypeOrmCoreModule` (default + `new-problem-db`), `onApplicationShutdown` throws `UnknownElementException` while strict-resolving the default `DataSource` via `moduleRef.get(getDataSourceToken(this.options))` (a teardown-only Nest internal quirk, harmless since it is a mock, not real infra).
- **Timer safety**: the close() sequence is `onModuleDestroy` (ScheduleModule cron timer cleanup) → `onApplicationShutdown` (where it throws). So timers are cleaned **before** the throw → verified with `--detectOpenHandles` (0 residual handles).
- **Response**: only problem's init spec uses `await moduleRef.close().catch(...)` to **narrowly ignore the known quirk (`'could not find DataSource'`)**, re-throwing any other teardown error (`throw e`) to preserve detection of future `onModuleDestroy` regressions. Adding a global `forceExit` was rejected as it affects other tests.

### D6. Services without forceExit require close()

- `forceExit:true` exists only in submission's jest.config. problem/gateway/identity hang if the @Cron timers (CronJob) registered by `.init()` leak, so they must clean up via `.close()`.

## Implementation

### Implementation commit (1 commit, PR #351 squash → `4853cf2`)

- `fd63c09` test — Add AppModule lifecycle (.init) bootstrap smoke tests ×4
  - New `services/{submission,problem,gateway,identity}/src/app.module.init.spec.ts` (+389)
  - Common: single `it`, `.compile() → moduleRef.init() → moduleRef.close()`. `init()` runs only onModuleInit + onApplicationBootstrap without an HTTP adapter.
  - submission: top-level `jest.mock('amqplib')` (connect → mockConnection/mockChannel) + `getDataSourceToken()`·`getEntityManagerToken()`·`REDIS_CLIENT` (`./cache/cache.constants`) override + `find→[]` + env `RABBITMQ_URL`
  - problem: base + `NEW_DB_CONNECTION` named DataSource/EntityManager + `REDIS_CLIENT` (`./cache/cache.module`) override + `DUAL_WRITE_MODE='off'` + narrow close() catch (D5)
  - gateway: top-level `jest.mock('ioredis')` (blocks direct `new Redis()`) + JWT/INTERNAL_KEY env + no TypeORM
  - identity: DataSource/EntityManager override + `NODE_ENV='test'` (avoids TokenEncryptionService key validation)

## Verification

- **Type/build**: `tsc --noEmit` 0 (4 services). ESLint **0** (4 services, spec override turns `no-explicit-any` off).
- **Tests**: 4 specs pass standalone + full regression. open handle/hang 0 (verified via `--detectOpenHandles` that no residual handle remains even after the problem close() quirk). Per-service coverage thresholds pass (`jest --coverage` exit 0): submission 381 / problem 185 / gateway 785 / identity 265 pass.
- **Negative check**: temporarily inserted a `throw` at the top of submission's `SagaOrchestratorService.onModuleInit` → `app.module.spec.ts` (`.compile()`) **passes** (onModuleInit not run), `app.module.init.spec.ts` (`.init()`) **fails** (`SP199_NEGATIVE_CHECK`) → proves the init spec **actually runs** the lifecycle (reverted).
- **Critic**: `codex review --base main` (Codex, session `019e4e0d-06d9-7592-b433-677efcae4b06`) — Critical/High **0** ("lifecycle smoke tests with appropriate infrastructure mocks and teardown handling. I did not identify a discrete regression introduced by the patch"). Notably, Codex **independently reproduced the problem close() quirk** with its own node script (submission/identity close cleanly, only problem throws `UnknownElementException`), cross-validating the narrow-catch fix. ✅ Mergeable.
- **CI #351**: FAIL **0** (Quality/Test/Build/Audit/Coverage Gate/E2E Programmers/Trivy all pass; skipping = unchanged areas) → Squash merge.

## Lessons / Patterns

- ① **`.init()` is a strict superset of `.compile()` (+ onModuleInit + onApplicationBootstrap)** — splitting into a separate spec file gives a diagnostic separation of "what broke" (compile failure = graph / init failure = lifecycle). jest's per-file module isolation also blocks prom-client global-state cross-contamination.
- ② **close() teardown behavior depends on connection topology** — a single TypeORM connection closes cleanly, but dual `TypeOrmCoreModule` (with a named connection) throws in `onApplicationShutdown` while strict-resolving the mock DataSource (a teardown-only Nest quirk). Since timer cleanup finishes in the earlier `onModuleDestroy`, **narrowly catch only the known quirk and re-throw the rest** to preserve detection of future teardown regressions.
- ③ **Services without `forceExit` must `close()` after `.init()` to clean timers** — `.init()` registers @Cron (CronJob) timers in `onApplicationBootstrap`, so without `forceExit` a leaked timer hangs the test. Verify residual handles 0 with `--detectOpenHandles`.
- ④ **A cross-review (Codex) independently reproduced the teardown quirk** — the Critic reproduced the same phenomenon (only problem throws on close) with its own script, validating the fix's correctness. Independent reproduction by a non-Claude model is a strong "my analysis is right" signal.

## New Patterns

- **AppModule lifecycle smoke test** — `.compile() → moduleRef.init() → moduleRef.close()`. Override infra providers (DataSource·REDIS_CLIENT), module-mock directly-`new`ed clients (gateway ioredis), `jest.mock('amqplib')` for RabbitMQ, and `find→[]` when lifecycle reads a repo. Single TypeORM uses `close()` as-is; a dual connection narrowly catches only the teardown quirk. Services without `forceExit` require close(). Coexists with Sprint 197's `.compile()` smoke as a **separate file** for diagnostic separation.
- **Negative check for lifecycle execution** — inserting a temporary `throw` in `onModuleInit` and confirming the `.compile()` spec passes while the `.init()` spec fails proves the init spec actually runs the lifecycle (the lifecycle counterpart of Sprint 197's negative check that showed the mock is load-bearing).

## Carryover Items

- **Operational Sprint 196 migration run + server redeploy** (user/ops): `npm run migration:run` on problem_db (jsonb conversion + GIN, runbook `SET statement_timeout=0`).
- (Optional) **CI PYTHON_VERSION 3.12 → 3.13** upgrade (separate sprint).
- (Optional) **Additional app.module smoke expansion** — bootstrap smoke for remaining services such as github-worker (plain Node, no app.module) / ai-analysis (FastAPI).
- Cumulative UAT (user-driven): Programmers re-submission grading / English production Grafana CB dashboard.
