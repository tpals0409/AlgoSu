---
sprint: 230
title: "problem-service SP196 Migration Fix (tags jsonb DEFAULT cast failure — ERROR 42804)"
date: "2026-06-08"
status: completed
agents: [Oracle, Scribe, Librarian, Critic]
related_adrs: ["sprint-196"]
related_memory: ["sprint-window"]
topics: ["problem", "database", "migration", "operations"]
tldr: "During the f4493ac rollout on the production cluster (OCI ARM k3s), only problem-service was stuck in Init:CrashLoopBackOff (db-migrate init container, restart 4+). The first query of the SP196 migration 20260522120000-SP196-TagsAllowedLanguagesToJsonb.ts, `ALTER COLUMN tags TYPE jsonb`, failed with PostgreSQL ERROR 42804 (default for column \"tags\" cannot be cast automatically to type jsonb). Root cause: 1700000100002-AddTagsColumn created `tags varchar(500) DEFAULT NULL` → ALTER COLUMN TYPE attempts to cast not only row data (USING) but also the DEFAULT expression stored in the catalog (NULL::character varying) to the new type, and since there is no assignment cast from varchar to jsonb it raises 42804. allowed_languages has no DEFAULT but the migration dies at tags first so it is never reached. The production DB rolled back the transaction (tags still varchar(500), migration unrecorded) → safe to re-run after the fix. Fixed with the standard DEFAULT-preserving type-change order: up() adds DROP DEFAULT immediately before each column TYPE change (required for tags, defensive no-op for allowed_languages), and since the entity declares no default on the jsonb columns it does not re-SET DEFAULT; down() restores tags SET DEFAULT NULL after reverting to varchar (fully reversible). timestamp/class name unchanged. New spec (QueryRunner mock SQL-order assertions). Verification: tsc 0 · eslint 0 error · jest 191 PASS (+6 new) · coverage 99.14/96.68/98.48/99.05 (gates 98/96/98/98 met). After merge, CI build → ArgoCD rollout brings all 8/8 services to the latest image."
---
# Sprint 230 — problem-service SP196 Migration Fix (tags jsonb DEFAULT cast failure — ERROR 42804)

## Goal

- Resolve the state where **only problem-service** was stuck in `Init:CrashLoopBackOff` during the f4493ac rollout on the production cluster (OCI ARM k3s), leaving 7/8 services on the latest image.
- Root-fix the `ALTER COLUMN tags TYPE jsonb` failure (PostgreSQL **ERROR 42804**) of the SP196 jsonb migration using the standard DEFAULT-preserving type-change order.
- Completion criterion: merge → CI build → ghcr → aether-gitops → ArgoCD rollout brings a new problem-service SHA to Running, achieving **all 8/8 services on the latest image in production**.

## Background

- A rollout check found pod `problem-service-78d985598f-7q8db` in `Init:CrashLoopBackOff` (db-migrate init container, restart 4+). The other 7 services (ai-analysis·blog·frontend·gateway·github-worker·identity·submission) rolled out fine on the f4493ac image; only the old problem-service stayed Running.
- Failing query (init container log): `ALTER TABLE problems ALTER COLUMN tags TYPE jsonb USING CASE WHEN tags IS NULL THEN NULL ELSE tags::jsonb END` → `ERROR 42804: default for column "tags" cannot be cast automatically to type jsonb` (tablecmds.c:12655, ATExecAlterColumnType).
- This migration (`20260522120000-SP196-TagsAllowedLanguagesToJsonb.ts`) was merged in Sprint 196 but had been carried over unapplied on the production DB; it ran for the first time during the f4493ac rollout and failed.

## Root Cause (confirmed from code)

1. `1700000100002-AddTagsColumn.ts` created `tags` via `ALTER TABLE problems ADD COLUMN tags varchar(500) DEFAULT NULL` → the DEFAULT expression `NULL::character varying` is stored in the catalog (`pg_attrdef`).
2. `ALTER COLUMN ... TYPE` casts not only row data (the USING clause) but also the **column's stored DEFAULT expression** to the new type. `USING` applies only to row data, not the DEFAULT expression.
3. There is no **assignment cast** to convert `NULL::character varying` to jsonb, so PostgreSQL raises 42804.
4. `allowed_languages` was created without a DEFAULT clause in `1700000100000-CreateProblemsTable.ts` → inherently safe, but the migration died at tags first and never reached it.
5. When the first ALTER fails the transaction rolls back, so production `problems.tags` is **still varchar(500)** and the TypeORM `migrations` table has no record → **re-running after the fix is safe**.

## Decisions

### D1. Standard DEFAULT-preserving type-change order (up)

Add `ALTER COLUMN <col> DROP DEFAULT` **immediately before each column TYPE change**.
- `tags`: **required** since DEFAULT NULL triggers 42804.
- `allowed_languages`: no DEFAULT originally, but **defensively DROP DEFAULT (no-op)** before the change — guarding against any environment where a DEFAULT might exist, and symmetric with tags.
- The USING NULL guard, `SET LOCAL statement_timeout=0`, and the COMMIT/`CREATE INDEX CONCURRENTLY`/BEGIN skeleton are **kept as-is**.

### D2. Do not re-SET DEFAULT

`problem.entity.ts` declares `tags`·`allowedLanguages` as `@Column({ type: 'jsonb', nullable: true })` with **no default** → the column default is implicitly NULL = consistent with the entity. Re-applying `DEFAULT NULL` is meaningless, so up() issues no SET DEFAULT.

### D3. Fully reversible down()

After reverting to varchar(500), add `ALTER COLUMN tags SET DEFAULT NULL` to **restore AddTagsColumn's original catalog state**. down undoes the DEFAULT that up dropped, ensuring round-trip integrity. allowed_languages had no DEFAULT originally, so it is not restored.

### D4. timestamp/class name unchanged

`20260522120000` / `TagsAllowedLanguagesToJsonb20260522120000` **must not change**. TypeORM tracks application status by migration name, so — given the migration may already be applied in other environments (local·CI) — the identifiers are preserved and **only the body is modified**.

### D5. USING guard is NULL-only (no data correction)

The entity serializes `string[] | null` to JSON, so physical values are only NULL or valid JSON text (empty string impossible). No data correction such as empty-string→`'[]'` is added (respecting SP196's "pure DDL, no data correction" intent).

## Implementation

2 atomic commits (start `f4493ac`):

| Commit | Content |
|--------|---------|
| `6a4cbf4` | `20260522120000-SP196-TagsAllowedLanguagesToJsonb.ts` — up() adds DROP DEFAULT before the tags·allowed_languages TYPE changes, down() restores tags SET DEFAULT NULL, @file header documents the 42804 rationale / new `*.spec.ts` — QueryRunner mock asserting DROP-DEFAULT-before-TYPE order, CONCURRENTLY skeleton, and down symmetry (6 tests) |
| (ADR) | `sprint-230.md` KR+EN, README index 167→168 |
| (Critic P1) | move spec from `migrations/` → `src/database/__tests__/` — see D6 below |

### D6. Move the spec outside the migrations glob (Critic R1 P1)

Critic (Codex) flagged a **[P1] blocking issue**: this service has no `tsconfig.build.json`, so `nest build` compiles `*.spec.ts` into dist too (confirmed: dist already holds several `*.spec.js`), and `data-source.ts`'s migration glob `migrations/*{.ts,.js}` matches a `.spec.js` directly under `migrations/`. Placing the spec in `migrations/` means `migration:run` would require the compiled spec → top-level `describe()` runs without Jest globals → **db-migrate init container crash** (re-breaking exactly the rollout path this sprint fixes). → moved the spec to `src/database/__tests__/` (a sibling directory not matched by the glob) and fixed the import to `../migrations/...`. Empirically verified: after a fresh `nest build`, no spec.js exists under `dist/src/database/migrations/`.

## Verification

- **tsc**: 0 errors (`npm run typecheck`).
- **eslint**: 0 issues on changed files, 0 errors overall.
- **jest**: **191 PASS / 0 FAIL** (including the 6 new migration spec tests, 17 suites).
- **Coverage**: lines **99.14%** / branches **96.68%** / functions **98.48%** / statements **99.05%** (gates 98/96/98/98 met). The migration file is excluded from coverage via jest `collectCoverageFrom`'s `!**/database/**` — the spec still runs to block regressions but does not affect the gate.
- **Real DB dry-run not possible** (work-environment constraints: docker not running · no local postgres · kubectl points at a local, non-running cluster, the production OCI being a separate layer) → in-env verification is static (tsc/lint) + SQL-order-assertion spec. Real rollout verification is done on the production side after merge.
- **ADR gates**: index count (sprint **168**) / adr-en coverage (KR/EN 1:1) / adr-links 0 broken / doc-refs no broken.

## Lessons

1. **`ALTER COLUMN ... TYPE` casts the column DEFAULT expression too, not just row data** — `USING` applies only to rows, not the catalog DEFAULT. When changing a type, always follow **DROP DEFAULT → TYPE change → (if needed) SET DEFAULT**.
2. **Even `DEFAULT NULL` triggers 42804** — a NULL literal default is stored as `NULL::<original type>` in the catalog, and without an assignment cast to the new type it cannot be cast. The intuition "it's fine because the DEFAULT is NULL" is wrong.
3. **Type-change migrations can be regression-tested without a live DB via SQL-order assertions** — mock QueryRunner and deterministically verify "is DROP DEFAULT issued before the TYPE change?" (no real DB needed).
4. **An already-merged but unapplied carried-over migration can be safely fixed body-only** — if a rolled-back transaction left the schema and migrations table unchanged, modify the body (preserving timestamp/class name) and re-run.

New pattern:
- **DEFAULT-preserving type-change migration pattern** — when converting a column type, `DROP DEFAULT → ALTER TYPE(USING) → (SET DEFAULT if the entity declares a default)`, with down restoring the original DEFAULT for full reversibility.

## Carryover to Sprint 231+

- **(ops verification) Confirm problem-service rollout after merge** — verify a new SHA pod is Running via `kubectl get pods -n algosu -l app=problem-service` = all 8/8 services on the latest image.
- (ops) live `/quiz` verification (`quiz-ui-verification` runbook, 221~229) / SP217 cutover / GA4 admin settings·UAT / harness --full cron — existing carryover retained.

## Critic Cross-Review

- **Tool**: Codex codex-cli 0.130.0 (`codex review --base f4493ac -c model=gpt-5.5` — the default gpt-5.3-codex is unsupported on ChatGPT accounts, so gpt-5.5 is specified).
- **R1 [P1]**: the spec was placed inside the `migrations/` directory → the built `*.spec.js` matches the migration glob, so `migration:run` would require it → init container crash risk (re-breaking the rollout path). → moved to `src/database/__tests__/` per D6, with empirical verification.
- **R2 CLEAN**: 0 findings — "drops defaults before changing varchar columns to jsonb and keeps the test outside the migrations glob, addressing the rollout failure without introducing an evident regression."
