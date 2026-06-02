---
sprint: 217
title: "Logged-in Record Integration (3-Sprint Roadmap 3/3)"
date: "2026-06-02"
status: completed
agents: [Oracle, Librarian, Architect, Postman, Critic]
related_adrs: ["sprint-215", "sprint-216"]
related_memory: ["sprint-window", "feedback-sprint-scoping"]
topics: ["frontend", "backend", "identity", "gateway", "quiz", "migration"]
tldr: "The finale (3/3) of the CS quiz 3-sprint roadmap. The best records that lived only in the frontend localStorage in 215 (minigame core) and 216 (150 questions + difficulty filter) are now persisted to the backend (identity_db) per logged-in user. Guests stay on localStorage, logged-in users branch to the server, and on login the localStorage records are merged up to the server once. The best-record granularity was expanded to a (user_id, category, difficulty) composite unique to match the difficulty filter that 216 shipped. The domain was placed in the identity service rather than a new quiz service (bootstrap cost too high) or submission_db (blurred boundary) — it shares a DB with User so userId consistency is natural and Gateway BFF routing sits next to the existing /auth and /studies. The architecture inherits the study-domain BFF pattern (Frontend fetchApi httpOnly Cookie → Gateway JWT middleware injects X-User-ID → Gateway QuizRecords BFF → IdentityClient X-Internal-Key → Identity QuizRecords InternalKeyGuard → TypeORM identity_db). The upsert uses a single atomic ON CONFLICT(user_id,category,difficulty) DO UPDATE WHERE best_score_percent < EXCLUDED query to avoid a TOCTOU race and guarantee higher-only. Thanks to 215's QuizRecordStore interface abstraction, the server swap was a zero-downtime implementation change after flipping the interface from sync to async. 4 atomic commits. Verification: Identity 99.87% stmt, Gateway 98.49%, Frontend 87.6% lines — all gates cleared. Critic backend R1 CLEAN; frontend R1 1 P2 (caching failures) resolved by a fix. Start commit 6e00ce6."
---
# Sprint 217 — Logged-in Record Integration (3-Sprint Roadmap 3/3)

## Goal

- **Persist the CS quiz best records to the backend per logged-in user** — records that lived only in the frontend `localStorage` in 215 and 216.
- Expand the best granularity to a **(category, difficulty) composite key** to match the difficulty filter 216 shipped.
- Branch guests to `localStorage` and logged-in users to the server, joining them seamlessly via a **one-time merge-up** on login.
- **Swap 215's `QuizRecordStore` abstraction for a server-API implementation with zero downtime.**

## Background

[Sprint 215](./sprint-215.md) completed the CS quiz minigame core and abstracted record persistence as a `QuizRecordStore` interface + a `createLocalStorageQuizStore` implementation, and [Sprint 216](./sprint-216.md) expanded the question bank to 150 and shipped the **difficulty filter UX** (while keeping the best-record key at category granularity — per-difficulty branching is a storage-schema change explicitly deferred to 217).

So 217 is the **finale** of the 3-sprint roadmap ([[feedback-sprint-scoping]]).

- **Sprint 215**: frontend minigame core (short-answer grading + play loop + the `QuizRecordStore` abstraction).
- **Sprint 216**: a broad question bank (5 categories, 150 questions) + difficulty filter + content lint.
- **Sprint 217 (this sprint)**: logged-in record integration — a `QuizRecord` entity + migration (identity_db), a Gateway BFF, the frontend storage server swap (guest/login branch + merge-up), and per-difficulty best.

The key is that 215's interface abstraction made the 217 server swap **zero-downtime** — flipping the interface from sync to async (`Promise`) and replacing the implementation from `createLocalStorageQuizStore` with `createApiQuizStore` finishes the backend integration.

## Decisions

### D0. Domain placement — extend the identity service (identity_db)

Place the quiz-record domain in the **identity service** (`identity_db`). The candidate new quiz service has a service-bootstrap cost (Dockerfile/CI/deploy/monitoring) out of proportion with the feature size, and `submission_db` blurs the boundary with the submission domain. identity shares the **same DB** as `User`, so `userId` consistency is natural, and the Gateway BFF routing slots in naturally next to the existing `/auth` and `/studies`. (User-confirmed)

### D1. best-key granularity — (user_id, category, difficulty) composite unique

Expand the best-record key to a **(user_id, category, difficulty) composite unique**. Because 216 shipped the difficulty filter UX, the record must also split per difficulty so that the best of "Network · Hard · 5 questions" does not mix with the best of "Network · Easy · 10 questions". The category-only key of 215/216 is finalized here by adding the difficulty dimension. (User-confirmed)

### D2. Scope — backend domain + server API + Gateway BFF + frontend storage server swap, all at once

Handle the scope **all at once**: (a) the Identity backend domain, (b) the server API, (c) the Gateway BFF, and (d) the frontend storage server swap (guest/login branch + merge-up). As the finale 3/3, integrating only part of the stack would leave records broken at some layer and invisible to the user. (User-confirmed)

### D3. Architecture — inherit the study-domain BFF pattern

Inherit the existing `study` domain's BFF pattern as-is. Rather than inventing a new communication protocol, reuse the proven path to keep the security (internal key) and authentication (JWT) layers consistent.

```
Frontend  fetchApi (httpOnly Cookie)
   │
Gateway   JWT middleware → injects X-User-ID
   │      QuizRecordsController (req.headers['x-user-id'])
   │      → Gateway QuizRecords service → IdentityClient.request (auto-injects X-Internal-Key)
   │
Identity  QuizRecordsController (@UseGuards InternalKeyGuard)
          → service.upsertBest / findByUser → TypeORM identity_db
```

- **Authentication**: the frontend sends only the httpOnly Cookie, and the Gateway JWT middleware verifies it and injects `X-User-ID`. The frontend does not know the userId (trust boundary preserved).
- **Internal security**: the Gateway→Identity hop is protected by `X-Internal-Key`, and Identity blocks direct external calls with `InternalKeyGuard`.

### D4. upsert concurrency — a single atomic ON CONFLICT WHERE query (avoid TOCTOU)

Handle the best update as a **single atomic query** to avoid the 3-step "read → compare → write" race (TOCTOU).

```sql
INSERT INTO quiz_records (...) VALUES (...)
ON CONFLICT (user_id, category, difficulty)
DO UPDATE SET best_score_percent = EXCLUDED.best_score_percent, ...
WHERE quiz_records.best_score_percent < EXCLUDED.best_score_percent
```

`WHERE ... < EXCLUDED` guarantees **higher-only** (only scores higher than the existing one update) at the DB level, and even with concurrent submissions the composite unique constraint + ON CONFLICT converge to a single row.

## Implementation

Branch `feat/sprint-217-quiz-record-sync`, start commit `6e00ce6`, 4 atomic commits. Backend (Identity + Gateway) + frontend.

### Commits

| Hash | Content |
|------|---------|
| `f431843` | feat(identity) — quiz-record domain: entity + migration + service(upsertBest/findByUser) + controller(InternalKeyGuard) + DTO + module + app.module registration + spec |
| `d06ad07` | feat(gateway) — quiz-record BFF: controller(X-User-ID extraction / 401 guard) + service(IdentityClient delegation) + IdentityClient methods + DTO + module + app.module(registered before the ProxyModule catch-all) + spec |
| `f12991a` | feat(frontend) — QuizRecordStore sync→async + difficulty + composite key + `createApiQuizStore` + guest/login branch + login merge-up + tests |
| `f938ae4` | fix(frontend) — Critic P2: don't cache failures in the api-store `getAllBest` catch + regression test |

### Identity (`f431843`)

- **entity** `quiz_records`: `id` uuid PK / `user_id` uuid `@Index` / `category` varchar(30) / `difficulty` varchar(10) `ALL|EASY|MEDIUM|HARD` / `best_score_percent` int / `played_at` timestamptz / `created_at` · `updated_at`. **Composite UNIQUE** `uq_quiz_records_user_category_difficulty(user_id, category, difficulty)`.
- **migration** `20260602000000-SP217-CreateQuizRecords.ts` — bidirectional `up`/`down`, honoring `synchronize:false`. (The ops `migration:run` is outside this sprint's scope — carried in [[sprint-window]].)
- **service** `upsertBest` — a single atomic `INSERT ... ON CONFLICT DO UPDATE WHERE best_score_percent < EXCLUDED` query (D4, avoids TOCTOU / higher-only) + `findByUser`.
- **controller** `@Controller('api/quiz-records')` `@UseGuards(InternalKeyGuard)` — `POST` / `GET by-user/:userId`, `{ data }` wrapping.
- `UpsertQuizRecordDto`(class-validator) + module + `app.module` registration + spec.

### Gateway (`d06ad07`)

- **controller** `@Controller('api/quiz-records')` — `POST` / `GET`. `extractUserId()` guards with **401** when `X-User-ID` is missing/non-UUID (the frontend does not know the userId, and only the Gateway JWT middleware injects the header).
- **service** — `IdentityClient` delegation.
- Added `saveQuizRecord`/`findQuizRecordsByUserId` to `identity-client.service.ts` (auto-injects `X-Internal-Key`, unwraps `{ data }`).
- `SaveQuizRecordDto` + module + `app.module` registration **before the `ProxyModule` catch-all** (specific routes first) + spec.

### Frontend (`f12991a`, `f938ae4`)

- Flipped the `QuizRecordStore` interface from **sync → async (`Promise`)** (the server integration is just an implementation swap on top of the 215 abstraction).
- Added `QuizPlayResult.difficulty`, made the best key composite as `${category}::${difficulty}`, and bumped the localStorage key to `algosu.quiz.records.v2` (isolating the schema change).
- New `api-store.ts` `createApiQuizStore` (`POST`/`GET` via `fetchApi`, converting the snake_case response `best_score_percent`/`played_at` → camelCase, in-memory cache, best-effort).
- `page.tsx` — branches guest/login via `useAuth`. On login it performs a **one-time merge-up** (localStorage → server, `Promise.allSettled`, higher-only idempotent, a `ref` flag prevents duplication). `finish`/`start` made async.
- Tests — storage / storage-ssr / api-store (new) / page.

### API contract

**Gateway (frontend, httpOnly Cookie):**

| Method | Path | Request | Response |
|--------|------|---------|----------|
| POST | `/api/quiz-records` | `{ category, difficulty, scorePercent, playedAt }` | `QuizRecord` (raw) |
| GET | `/api/quiz-records` | — | `QuizRecord[]` (raw) |

- `userId` comes from the `X-User-ID` header (injected by the Gateway JWT middleware). **401** when unauthenticated.
- The response is snake_case (converted to camelCase on the frontend).

**Identity (internal, X-Internal-Key):**

| Method | Path | Request | Response |
|--------|------|---------|----------|
| POST | `/api/quiz-records` | `{ userId, category, difficulty, scorePercent, playedAt }` | `{ data: QuizRecord }` |
| GET | `/api/quiz-records/by-user/:userId` | — | `{ data: QuizRecord[] }` |

## Verification

Oracle direct verification (after the Critic frontend P2 fix):

**Identity**

- `tsc --noEmit` → 0 / `lint` → 0 / `nest build` → 0
- `jest --coverage` → **271 suites PASS**, clears the gate (98%) — All files **99.87% stmt / 99.53% branch / 100% func / 100% line**, quiz-record **100%**

**Gateway**

- `tsc --noEmit` → 0 / `lint` → 0 / `build` → 0
- `jest --coverage` → **PASS**, clears the gate (branch 95 / func 96 / line 98 / stmt 98) — All **98.49 / 95.65 / 96.71 / 98.86**, quiz-record **100%**

**Frontend**

- `tsc --noEmit` → 0 / `next lint` → 0 errors / 0 warnings
- `jest --coverage` → **147 suites · 1484 tests PASS / 0 fail**, `lib/quiz` storage·api-store·grade **100%**, global lines **87.6%** (gate 83) · branches **78.96%** (gate 71)
- `next build` → ✓ Compiled, `ƒ /[locale]/quiz` 37.5kB (up from 216's 36.9kB, reflecting the server integration)

## Lessons

1. **An interface abstraction makes a later server swap zero-downtime** — because 215 abstracted persistence as a `QuizRecordStore` interface + a localStorage implementation, 217 finished the backend integration by flipping the interface from sync to async and replacing the implementation with `createApiQuizStore`. Isolating with an interface the boundaries where a future storage swap is anticipated structurally lowers the downstream cost.
2. **Inheriting a proven BFF pattern attaches a new domain quickly** — reusing the `study` domain's Frontend→Gateway(JWT)→Identity(Internal-Key) path kept the security and authentication layers consistent without designing them anew. Don't invent the protocol; inherit the proven path.
3. **A best-effort cache must "not cache failures"** — writing the failure fallback (an empty map) into the cache in the `api-store` `getAllBest` catch persists a transient network failure, blocking re-fetch and falsely flagging even a low score as "best updated!" (Critic P2). Cache only successes, and on failure don't write the value to the cache so the next call re-fetches.
4. **upsert concurrency via a single atomic ON CONFLICT WHERE query** — the 3-step "read → compare → write" is exposed to a TOCTOU race. A single `ON CONFLICT(...) DO UPDATE ... WHERE best_score_percent < EXCLUDED` query guarantees higher-only at the DB level and converges concurrent submissions to a single row.

## New Patterns

- **Interface-abstraction-based zero-downtime storage swap pattern** — separating persistence into a Store interface + an initial implementation (localStorage) lets a later sprint flip the interface to async and swap in a server-API implementation for a zero-downtime backend integration. A best-effort cache must **cache only successes** (never write the failure fallback into the cache) so a transient failure is not persisted.

## Sprint 218+ Carryover

- **Run the ops `identity_db` `migration:run` + server redeploy** (user/ops): merge ≠ live. Apply `20260602000000-SP217-CreateQuizRecords` to the ops `identity_db` (runbook pattern, same procedure as the [Sprint 196] migration) and redeploy.
- **Verify live `/quiz` server-record behavior** (user/ops): after redeploy, play `/quiz` while logged in → confirm server record save/lookup + the merge-up behavior on guest→login transition.
- **GA4 data stream URL consistency + Enhanced Measurement history page_view OFF + production page_view UAT** (user, carried from Sprint 210/211/212)
- **Run the ops Sprint 196 migration** (user/ops)
- **Review harness `--full` CI scheduled-run automation** (carried from Sprint 209)

## Critic Cross-Review

**Backend R1 — CLEAN** (Codex gpt-5.5, `codex review --base 6e00ce6`, codex-cli 0.130.0, session `019e85f4-3742-7300-bfcc-2301521906f9`)

> No actionable correctness issues; the quiz-record domain and BFF routing are wired consistently across Identity and Gateway.

- Critical / High / Medium / Low **0**.

**Frontend R1 — 1 P2** (Codex gpt-5.5, `codex review --base d06ad07`, session `019e8602-c95f-7421-9725-13341667d73c`)

> The `getAllBest` catch in `api-store.ts` caches a network failure as success via `cache = {}`. An empty map persists after a transient failure, blocking re-fetch, after which even a low score can be falsely flagged as "best updated!".

- **Action**: Author fix `f938ae4` — the catch no longer writes to `cache` and only does `return {}` (failures aren't cached, so the next call re-fetches). 1 regression test added. The fix matches the Critic's recommendation exactly and is localized, so R2 was skipped (saving credits); P2 resolved.
- Critical / High **0**.

**Final — CLEAN**. Backend R1 CLEAN; no regression after the frontend R1 P2 fix (`f938ae4`).
