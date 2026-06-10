---
sprint: 241
title: "BE decomposition — ADR-030 Q-1 (BE) + Q-2"
date: "2026-06-10"
status: completed
agents: [Oracle, Gatekeeper, Conductor, Critic, Scribe]
related_adrs: ["ADR-030", "sprint-240", "sprint-238"]
related_memory: ["sprint-window"]
topics: ["refactoring", "code-quality", "backend"]
tldr: "Sprint 3 of the ADR-030 remediation roadmap. Two behavior-preserving refactors completed — coverage thresholds held + Critic auto 2 rounds → 4 findings fully fixed. Q-1 (BE): gateway study.service.ts (823 lines / 28 methods) → 5 domain services (StudyMemberService, StudyStatsService, StudyAccessService, MembershipCacheService, residual study.service) + shared types. StudyController injects 3 services directly (zero delegation boilerplate). All 5 new services + controller at 100% coverage. Q-2: saga-orchestrator.service.ts (516 lines) → SagaQuotaService (AI quota + CB ownership) / SagaTimeoutService (saga resumption + timer + lifecycle) / residual Orchestrator (advance*/compensate*). Zero call-site changes across 6 consumers. Critic auto R1 (gatekeeper output, base 241af57): M-1 redis.keys O(N), L-1 structured-logging pattern mismatch. Critic R1 (conductor output, base 606edb1): app.module.init.spec comment drift, fake-timer isolation gap. All 4 fixed; R2 (base 3dc4b13) CLEAN. gateway coverage 98.66/96.94/96.83/98.93 (threshold 98/95/96/98), submission coverage 98.69/94.13/98.93/99.04 (threshold 97/92/96/97) — both held."
---
# Sprint 241 — BE decomposition (ADR-030 Q-1 BE + Q-2)

## Goal

- Item 3 on the ADR-030 remediation roadmap — address the two backend code-quality items (Q-1 BE, Q-2) in a single sprint.
- Behavior-preserving refactoring — API responses, error types, log message text, and cache key format are all unchanged.
- Per-service coverage thresholds (gateway 98/95/96/98, submission 97/92/96/97) must not be lowered; Critic merge gate required.

## Context

- `/start` argument: process ADR-030 §Decision roadmap item 3, Q-1 (BE) + Q-2.
- **Q-1 BE**: `study.service.ts` at 823 lines and 28 methods — CRUD, member management, statistics, and access verification co-located in a single file. Identified as the top oversized module in the Sprint 238 audit.
- **Q-2**: `saga-orchestrator.service.ts` at 516 lines — state transitions, quota management, and timeout resumption all in one file. Behavior was already verified sound (Sprint 238 §Misjudgment corrections); only separation of concerns remained.

## Work summary (Gatekeeper + Conductor + Scribe, 4 commits total + Critic corrections)

### Q-1 BE — study.service domain split (Gatekeeper, commit `606edb1`)

**Split layout (StudyController injects directly, no facade)**

| New file | Responsibility | Dependencies |
|----------|---------------|--------------|
| `study.types.ts` | Shared interfaces: `StudyData` / `MemberData` / `InviteData` | — |
| `membership-cache.service.ts` | Sole Redis client owner + `invalidate` / `invalidateAll` + OnModuleDestroy | configService, logger |
| `study-access.service.ts` | `verifyMembership` / `verifyAdmin` (promoted from private) | identityClient |
| `study-stats.service.ts` | `getStudyStats` / `fetchActiveProblemIds` + fetch/map helper split (20-line rule) | configService, logger, identityClient |
| `study-member.service.ts` | getMembers / updateNickname / changeMemberRole / leaveStudy / removeMember + `findTargetMember` / `ensureNotLastAdmin` helpers (DRY) | identityClient, notificationService, access, cache, logger |
| `study.service.ts` (residual) | 5 CRUD methods + closeStudy / updateGroundRules + 3 invite methods + notifyProblemCreated | identityClient, notificationService, inviteThrottle, access, cache, logger |

- **StudyController directly injects StudyService / StudyMemberService / StudyStatsService** — member and statistics endpoints route directly to the owning service. Zero delegation boilerplate (follows the notification/ precedent).
- `study.module.ts` providers gains 4 new services. exports retains `StudyService` unchanged.
- Dependency direction: core/member → {access, cache}, one-way, no cycle.
- `OnModuleDestroy` and Redis ownership moved from StudyService → MembershipCacheService.
- 20-line function rule: `joinByInviteCode` (assertInviteUsable / assertJoinable / notifyAdminsOnJoin), `changeMemberRole` / `removeMember` (shared findTargetMember / ensureNotLastAdmin), `leaveStudy` (notifyMemberLeft).
- Spec: 1310-line monolithic spec → split into 5 service-level specs. Edge-case reinforcements included; zero case loss.

**Behavior invariants verified**: API response shape, structured-log messages, error types (Forbidden/NotFound/Conflict/BadRequest), cache key format (`membership:{studyId}:{userId}[:denied]`), and invalidate call timing are all unchanged. No external consumers of StudyController confirmed.

### Q-2 — saga-orchestrator helper extraction (Conductor, commit `3dc4b13`)

**Decomposition design (dependency chain: Timeout → Orchestrator → Quota)**

| File | Responsibility | Dependencies |
|------|---------------|--------------|
| `saga-quota.service.ts` (new ~125 lines) | `fetchAiQuota` / `checkAiQuota` + `aiQuotaCheck` CB registration (in constructor) + AI URL/Key config ownership | configService, cbService |
| `saga-timeout.service.ts` (new ~210 lines) | Boot-time incomplete-saga resumption + `checkSagaTimeouts` 2-min timer + `resumeSaga` + lifecycle (onModuleInit/Destroy) | submissionRepo, mqPublisher, problemClient, **SagaOrchestratorService** |
| `saga-orchestrator.service.ts` (residual ~285 lines) | `advance*` / `compensate*` state transitions only | submissionRepo, mqPublisher, problemClient, statsCache, **SagaQuotaService** |

- **CB registration moved from onModuleInit → constructor**: eliminates dependency on NestJS initialization order.
- **Zero call-site changes across 6 consumers**: `submission.service.ts:118,279` + `submission-internal.controller.ts:156,170,184,198` — `advance*` / `compensate*` signatures and ownership unchanged.
- Spec split: quota and timeout test cases extracted from the 1047-line orchestrator spec. Two edge-case additions (aiSkipped optimistic-lock affected=0, 2-min timer fires → checkSagaTimeouts). Zero case loss.
- `submission.module.ts` providers gains `SagaQuotaService` / `SagaTimeoutService`.

**Behavior invariants verified**: `advance*` / `compensate*` external signatures unchanged. Dependency direction (Timeout→Orchestrator→Quota) verified one-way, no cycle. timeout spec compiles with the real 3-service DI graph, proving no circular dependency.

### Critic auto-critic R1 fix — gatekeeper output (commit `16fc2c4`)

Codex gpt-5.5 cross-review (`--base 241af57`, commit `606edb1`): **✅ merge-ready, 2 findings**.

**M-1 (Gatekeeper fix)**: `membership-cache.service.ts:59` `redis.keys('membership:{studyId}:*')` O(N) blocking command → replaced with `do…while` cursor loop (`redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100)`) + per-batch `del`. Behavior (delete all pattern-matching keys) unchanged. Mitigating factor: `MAX_MEMBERS=50` hard cap meant immediate risk was low, but an explicit SCAN ensures safety regardless of future limit changes.

**L-1 (Gatekeeper fix)**: `membership-cache.service.ts:28` `this.logger.error(\`Redis 연결 오류: ${err.message}\`)` → `this.logger.error('Redis 연결 오류', err)`. Aligned with the `StructuredLoggerService` second-argument Error serialization pattern (name/message/stack). Removes inline interpolation and preserves full stack trace.

Spec: `membership-cache.service.spec.ts` gains scan mocking + a multi-cursor traversal test case (cursor '42'→'0') to cover the loop branch. `study.service.spec.ts` deleteStudy path ioredis mock migrated to scan.

### Critic auto-critic R1 fix — conductor output (commit `22a3a70`)

Codex gpt-5.5 cross-review (`--base 606edb1`, commit `3dc4b13`): **✅ merge-ready, 2 findings**.

**(3) app.module.init.spec.ts comment drift (Conductor fix)**: `onModuleInit` / `onModuleDestroy` and the setInterval timer were moved to `SagaTimeoutService`, but spec comments still referenced `SagaOrchestratorService` from the old design. `@related` updated to include `saga-timeout.service.ts`; lifecycle ownership references corrected at 3 locations.

**(4) saga-timeout.service.spec.ts fake-timer isolation (Conductor fix)**: 4 tests using `jest.useFakeTimers()` restored timers only at the end of each test body — if an assertion threw mid-test, fake timers leaked into subsequent tests. Added `jest.useRealTimers()` to `afterEach` (restoration guaranteed regardless of test outcome) and removed the 4 redundant per-test `useRealTimers()` calls, consolidating restoration responsibility into afterEach.

### Critic auto-critic R2 — full branch (base `3dc4b13`, commits `16fc2c4` + `22a3a70`)

Codex gpt-5.5 cross-review (`--base 3dc4b13`): **✅ CLEAN**.
- SCAN implementation correctness confirmed: `do...while(cursor !== '0')` guarantees full traversal; no off-by-one.
- DEL spread: COUNT 100 hint keeps batches within argument limits; no overflow risk.
- Out-of-scope Low finding: `invite-throttle.service.ts`, `deadline-reminder.service.ts`, `notification.service.ts` still use string-interpolation on Redis on-error logs → recommended for a follow-up Gatekeeper/Herald pass.

## Key decisions

1. **Direct controller injection over a facade**: a facade with no business logic only adds delegation boilerplate. With the controller acting purely as a router, injecting the 3 services directly is both cleaner and consistent with the notification/ precedent.
2. **CB registration in constructor**: if `onModuleInit` registers the CB, NestJS initialization order could allow quota checks to fire before the CB is registered. Moving to the constructor guarantees the CB exists as soon as the provider is instantiated.
3. **SCAN replacement despite the 50-member cap**: even though the hard limit made immediate risk low, the Critic-identified pattern inconsistency warranted fixing in this sprint — future limit changes will not require a separate fix.
4. **afterEach for fake-timer restoration**: a per-test `useRealTimers()` at the test body end is skipped on assertion failure. Lifecycle hooks (afterEach) run regardless, making isolation reliable.

## Verification

- **gateway**: `npx tsc --noEmit` 0 errors · `npm run lint` 0 errors · `npm test -- --coverage` 62 suites / **854 tests, all passing**
  - coverage: Statements **98.66** / Branches **96.94** / Functions **96.83** / Lines **98.93** (threshold 98/95/96/98 held)
  - All 5 new services + study.controller.ts: **100%**
  - membership-cache.service.ts (post-SCAN fix): **100/100/100/100**
- **submission**: `npx tsc --noEmit` 0 errors · `npm run lint` 0 errors · `npm test -- --coverage` 28 suites / **387 tests, all passing**
  - coverage: Statements **98.69** / Branches **94.13** / Functions **98.93** / Lines **99.04** (threshold 97/92/96/97 held)
  - saga-quota.service.ts: **100/100/100/100** · saga-timeout.service.ts: **100/90/100/100** · saga-orchestrator.service.ts: **97.5/89.47/100/100**
- Critic auto-critic: gatekeeper R1 (M-1/L-1 found) → fixed → conductor R1 (comment drift/timer isolation found) → fixed → **R2 CLEAN** (base `3dc4b13`)
- Changed files (4 commits, 22 files total):
  - Q-1 BE: `study.types.ts` (new), `membership-cache.service.ts` (new), `study-access.service.ts` (new), `study-stats.service.ts` (new), `study-member.service.ts` (new), `study.service.ts` (modified), `study.controller.ts` (modified), `study.module.ts` (modified), 6 spec files (new/modified)
  - Q-2: `saga-quota.service.ts` (new), `saga-quota.service.spec.ts` (new), `saga-timeout.service.ts` (new), `saga-timeout.service.spec.ts` (new), `saga-orchestrator.service.ts` (modified), `saga-orchestrator.service.spec.ts` (modified), `submission.module.ts` (modified)
  - Critic fixes: `membership-cache.service.ts` (modified), `membership-cache.service.spec.ts` (modified), `study.service.spec.ts` (modified), `app.module.init.spec.ts` (modified), `saga-timeout.service.spec.ts` (modified)

## Lessons

1. **Critic flags patterns carried over from pre-refactor code**: `redis.keys()` O(N) existed in `study.service.ts` before the split, but once isolated in `membership-cache.service.ts` it became clearly visible to Critic. Refactoring is an opportunity to revisit inherited patterns.
2. **Fake-timer restoration belongs in afterEach**: a `useRealTimers()` call at the end of a test body is skipped when an assertion throws. This can cause intermittent failures in subsequent tests when fake timers leak. Lifecycle hooks (afterEach/afterAll) provide unconditional cleanup.
3. **Comment drift after service extraction is predictable**: when lifecycle hooks (onModuleInit/Destroy) move to a new service, every @related tag and comment referencing the original owner must be updated. Functional tests can still pass while the comments mislead future developers.
4. **Direct controller injection is clearer than a no-logic facade**: if a middle layer only delegates with no business logic of its own, it should be eliminated. Looking for existing precedents in the codebase avoids reinventing architectural decisions.

New patterns: **refactor-linked Critic absorption pattern** (split → Critic R1 findings fixed in same branch → R2 CLEAN) + **fake-timer afterEach consolidation pattern** (lifecycle hook owns restoration responsibility).

## Carry-overs

- Sprint 242 confirmed: Q-1 (FE) + Q-7 — `AddProblemModal.tsx` (805 lines) / `studies/[id]/settings/page.tsx` (844 lines) / `problems/[id]/edit/page.tsx` (748 lines) decomposition + tests alongside new components.
- Adjacent Redis on-error logging pattern alignment (`invite-throttle.service.ts`, `deadline-reminder.service.ts`, `notification.service.ts`): Critic R2 Low — defer to a follow-up Gatekeeper/Herald sprint.
- Existing carry-overs: harness checkup slot (oracle-spawn pane guard hardening + window-name decoration root fix + harness-checkup `--full` + Codex model pin) · GA4 console 3 items · live SEO · harness cron · webhook regenerate · cumulative UAT · blog backlog (CS quiz / deleted features / zstd).
