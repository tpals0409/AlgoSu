---
sprint: 143
title: Carryover Seeds Bulk Cleanup — Correctness Gate Strengthening + Infrastructure Context Injection
status: completed
period: 2026-05-08 (single day)
start_commit: 8d3e760
end_commit: f262d73
prs:
  - https://github.com/tpals0409/AlgoSu/pull/198 (PR 1 — weight rebalancing)
  - https://github.com/tpals0409/AlgoSu/pull/199 (PR 2 — token/context guard)
  - https://github.com/tpals0409/AlgoSu/pull/200 (PR 3 — submission entity expansion, Critic 3 rounds)
  - https://github.com/tpals0409/AlgoSu/pull/201 (PR 4 — Calendar provider fallback)
  - https://github.com/tpals0409/AlgoSu/pull/202 (PR 5 — E2E PR auto comment)
related_sprints:
  - sprint-141 (carryover seeds bulk cleanup — 7 PR split pattern prototype)
  - sprint-142 (prompt optimization — Critic 5 rounds + score↔self-verification separation)
  - sprint-134~135 (saga payload + DB schema change Critic multiple round pattern)
---

# Sprint 143 — Carryover Seeds Bulk Cleanup (Plan B + Seed #4 Option A)

## Context

Bulk cleanup of 9 carryover seeds from Sprint 142 (prompt optimization) and Sprint 141 (infrastructure debt resolution) using group-by-group PR split strategy.

The key decision point was seed #4 (structural defect where ai-analysis worker receives no problem information and calls LLM with empty context). Sprint 142 only added guards on the prompt side, and without the infrastructure fix, the guards would trigger meaningless fallbacks only → **core work of this sprint**.

### Merge Scope (Plan B — User Approved)

| Seed | Location | Priority | Status |
|------|----------|---------|--------|
| #1 | ai-analysis correctness weight 30→40% | P2 | ✅ PR #198 |
| #2 | ai-analysis worker context absence guard | P1 | ✅ PR #199 |
| #3 | ai-analysis claude_client token truncation guard | P2 | ✅ PR #199 |
| #4 | submission entity + getProblemInfo (Option A) | **P0 (core)** | ✅ PR #200 |
| #6 | Calendar useLocale provider defense | P2 | ✅ PR #201 |
| #8 | E2E full integration PR auto comment | P2 | ✅ PR #202 |

### Sprint 144 Carryover (3 items)

- Seed #5: UAT — Programmers resubmission scoring pass confirmation (user direct)
- Seed #7: prometheus-rules / dashboard automatic verification CI (`promtool check rules` + grafana JSON cross-check)
- Seed #9: UAT — English environment calendar + production Grafana CB dashboard consistency (user direct)

## Decisions

### Seed #4 — Option A vs B (User Decision: Option A Adopted)

**Option A (root resolution, adopted)**: Add nullable `problem_title` (VARCHAR 255) / `problem_description` (TEXT) columns to Submission entity + DB migration + submission.service's create() calls problem service and stores result in entity.
- Advantage: Permanent resolution once done, no additional HTTP load (only 1 call at creation time)
- Disadvantage: TypeORM migration + multiple spec mock updates needed → Critic multiple rounds (Sprint 134~135 saga pattern)

**Option B (immediate, not adopted)**: ai-analysis worker directly calls problem service `/internal/{id}` + caching
- Advantage: No migration needed
- Disadvantage: HTTP call on every analysis + caching needed, increases problem service load

### PR Split Strategy (Reusing Sprint 141 Pattern)

5 PR split to distribute merge burden. Each PR uses new branch + Squash merge.

| PR | Branch | Files | Critic |
|----|--------|-------|--------|
| #198 | `feat/sprint-143-weights` | 3 (+20 -18) | Not invoked |
| #199 | `feat/sprint-143-context-token-guard` | 4 (+206) | Not invoked |
| #200 | `feat/sprint-143-submission-problem-context` | 7 (+127 -1) | **3 rounds** |
| #201 | `feat/sprint-143-calendar-fallback` | 1 (+11 -1) | Not invoked |
| #202 | `feat/sprint-143-e2e-pr-comment` | 1 (+27) | Not invoked |

## Core Changes

### PR #198 — correctness Weight 30% → 40% Strengthening (Seed #1)

- `ALGORITHM_WEIGHTS`: correctness 30→40%, efficiency 25→20%, bestPractice 15→10%
- `SQL_WEIGHTS`: correctness 30→40%, efficiency 20→15%, bestPractice 20→15%
- Bulk synchronization of prompt body (SYSTEM_PROMPT/SQL_SYSTEM_PROMPT) + SSOT constants + test assertions
- `test_claude_client.py` totalScore=0 recalculation TC 3 expected values updated (68→70, 64→66, 62→65)

### PR #199 — Token + Context Guard (Seeds #2, #3)

- `claude_client.CODE_LENGTH_THRESHOLD = 50000` constant + `analyze_code()` code length pre-validation
- `worker._on_message()` optimizedCode fallback when problem context absent
- Reuses Sprint 142 self-verification meta pattern — double guard strengthens correctness
- 3 token guard TCs + 3 context guard TCs added

### PR #200 — Submission Entity Expansion + getProblemInfo (Seed #4 Option A)

- `submission.entity.ts`: `problem_title` (VARCHAR 255 nullable), `problem_description` (TEXT nullable)
- `migrations/20260508000000-AddProblemContextColumns.ts`: `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` (Expand-Contract compatible)
- `ProblemServiceClient.getProblemInfo()` new method — protected by host single CB, `_dispatch`/`_fallback` extended
- `submission.service.create()` calls `checkLateSubmission` + `getProblemInfo` in parallel with `Promise.all`
- ai-analysis worker uses new fields automatically included in `/internal/{id}` response entity (0 worker code changes)

### PR #201 — Calendar useLocale Provider Defense (Seed #6)

- Wrapped `useLocale()` call in try-catch so that throw outside NextIntlClientProvider (Storybook/tests) falls back to ko
- ESLint `react-hooks/rules-of-hooks` disable + intent comment (hook order is invariant since it's environment-dependent within the same tree)

### PR #202 — E2E Full Integration PR Auto Comment (Seed #8)

- Added 2 `actions/github-script` steps to `e2e-test` job
- On start: "E2E Integration Test in progress" + workflow run link
- On failure: "E2E Integration Test failed" + artifact download guidance
- Added `pull-requests: write` permission

## Critic Verification (PR #200 — 3 Rounds)

### Round 1 — 1 P1 + 1 P2 Caught

- **P1**: `getProblemInfo` not defined in `mockProblemServiceClient` factory in 3 specs (`saga-orchestrator.service.spec.ts`, `ai-satisfaction.spec.ts`, `submission.service.spec.ts`) → all `service.create()` call tests throw `TypeError`
- **P2**: `checkLateSubmission` + `getProblemInfo` called serially → 2× timeout (10 seconds) in incident scenarios

**Resolution**: Add `getProblemInfo: jest.fn().mockResolvedValue({title:'', description:''})` to all 3 spec mocks + parallelize with `Promise.all`. Safe to parallelize since both immediately fallback if same host single CB is OPEN.

### Round 2 — 1 P2 Caught

- **P2**: `problemTitle: problemTitle || null` → SQL NULL → ai-analysis worker `submission.get()` returns None → prompt builder serializes as `f"Description: {problem_description}"` → **"Description: None" string** sent to LLM

**Resolution**: Normalize with `?? ''` (preserve empty string). Entity keeps nullable (migration compatible), all new rows stored as string.

### Round 3 — Clean Pass ✅

> "The changes appear consistent with the existing submission flow: the new columns are added via migration, populated on create with safe fallbacks, and the ProblemService client extension matches the current internal Problem Service contract. I did not identify a discrete regression or blocking issue in the diff relative to the base branch."

## Verification

- All CI GREEN — Quality (submission/frontend/ai-analysis) + Test (all services) + Coverage Gate + E2E Programmers Full Flow
- 0 jest regressions — all create() tests pass with updated submission service spec
- 0 pytest regressions — 6 new ai-analysis TCs (3 token + 3 context) + 3 weight assertion updates

## New Policies / Patterns

### 1. Bulk Update Pattern for Dependent Tests on Score Distribution Changes

When rebalancing weights (seed #1), updating only direct weight assertions in `test_prompt.py` is insufficient. The `totalScore=0 recalculation` TCs in `test_claude_client.py` also depend on weights, so they must be updated together. **Detected via follow-up commit in Sprint 143 PR #198** → recommend pre-grepping all weighted average TCs when SSOT weights change going forward.

### 2. Mock Missing Pattern on saga + DB Schema Changes

When adding a new method to ProblemServiceClient, the same mock must be added to `mockProblemServiceClient` factories in all 3 specs. Same as Sprint 141's pattern of bulk updating 4 monitoring files on schema change — **grep all mock factories when adding client methods is mandatory**.

### 3. External Call Serialization Latency Review Obligation

When adding a new external service call, check whether sequential `await` with existing calls to the same host doubles the timeout. CB OPEN causes both to immediately fallback, so `Promise.all` parallelization is safe. Critic R1 P2 pattern.

### 4. SQL NULL → Other Language Serialization Regression Pattern

TypeScript `null` → PostgreSQL NULL → Python `None` → f-string `"None"`. Nullable fields crossing language boundaries can reach user-exposed paths like prompts/logs → **empty string normalization recommended** (entity stays nullable for migration compatibility).

### 5. React Hooks try-catch Pattern (Provider Absence Defense)

Hooks like `useLocale()` that throw when provider is absent conflict with ESLint `react-hooks/rules-of-hooks`. Since the throw/non-throw behavior is the same every render within the same component tree, hook order is invariant. Resolved with ESLint disable + intent comment.

## Post-Sprint Retrospective

### What Went Well

- **User-decision-first flow**: Seed #4 Option A/B decision delegated to user in advance → explicit decision point separated in plan → no hesitation during execution
- **Critic multiple round effectiveness reconfirmed**: R1 (mock + latency), R2 (null serialization), R3 (clean) in PR #200 — same as Sprint 142 5-round pattern
- **PR split strategy reuse**: Sprint 141's 7 PR pattern applied with 5 PRs — right size
- **Branch discipline ✅**: 9 consecutive sprints compliant (since Sprint 134 violation) — all 5 PRs use new branches + Squash merge

### Room for Improvement

- **PR #200 lint/typecheck pre-check absent**: The 3 spec mock omissions couldn't be pre-verified due to local Python 3.9 environment limitations, but TypeScript could have been → **auto-mock search grep when adding new client methods should be mandated** (Sprint 144 seed)
- **User direct UAT dependency**: Seeds #5 (Programmers resubmission) and #9 (English calendar + Grafana) both require user direct visual verification. Automation to be reviewed in Sprint 144+.

## Sprint 144 Carryover Seeds

### Sprint 143 New (found during this work)

- **New seed (P3)**: Add TypeScript client method mock factory auto-detection lint or CI grep
- **New seed (P3)**: Auto-detect dependent TCs on score system change (SSOT weight single-source + recalculation TC auto-consistency)

### Sprint 142~141 Remaining

- Seed #5 (UAT): Actual Programmers resubmission → scoring pass confirmation (user direct)
- Seed #7 (P2): prometheus-rules / dashboard automatic verification CI — `promtool check rules` + grafana JSON cross-check
- Seed #9 (UAT): English environment calendar + production Grafana CB dashboard consistency (user direct)
