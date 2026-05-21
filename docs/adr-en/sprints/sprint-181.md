---
sprint: 181
title: "Backfill category for legacy SQL problems"
date: "2026-05-21"
status: completed
agents: [Oracle, Architect, Critic, Scribe]
related_adrs: ["sprint-180", "sprint-178", "sprint-151"]
related_memory: ["sprint-window"]
---
# Sprint 181 — Backfill category for legacy SQL problems

## Goal

- Sprint 151 added the `problems.category` column (ALGORITHM/SQL), and the problem detail page auto-selects the editor language as `'sql'` only when the **stored** `problem.category === 'SQL'` (`frontend/.../problems/[id]/page.tsx`). However, the column-adding migration `AddCategoryToProblems(1709000016000)` applied `DEFAULT 'ALGORITHM'` to every existing row.
- The category input UI only arrived in Sprint 178, and auto-propagation from Programmers search results only in Sprint 180, so **every legacy Programmers SQL problem registered before that is stored as category=ALGORITHM**. → Opening a legacy SQL problem always brings up the editor in python, forcing the user to switch language manually every time — a **real UX bug**. (The Sprint 180 dual-check helper's tag fallback masks this for search-result display, but not for the detail-page auto-select that depends on the stored category.)
- A backfill migration corrects the stored category of legacy SQL problems to SQL, completing the Sprint 151→178→180 category feature arc down to the data level.

## Decision

### D1. A single data-correction migration following precedent

A pure DML (UPDATE) migration following the `BackfillLevelFromDifficulty(1709000015000)` precedent exactly. No schema change (Expand-Contract). The timestamp `1709000017000` > `AddCategoryToProblems`'s `...16000`, guaranteeing it runs after the column exists. It follows the `migration-naming.md` rules (1 migration = 1 change unit, no DDL/DML mixing, up/down required).

### D2. SQL detection signal = mirror the frontend dual-check helper

The backfill's SQL detection uses the **same signal** as the system's own definition (`isProgrammersSqlProblem`: `tags.some(t => t.toUpperCase() === 'SQL')`). Since `tags` is stored as `simple-json` (JSON text `["SQL",...]`), `tags ILIKE '%"sql"%'` matches array elements `"SQL"`/`"sql"` etc. case-insensitively. Including the JSON quotes in the pattern means substrings like `"NoSQL"`/`"SQL injection"` do not match, preserving the helper's exact `=== 'SQL'` semantics.

### D3. Programmers identification = platform OR source_url dual condition (reinforced on Critic grounds)

Since the SQL Kit source is Programmers only (solved.ac/BOJ/LeetCode have no SQL category concept), the backfill is confined to Programmers rows to block false positives. The initial implementation used a single `LOWER(source_platform) = 'programmers'` guard, but Critic R1 caught that **`sourcePlatform` is optional (DTO `@IsOptional`), so legacy SQL problems stored with only a `source_url` and no platform were excluded, leaving the bug present**. → Programmers identification was reinforced to a dual condition `source_platform = programmers` **OR** `source_url ILIKE '%programmers.co.kr%'`, including URL-only legacy rows while retaining the Programmers confinement (false-positive protection).

## Implementation

### PR (services/problem, single work branch `chore/sprint-181-backfill-sql-category`, 2 commits)

- `9c6c565` fix — new backfill migration (`1709000017000-BackfillSqlCategory.ts`). up: `category='SQL'` where ALGORITHM + Programmers + 'SQL' tag. down: best-effort reversal.
- `1bfa9f1` fix (Critic R1 P2) — reinforce Programmers identification to platform OR source_url dual condition (include URL-only legacy rows).

Core SQL (up):
```sql
UPDATE problems
SET category = 'SQL', updated_at = now()
WHERE category = 'ALGORITHM'
  AND tags ILIKE '%"sql"%'
  AND (LOWER(source_platform) = 'programmers' OR source_url ILIKE '%programmers.co.kr%')
```

down reverses SQL→ALGORITHM with the same heuristic. There is a stateless limitation that rows set to SQL via the Sprint 178+ form will also be reverted if they match the same heuristic, but this inherits and documents the identical incompleteness of the precedent `BackfillLevelFromDifficulty.down` (best-effort, rollback scenario only).

## Critic cycle

`codex review --base main`, 2 rounds.

- **R1** (session `019e47d1`): **P2** — the single `LOWER(source_platform)='programmers'` guard excluded legacy rows that have a missing platform but a Programmers `source_url` and a 'SQL' tag, leaving the bug present (false-negative). → resolved with the platform OR source_url dual condition.
- **R2** (session `019e47d4`): **0 issues**, passed — "The migration is narrowly scoped, uses valid PostgreSQL predicates for the existing schema, and does not introduce an evident functional regression. No actionable correctness issues were found in the diff." Mergeable.

## Verification

### Local
- `tsc --noEmit` 0 errors.
- ESLint 0 errors / 0 warnings (new migration file).
- jest 170 tests all pass / 0 fail (no regression).

### Data correctness (deferred to UAT)
- `services/problem` has no test DB infrastructure (pg-mem/testcontainers), only `pg`, so the migration — like the precedent — has no unit test and is verified at deploy time. The SQL heuristic (ILIKE matching accuracy, dual-guard breadth, down limitation) was complemented by the Critic Codex cross-review.

### CI
- Work PR + ADR PR all checks green (including Build Blog — triggered by ADR `sprints/**`).

## Result

- **Merge**: origin/main `ed38eb5` → `b1b48aa` (PR #315 squash merge, work branch deleted).
- **Net change**: 1 new file `services/problem/src/database/migrations/1709000017000-BackfillSqlCategory.ts` (2 branch commits → squash).
- ADR sprint-181 (KR+EN) + README sprint ADR count 119→120, range 62~181 (separate ADR PR).

## New patterns

- **A column default creates data debt**: `ADD COLUMN ... NOT NULL DEFAULT` is zero-downtime (Expand-Contract), but it fills existing rows with a blanket default, leaving "the feature is right but the data is wrong" debt. When that column's **consumer** (here, the detail-page auto-language-select) misbehaves on the default value, adding an input UI (Sprint 178) is not enough — a **legacy data backfill** is also required to complete the feature arc.
- **A backfill heuristic mirrors the consumer's detection signal**: if the backfill defines "what is a SQL problem" on its own, it diverges from the frontend display logic. We carried over the signal (tag) of the system's existing detection helper (`isProgrammersSqlProblem`) verbatim into the SQL classification, keeping the SSOT consistent.

## Lessons

- **Cross-review caught a nullable-column false-negative**: Critic (Codex cross-review), from the schema fact that `sourcePlatform` is optional, caught that the platform-only guard misses URL-only legacy rows, **leaving the very bug the backfill was meant to fix present in some rows**. The balance between a conservative guard (blocking false positives) and full coverage (blocking false negatives) reaffirmed that, for an optional identification column, you must catch rows with an **OR against an alternative signal (URL)** rather than a single signal.
- **In a DB-untested environment, cross-review is the verification complement**: a migration with no test DB infrastructure cannot catch SQL-predicate correctness with unit tests, so the Codex cross-review served as effectively the sole automated verification layer for the ILIKE pattern and guard breadth.

## Carry-over (Sprint 182+)

- **Manual UAT by user**: verify that opening a legacy Programmers SQL problem (registered before Sprint 178) auto-selects the editor language as `sql`, and that ordinary ALGORITHM problems are unaffected (still default to python) + inherit the Sprint 160~180 accumulated UAT.
- Follow-ups: removing the coverage-gate `skipped` allowance (deferrable since actual skipped tests = 0), `(adr)` layout split, prom-client Case B~D automation, `.claude-tools/` Phase 2 actual deletion (after trigger-path verification).
