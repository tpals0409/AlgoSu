---
sprint: 196
title: "problem.tags/allowed_languages jsonb Migration + Server-Side Tag Filter + Seed Expansion"
date: "2026-05-22"
status: completed
agents: [Oracle, Curator, Herald, Critic]
related_adrs: []
related_memory: ["sprint-window"]
topics: ["data-modeling"]
tldr: "Migrated the Problem service's tags and allowed_languages columns from varchar(500) to PostgreSQL native jsonb (resolving the entity simple-json ↔ physical varchar definition mismatch), and fully implemented a server-side tag filter API (GET /search/tags, OR default / mode=and toggle) backed by jsonb @> containment + a GIN index (jsonb_path_ops). The frontend was wired up with a hybrid UI (server tag chips + the existing search-box client filter); seed data expanded 6→15. The Gateway is a pure passthrough, so no changes. Critic (Codex gpt-5.5) ran 6 rounds — Critical/High 0, with 5 P2 findings (align tag-filter status set & ordering with /all, protect the CONCURRENTLY index build's statement_timeout, revalidate the unfiltered cache after add, reset tags on study switch) all resolved before a clean R6. Backend jest 183 pass, frontend 1374+ pass, tsc 0, ESLint 0, CI green. PR #345 squash → 41e2ca3."
---
# Sprint 196 — problem.tags/allowed_languages jsonb Migration + Server-Side Tag Filter + Seed Expansion

## Goal

- Migrate the Problem service's `tags`·`allowed_languages` from `varchar(500)` → PostgreSQL native `jsonb` to **resolve the entity (simple-json) ↔ physical column (varchar) definition mismatch**.
- Establish an **efficient tag-query foundation** via jsonb `@>` containment + a GIN index (`jsonb_path_ops`), and fully implement a server-side tag filter API (`GET /search/tags`).
- Wire the tag filter into the frontend and **expand seed data 6→15** with tag diversity.

## Background

- `problem.entity.ts` declared `tags`·`allowed_languages` as `@Column('simple-json')` → TypeORM serialized them as JSON text, so at the JS level they behaved as `string[]`, but the **physical DB columns were `varchar(500)`** (`1700000100002-AddTagsColumn.ts`, etc.), leaving definition and implementation out of sync.
- API responses, DTOs, and the frontend all use `string[]` consistently → whether simple-json or jsonb, the API contract is identical (`string[] | null`), so there is no frontend breakage risk.
- **The server-side tag filter was absent**. The frontend handled it only via a search-box-integrated client filter (`p.tags?.some(...)`), so the goal's "tag-based classification/filter foundation" was the unimplemented area.
- dual-write is an active structure (old DB + new DB), but `DUAL_WRITE_MODE=off` currently, and per `.env.example` the new DB points to the same instance as the old DB → physical separation / dual-write inactive.
- The `tags ILIKE '%"sql"%'` pattern in `1709000017000-BackfillSqlCategory.ts` is a **past migration**, so the jsonb migration (a later timestamp) is safe with respect to execution order.

## Decisions

### D1. Scope — Migration + Full Filter API (user, AskUserQuestion)

- ① Scope = column migration + GIN + **full server-side tag filter implementation + frontend integration** ② Column type = `jsonb` ③ `allowed_languages` migrated alongside ④ seed expanded to 12~15.

### D2. New DB Migration — Runbook Procedure Only (user)

- With `DUAL_WRITE_MODE=off` (new DB = same instance as old DB), there are no new-DB writes for now. `dual-write.module.ts` lacks an automatic new-DB migration path. → No code auto-path / new data-source introduced; only documented the "apply the same migration to the new DB (`NEW_DATABASE_*`) when dual-write is active" procedure in `docs/runbook/db-migration.md` (for a future EXPAND/SWITCH_READ transition).

### D3. Endpoint — New GET /search/tags, OR Default (user)

- New `GET /search/tags?tags=&mode=` — declared above `@Get(':id')` (NestJS declaration-order matching, so the `search` literal avoids a UUID-parse 400). Default matching `or` (`mode=and` toggles to intersection). Encoding is repeated `?tags=a&tags=b` (NestJS @Query array convention; Korean tags URL-encoded).

### D4. Frontend — Hybrid + Tag Chips (user)

- plumbing (swr/api/hook) + a tag-selection chip row in the problem list (difficulty-pills pattern). **Keep the existing search-box client filter** (free text = search box, discrete tag selection = server filter; intersection when both apply).

### D5. Tag-Filter Consistency — Align status & ordering with findAllByStudy (Oracle reversal, Critic P2)

- The plan specified the tag filter as `ACTIVE` only / `weekNumber DESC` (the findActiveByStudy pattern), but it emerged that the **frontend replaces `/all` (findAllByStudy = ACTIVE+CLOSED, weekNumber ASC) in a hybrid structure**, and Critic flagged 2 consistency defects (P2). → Reversed so the tag-filter endpoint **fully aligns its status set (ACTIVE+CLOSED) and ordering (weekNumber ASC, createdAt ASC) with `findAllByStudy`**. (Reversal rationale: the same UI toggles between the two endpoints via tags, so the dataset and ordering must be consistent.)

## Implementation

### Implementation commits (8 commits, PR #345 squash → `41e2ca3`)

- `45f7952` feat(problem) — Part A backend
  - New `migrations/20260522120000-SP196-TagsAllowedLanguagesToJsonb.ts`: tags·allowed_languages varchar(500)→jsonb (`USING CASE WHEN col IS NULL THEN NULL ELSE col::jsonb END`), GIN index `idx_problems_tags_gin` (`jsonb_path_ops`, CONCURRENTLY outside transaction), best-effort down()
  - `problem.entity.ts`: simple-json → jsonb (2 columns, API response `string[]` unchanged)
  - `dual-write.service.ts`: `findByTagsContaining` (via readRepo, AND=single `@>`, OR=Brackets)
  - `problem.service.ts`: `findByTags` / `problem.controller.ts`: `GET /search/tags` (before :id) / new `dto/query-problem.dto.ts` (`@Transform` single→array, `mode @IsIn`)
  - `scripts/demo-seed-problem.sql`: 6→15 (tag diversity, Weeks 1~5) / `docs/runbook/db-migration.md`: new-DB procedure / service·controller·dual-write specs
- `444b445` feat(frontend) — B1+B4 plumbing (swr cacheKeys URLSearchParams, api findAll(params?), use-problems tags threading) + tests
- `609f222` feat(frontend) — B2 tag chip UI + i18n (ko/en) + hybrid filter (2-hook: allProblems + filtered)
- `a59c606` fix(problem) — [Critic R1 P2] findByTags status `[ACTIVE]` → `[ACTIVE, CLOSED]` (findAllByStudy alignment)
- `8e3e75b` fix(problem) — [Critic R2 P2] findByTagsContaining ordering `weekNumber DESC` → `ASC` (findAllByStudy alignment)
- `9bb477a` fix(problem) — [Critic R3 P2] migration re-sets session-level `SET statement_timeout=0` after COMMIT (SET LOCAL is lost at COMMIT → protect the CONCURRENTLY index build)
- `7ec0bb0` fix(frontend) — [Critic R4 P2] add `mutateAllProblems()` on problem add (prevent the unfiltered cache of the 2-hook from going stale)
- `2f227c8` fix(frontend) — [Critic R5 P2] `useEffect(() => setSelectedTags([]), [activeSid])` — reset stale tags on study switch

## Verification

- **Type/build**: `tsc --noEmit` 0 (problem + frontend). ESLint **0 errors** (both).
- **Tests**: backend jest **183 pass / 0 fail** (coverage statements 99.14%·branches 96.69%·functions 98.48%·lines 99.05%, thresholds passed). frontend **1374+ pass / 0 fail** (lines 86.34%/branches 78.32%/functions 83.72%, thresholds 83/71/82 passed).
- **Critic**: `codex review --base main` (gpt-5.5) **6 rounds** — Critical/High **0**. 5 P2 findings (D5 status·ordering ×2, migration timeout, cache revalidation, study-switch reset) all resolved → clean R6 ("no evident discrete bug that would break existing behavior, type checking passes").
- **CI #345**: all jobs pass/skip, **fail 0** (`MERGEABLE`/`CLEAN`) → Squash merge.
- **Tag-filter query**: jsonb `@>` containment — AND=single `tags @> :tags::jsonb` (GIN-backed), OR=`Brackets` per-tag `@>` OR. studyId+status scoping.

## Lessons / Patterns

- ① **A new endpoint that "replaces X" must match X's dataset and ordering exactly** — since the frontend toggles between `/all`↔`/search/tags` via tags in a hybrid, a different status set (ACTIVE+CLOSED) or ordering (weekNumber ASC) causes empty lists / reordering on toggle. Critic caught two P2s in a row (R1·R2) → the gap between a backend-only view (findActiveByStudy) and the frontend usage context (replacing findAllByStudy) was the root of the consistency defects.
- ② **`SET LOCAL` is lost at COMMIT — out-of-transaction work (CONCURRENTLY) needs a session-level reset** — in the migration up(), `SET LOCAL statement_timeout=0` only protects ALTER TYPE (in-transaction). The `CREATE INDEX CONCURRENTLY` after `COMMIT` runs with the original timeout (production 200ms) and can be canceled on large tables → re-set session-level `SET statement_timeout=0` (without LOCAL) right after COMMIT.
- ③ **A 2-hook (all + filtered) pattern requires invalidating both** — when two SWR keys for the same data (unfiltered allProblems + filtered) are used, both must be revalidated after a mutation to avoid staleness. Also reset filter state (selectedTags) on context (activeSid) change to block stale carry-over.
- ④ **simple-json → jsonb keeps the API contract unchanged** — TypeORM exposes both as `string[]`, so no frontend·gateway·DTO changes are needed. The substance of the "JSON migration" is the physical column type + indexing/query capability.

## New Patterns

- **Tag/array filters: jsonb + GIN(jsonb_path_ops) + `@>` containment** — AND=single containment (max index usage), OR=`Brackets` grouping single-element `@>` ORs. Filter queries go through DualWriteService (readRepo) to keep dual-write read-switch consistency.
- **"Replacement endpoint" consistency checklist** — when a new filter/search endpoint replaces an existing list endpoint in the UI, compare against the original on ⓐ status set ⓑ ordering ⓒ cache invalidation ⓓ state carry-over.
- **CONCURRENTLY index migration**: COMMIT → session-level `SET statement_timeout=0` → `CREATE INDEX CONCURRENTLY` → BEGIN (out-of-transaction work is outside LOCAL protection).

## Carryover

- **Operational migration run + server redeploy** (user/ops): `npm run migration:run` on problem_db → apply jsonb migration + GIN index (runbook `SET statement_timeout=0` procedure).
- (Optional) **app.module bootstrap smoke test** → Sprint 197 (defend the whole DI graph, TypeORM mock).
- (Optional) **CI PYTHON_VERSION 3.12 → 3.13** bump (separate sprint).
- Cumulative UAT (user-driven): Programmers re-submission grading / English production Grafana CB dashboard / Sprint 160~196 cumulative.
