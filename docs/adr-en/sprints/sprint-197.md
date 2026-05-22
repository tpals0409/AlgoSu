---
sprint: 197
title: "app.module Bootstrap Smoke Tests (4 NestJS services)"
date: "2026-05-22"
status: completed
agents: [Oracle, Conductor, Critic]
related_adrs: []
related_memory: ["sprint-window"]
topics: ["testing", "dependency-injection"]
tldr: "Extended the Sprint 195 lesson (submission CacheModule circular dependency throwing 26ms into bootstrap → CrashLoopBackOff, undetected because the 14 unit specs assembled providers manually) from a single module to the entire AppModule. Introduced Test.createTestingModule({imports:[AppModule]}).compile() bootstrap smoke tests across 4 NestJS services (gateway·submission·problem·identity) to catch DI-graph throws (circular dependencies, missing providers) at bootstrap-equivalent level. TypeORM real DB connection blocked via getDataSourceToken() override of initialize() (problem also overrides the NEW_DB_CONNECTION named connection); Redis blocked via REDIS_CLIENT override (submission/problem) and jest.mock('ioredis') for gateway (many constructors call new Redis() directly); RabbitMQ avoided by calling .compile() only (not .init()), skipping onModuleInit. Single it · zero branches · no uninvoked function literals keep coverage thresholds intact for spec-collected services (problem/identity/gateway). Negative check (empty DataSource → repo factory TypeError) proves the graph is genuinely compiled. Critic (Codex gpt-5.x) ran 2 rounds — R1 P2 (problem DUAL_WRITE_MODE env leak) resolved → clean R2. 4 specs pass standalone + full regression, tsc 0, ESLint 0, CI #347 Passed 412/Failed 0. PR #347 squash → 5d1e5fc."
---
# Sprint 197 — app.module Bootstrap Smoke Tests (4 NestJS services)

## Goal

- Introduce **bootstrap smoke tests** that compile the entire DI graph in one shot, catching Sprint 195-class circular dependency / module-graph throws at bootstrap-equivalent level.
- Extend the Sprint 195 hotfix's `cache.module.spec.ts` (single-module compile regression) pattern to the **entire AppModule**, making "tests green = bootstrap possible" hold for every NestJS service.

## Background

- In Sprint 195, new submission code threw `circular dependency inside CacheModule` 26ms into bootstrap, causing CrashLoopBackOff. Yet the 14 existing unit specs assembled providers manually (`providers:[...]`), so they never compiled the real module DI graph — bootstrap failed 100% even though "tests were green."
- The Sprint 195 hotfix added a `Test.createTestingModule({imports:[CacheModule]}).compile()` regression test, but it was **single-module scope** → other cycles/omissions in the full AppModule graph remained undefended.
- Target NestJS services: gateway·submission·problem·identity. (github-worker is plain Node.js with no `app.module`; ai-analysis is FastAPI — both excluded.)
- Technical challenge: `.compile()` runs graph build + `useFactory` (TypeORM/Throttler, etc.), so providers that attempt real infra (Postgres/Redis/RabbitMQ) connections must be blocked to validate only the DI graph without networking.

## Decision

### D1. Scope — all 4 NestJS services (user, AskUserQuestion)

- Add `src/app.module.spec.ts` to each of gateway·submission·problem·identity. Every NestJS service guarantees "tests green = bootstrap possible" → Sprint 195-class graph throws blocked across all services.

### D2. Call `.compile()` only (`.init()` out of scope)

- `.compile()` builds and instantiates the DI graph but does not call `onModuleInit`/`onApplicationBootstrap` (those are `.init()`-only). Thus MqPublisherService's `amqplib.connect` (onModuleInit) does not run → RabbitMQ connection avoided. But circular dependencies / missing providers throw during graph build (compile), so they are still caught (same rationale as the Sprint 195 cache.module.spec).
- Lifecycle-hook (onModuleInit) verification + amqplib mock are deferred to a separate scope (future sprint).

### D3. Infra-blocking mechanism (verified against @nestjs/typeorm@10.0.2 source)

| Infra | Blocking method |
|---|---|
| TypeORM real DB connection | `.overrideProvider(getDataSourceToken()).useValue(mockDataSource)` — replaces TypeOrmCoreModule's dataSourceProvider (whose useFactory calls `dataSource.initialize()`) wholesale → initialize never runs. The mock only needs the members the repository factory references: `entityMetadatas:[]`·`options.type`·`getRepository`. |
| Redis (`new Redis()`) | submission/problem: `.overrideProvider(REDIS_CLIENT)`. gateway: `jest.mock('ioredis')` — many constructors (~10, including throttler) call `new Redis()` directly at `.compile()` time; this is not via DI, so overrideProvider cannot intercept it and a module-level mock is required. |
| RabbitMQ (`amqplib.connect`) | `.compile()` only (D2). |

### D4. problem dual connection — companion named DataSource override

- DualWriteModule adds a `NEW_DB_CONNECTION='new-problem-db'` named connection beyond the default, so `getDataSourceToken(NEW_DB_CONNECTION)` (=`'new-problem-dbDataSource'`) is also overridden. `DUAL_WRITE_MODE=off` is **set explicitly** (D6) so only the OFF branch is evaluated → no `NEW_DATABASE_*` needed.

### D5. No coverage impact on spec-collected services (problem/identity/gateway)

- Only submission excludes specs from coverage (`!**/*.spec.ts` in `jest.config.ts`). problem/identity/gateway collect specs too, so the new specs are written with a **single `it`, zero branches, and no uninvoked function literals** (bare `jest.fn()`; `() => ...` literals only where actually invoked at compile) to avoid affecting function/branch thresholds (95~98%).

### D6. Test env is set explicitly, not preserved via spread (Critic P2)

- `beforeAll` sets `process.env`; `afterAll` restores via spread. This satisfies constructor/factory-time `getOrThrow` (submission: DATABASE_*·INTERNAL_KEY_AI_ANALYSIS; gateway: JWT_SECRET·OAUTH_CALLBACK_URL·INTERNAL_KEY_*). **problem sets `DUAL_WRITE_MODE='off'` explicitly** — a spread alone would preserve an expand·switch-read value from the environment/local `.env`, leaking into the active branch (caught in Critic R1).

## Implementation

### Implementation commits (2 commits, PR #347 squash → `5d1e5fc`)

- `1c5f126` test — add 4 AppModule bootstrap smoke tests
  - New `services/{gateway,submission,problem,identity}/src/app.module.spec.ts`
  - submission: override `getDataSourceToken()`·`getEntityManagerToken()`·`REDIS_CLIENT` (`./cache/cache.constants`)
  - problem: default + `NEW_DB_CONNECTION` (`./database/dual-write.config`) named DataSource/EntityManager + `REDIS_CLIENT` (`./cache/cache.module`) overrides
  - identity: DataSource/EntityManager override only (no module-level Redis; `NODE_ENV='test'` skips TokenEncryptionService key validation)
  - gateway: top-of-file `jest.mock('ioredis')` (default-import constructor mock, chainable `.on()`) + no TypeORM
  - common: single `it` + one `compile()` (avoids MetricsModule/prom-client duplicate registration) + `expect(moduleRef).toBeDefined()` + no close() (on teardown, TypeOrmCoreModule.onApplicationShutdown re-resolves the overridden DataSource and fails; with mocked infra there are no real handles to clean up)
- `8fcd15e` test — [Critic R1 P2] set `DUAL_WRITE_MODE='off'` explicitly in problem smoke (hermetic env)

## Verification

- **Type/build**: `tsc --noEmit` 0 (4 services). ESLint **0** (4 services; spec override turns off `no-explicit-any`).
- **Tests**: 4 specs pass standalone + full regression. Per-service coverage thresholds pass (`jest --coverage` exit 0 — submission/problem/identity/gateway). Zero open handles/hangs (jest exits cleanly; gateway throttler setInterval is `.unref()`).
- **Negative check**: temporarily swapped submission's DataSource override for an empty object → the repo factory's `dataSource.entityMetadatas.find(...)` failed compile() with `TypeError: Cannot read properties of undefined (reading 'find')` → proves the test **genuinely compiles** the graph and the mock is load-bearing (reverted).
- **Critic**: `codex review --base main` (gpt-5.x) **2 rounds** — Critical/High **0**. R1 P2 (problem `DUAL_WRITE_MODE` env leak) resolved → R2 **0** ("no discrete introduced issue that would break existing behavior or tests"). ✅ mergeable.
- **CI #347**: Passed **412** / Failed **0** / `MERGEABLE`·`CLEAN` → Squash merge.

## Lessons / Patterns

- ① **`.compile()` runs graph build + useFactory but not `onModuleInit`** — exploiting this boundary yields a smoke test that avoids lifecycle connections (e.g., RabbitMQ) while still catching circular dependencies / missing providers. A direct application of the Sprint 195 lesson that unit specs which don't compile the module DI graph (manual provider assembly) cannot catch cycles.
- ② **Override only intercepts DI-routed providers** — TypeORM DataSource/REDIS_CLIENT are providers and can be blocked via `overrideProvider`, but when a factory/constructor calls `new Redis()` directly (gateway), it is not DI-routed, so `overrideProvider` cannot stop it and a `jest.mock('ioredis')` (module-level mock) is required.
- ③ **Test env should be set explicitly, not preserved via spread** — an `ORIGINAL_ENV` spread preserves branch-deciding env (`DUAL_WRITE_MODE`, etc.) from the environment/local `.env`, so env that determines branch behavior must be set explicitly to keep the test hermetic (Critic catch).
- ④ **For spec-collected services, uninvoked function literals erode function coverage** — in services that don't exclude specs from coverage, a mock's `jest.fn(() => ...)` literal becomes an uncovered function if not invoked at compile. Avoid via bare `jest.fn()` + a single compile.

## New Patterns

- **AppModule bootstrap smoke test** — `Test.createTestingModule({imports:[AppModule]}).overrideProvider(getDataSourceToken()).useValue(mockDataSource)...compile()`. Override infra providers (DataSource·REDIS_CLIENT), module-mock directly-`new`ed clients (gateway ioredis), avoid RabbitMQ by limiting to `.compile()`. New NestJS services/modules validate the bootstrap graph once with this smoke test ("tests green = bootstrap possible").
- **Minimal TypeORM DataSource mock** — `{ entityMetadatas:[], options:{type:'postgres'}, getRepository: jest.fn(()=>mockRepository), manager:{...} }`. Just the members the repository provider factory references resolve the graph. Named connections override `getDataSourceToken(name)` separately.

## Carry-over

- (optional) **app.module smoke `.init()` extension** — lifecycle-hook (onModuleInit) verification + amqplib mock to extend bootstrap-equivalent validation through the RabbitMQ connection stage (separate sprint).
- **Operational Sprint 196 migration run + server redeploy** (user/ops): `npm run migration:run` on problem_db (jsonb migration + GIN, runbook `SET statement_timeout=0`).
- (optional) **CI PYTHON_VERSION 3.12 → 3.13** bump (separate sprint).
- Cumulative UAT (user-driven): Programmers re-submission grading / English production Grafana CB dashboard / Sprint 160~197 cumulative.
