---
sprint: 127
title: "Sprint 126 Follow-up — UNCLASSIFIED Difficulty Token + SWR Optimistic Consistency + Jest @messages Alias + Critic UUID Enforcement"
period: "2026-04-25"
status: completed
start_commit: 11b2d92
end_commit: 6cbdeb1
prs:
  - "#151 feat(frontend): Wave A — UNCLASSIFIED difficulty token + analytics chart symmetry (squash 6cbdeb1)"
  - "#152 refactor(frontend): Wave B+C+D — SWR optimistic + Jest @messages alias + locale-path @sync (squash 8baa57d)"
  - "#153 (closed) chore: Wave F — autoCritic requireSessionId flag (closed due to lack of enforcement)"
---

# Sprint 127 — Sprint 126 Follow-up + Critic Workflow Reinforcement

## Background

The goal is to close 4 seed items from Sprint 126 (B2 unclassified chart asymmetry, Wave C P3 SWR follow-up, B6 Jest alias introduction, Critic workflow check) in a single session.
**Wave E (Oracle A2 fs_usage demonstration) deferred due to `sudo` permission dependency → Sprint 128 carry-over (not a re-carry-over — blocked by permission)**.

PM principle: Critic Codex session ID UUID enforcement internalized in both infrastructure (`oracle-reap.sh`) and Critic persona (`critic.md`). Sprint 127 Wave F demonstration confirms that adding flag alone provides no enforcement — the enforcement point is script-side logic as SSOT, leading to PR #153 close.

### Sprint 127 Processing Status

| # | Item | Wave | Status |
|---|------|------|--------|
| 1 | UNCLASSIFIED difficulty token + analytics chart symmetry (Sprint 126 B2) | A | ✅ |
| 2 | handleStatusChange → useFeedbackDetail mutate (prevent modal stale) | B-1 | ✅ |
| 3 | dashboard/feedbacks SWR mocking tests added | B-2 | ✅ |
| 4 | Optimistic update pattern reinforcement (`mutate(updater, { optimisticData })`) | B-3 | ✅ |
| 5 | Jest moduleNameMapper `@messages/*` alias introduction (Sprint 126 B6) | C | ✅ |
| 6 | middleware ↔ client locale-path synchronization (`@sync` comment) | D | ✅ |
| 7 | Oracle A2 `fs_usage` hypothesis demonstration | E | ⏸️ Deferred → Sprint 128 (sudo permission dependency) |
| 8 | Critic workflow codex session ID UUID enforcement (oracle-reap.sh + critic.md) | F | ✅ (local infrastructure) |
| 9 | `.claude-team.json` `requireSessionId: true` addition | F | ❌ reverted (no enforcement → PR #153 closed) |

---

## Wave A — UNCLASSIFIED Difficulty Token + analytics Chart Symmetry (PR #151, squash `6cbdeb1`)

Owner: palette (design tokens), curator (enum separation), herald (i18n regression fix), critic (3 cross-reviews)

### Background (Sprint 126 B2 on-hold item)

`analytics/page.tsx` tag chart displays `unclassified` category but difficulty chart silently drops it. Required design system color token decision (Palette consultation), put on hold in Sprint 126. After agreeing on **Option A (display in both charts)**, proceeded in Sprint 127 Wave A.

### 1st Attempt (commit `9e63751`) — Simple enum extension

Added `UNCLASSIFIED` to `Difficulty` enum + gray token in `globals.css` (`--difficulty-unclassified: #94A3B8` Light / `#64748B` Dark).

### Critic 1st Review (`019dc214-3a86-7670-b068-c72041922ff0`) — P1+P2 Found

- **P1**: `DIFFICULTIES` enum extension breaks backend contract. `Difficulty` enum in `services/problem/src/problem/problem.entity.ts` only allows 6 types `BRONZE~RUBY` — if frontend sends `UNCLASSIFIED`, `400 Validation` occurs.
- **P2**: `Unclassified` exposed in filter pills but DB stores null → empty result regression when user selects it.

### 2nd Fix (commit `0ac64f3`) — Curator delegation, enum separation pattern

Separated `Difficulty` ↔ `DifficultyDisplay`:

- `Difficulty`: backend-compatible enum 6 types (`BRONZE | SILVER | GOLD | PLATINUM | DIAMOND | RUBY`)
- `DifficultyDisplay`: UI display-only 7 types (above 6 + `UNCLASSIFIED`)
- Form/filter/POST payload: `DIFFICULTIES` (backend contract protection)
- analytics charts only: `DIFFICULTIES_DISPLAY` (UI symmetric display)
- `constants.test.ts`: regression test ensuring separation of the two enums

### Critic 2nd Review (`019dc220-04a9-70c1-8a43-af94d550066d`) — P1/P2 Resolved, New P2 Found

- ✅ P1 resolved: Backend enum and UI enum fully separated, POST payload regression 0
- ✅ P2 resolved: Unclassified removed from filter pills (only `DIFFICULTIES` referenced)
- 🟡 New P2: English label regression in `AnalyticsCharts.tsx` — `'Unclassified'` hardcoded even for ko users (`row.tier === 'UNCLASSIFIED' ? 'Unclassified' : row.tier`)

### 3rd Fix (commit `bd66f54`) — Herald delegation, 1-line i18n branch

```tsx
{row.tier === 'UNCLASSIFIED' ? t('unclassified') : (DIFFICULTY_LABEL[row.tier])}
```

`unclassified` key added to each of `messages/ko/analytics.json` + `messages/en/analytics.json`.

### Critic 3rd Review (`019dc228-35b4-7080-91e0-048392ff4f58`) — ✅ Merge-ready

Follow-up observation: `DifficultyRow.tier` type is loosely `string` — narrowing to `DifficultyDisplay` is not a blocker, deferred as Sprint 128 seed.

### Change Summary

- 6 files, +73/-22 (`constants.ts` + `globals.css` + `analytics/page.tsx` + `AnalyticsCharts.tsx` + `DifficultyBadge.tsx` + `constants.test.ts`)
- i18n line 1 (`unclassified` key ko + en)
- Merge commit: `6cbdeb1` (squash)

---

## Wave B+C+D — SWR Optimistic + Jest @messages Alias + locale-path @sync (PR #152, squash `8baa57d`)

Owner: architect (B race fix), palette (B2 SWR mocking), direct application (C alias + D comment), critic (2 cross-reviews)

### B-1/B-3 — handleStatusChange detail mutate + optimistic pattern (commit `d92ae65`)

#### Changes

`admin/feedbacks/page.tsx` `handleStatusChange`:

1. Optimistic `mutateFeedbacks` update before PATCH call
2. If modal is open, simultaneous optimistic `mutateDetail` update
3. After PATCH completes, explicit `mutateFeedbacks() + mutateDetail()` calls → server-authoritative re-validation
4. On failure, `mutate()` rollback (`{ optimisticData, rollbackOnError: true }`)

#### Critic 1st Review P1 Found

- **P1**: `mutateFeedbacks(updater, { revalidate: true })` race condition. GET re-validation fires before PATCH completes, potentially overwriting optimistic with stale data.

### B-1 fix (commit `43ba8b0`) — Architect delegation, precise race resolution

- Changed to `mutateFeedbacks(updater, { revalidate: false })` (only optimistic applied, auto-revalidate disabled)
- Explicit `await mutateFeedbacks()` + `await mutateDetail()` at end of success path → authoritative re-validation after server response
- 2 regression tests added:
  - Deferred Promise controls PATCH completion timing → accurately verifies optimistic is not overwritten by GET response
  - On rollback, optimistic disappears and original data restored

### B-2 — admin/feedbacks SWR mocking tests 20 new (commit `8a0c600`)

New: `admin/feedbacks/__tests__/page.test.tsx` 20 cases
- SWRConfig wrapper + `mockFetcher` pattern (reusing Sprint 126 C1 use-study-stats test)
- Pagination + modal detail + status PATCH + filter change + skeleton regression

### C — Jest moduleNameMapper `@messages/*` alias (commit `37b24f0`)

#### Background (Sprint 126 B6)

`callback/page.test.tsx` referenced `messages/ko/auth.json` via 6-level relative import (`../../../../../../messages/ko/auth.json`) — high fragility.

#### Changes

- Added `"@messages/*": ["./messages/*"]` to `tsconfig.json` `paths` + `jest.config.ts` `moduleNameMapper`
- 16 deep relative imports in 3 files converted to `@messages/ko/auth.json` format
  - `app/[locale]/callback/__tests__/page.test.tsx`
  - `lib/__tests__/locale-path.test.ts`
  - 1 other file (analysis script)

### D — middleware ↔ client locale-path `@sync` comment (commit `6c9d1db`)

#### Background (Sprint 126 P3 follow-up)

`middleware.ts`'s `stripLocalePath` and `frontend/src/lib/locale-path.ts`'s `stripLocalePrefix` have the same logic but different runtimes:
- middleware: Edge runtime
- locale-path: Node + Browser

→ Module integration impossible, drift risk.

#### Changes

Added `@sync <relative-path>:<function-name>` cross-reference comment to both functions' JSDoc:

```typescript
/**
 * @sync frontend/src/lib/locale-path.ts:stripLocalePrefix
 * Cannot import client util due to Edge runtime. Synchronize both sides on drift.
 */
function stripLocalePath(pathname: string): string { ... }
```

### Critic 2nd Review (`019dc221-b4f4-7e30-9612-31de70cba6ba`) — P1 Resolved, 2 New P2 Items

- ✅ P1 race fully resolved. Regression test accurately mocks race using deferred Promise
- 🟡 New P2#1: When status filter is active, optimistic update leaves rows in non-matching categories (counts stale) → Sprint 128 seed carry-over
- 🟡 New P2#2: When two rows changed quickly, GET after first PATCH overwrites second optimistic — remaining race → in-flight PATCH count or row-scoped mutate needed → Sprint 128 seed carry-over

### Merge

- Merge commit: `8baa57d` (squash)

---

## Wave E — Oracle A2 fs_usage Demonstration (Deferred → Sprint 128 carry-over)

Owner: Deferred (user permission dependency)

### Background

Purpose: Demonstrate Sprint 125 D2 H1 hypothesis (`~/.claude/` path sensitive path protection suspected).
`sudo fs_usage -w -f filesys claude` command requires root permission → depends on user direct execution.

### Decision

- Sprint 127 single session: user sudo execution not performed → Sprint 128 carry-over
- **Not a re-carry-over — normal carry-over due to permission dependency block**
- Inbox path rename decision (`~/.claude/oracle/inbox` → `~/oracle-results`) made after verification results

---

## Wave F — Critic Workflow codex Session ID UUID Enforcement

Owner: direct application (local infrastructure), critic (1 cross-review)

### F-1 — `critic.md` (local, gitignored) reinforcement

- Session ID mandatory — removed "if available" expression
- UUID example explicitly stated (`019dc214-3a86-7670-b068-c72041922ff0` format)
- Sprint 127 Wave F verification note added (prevent recurrence of Sprint 126 Wave B Codex non-invocation case)

### F-2 — `~/.claude/oracle/bin/oracle-reap.sh` (local) UUID regex validation

- log codex session ID extraction pattern: `session id: [0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}`
- Task status marked as `failed_no_codex_session` when session ID absent
- New status included in `update_task_status` completion judgment function (auto-reject when Critic doesn't invoke codex)

### F-3 — PR #153 (closed)

Added `dispatch.autoCritic.requireSessionId: true` flag to `.claude-team.json` but user reverted.

#### Critic 1st Review (`019dc216-56b1-70c0-9bd9-91145b449502`) — Lack of Enforcement Flagged

- Repo change itself has 0 regressions but no enforcement — `oracle-reap.sh` UUID validation logic doesn't reference `.claude-team.json` flag. Flag alone provides 0 runtime enforcement.

#### Decision

- **PR #153 closed** — `.claude-team.json` side change is not the SSOT
- Enforcement is in local `oracle-reap.sh`'s hardcoded UUID validation logic, and `.claude/` is outside git tracking via `.gitignore` → repo-side PR is void
- Connecting `oracle-spawn.sh` to reference `.claude-team.json` flag deferred as Sprint 128 seed

---

## Decisions

1. **`Difficulty` ↔ `DifficultyDisplay` separation pattern**: UI display-only virtual categories must be separated from backend-compatible enums. Extending shared enums can simultaneously break frontend/backend contracts → recommend applying same pattern for subsequent sprints (e.g., `Status`/`StatusDisplay`, `Tier`/`TierDisplay`).
2. **SWR optimistic precise sequencing**: `mutate(updater, { revalidate: false })` for optimistic only → `await mutation()` → explicit `mutate()` on success for server-authoritative revalidation. `revalidate: true` causes race condition by firing GET before PATCH completes.
3. **`@sync` cross-reference comment**: Code with identical logic but different runtimes (Edge vs Node/Browser) cannot be extracted to a common module → codify synchronization requirement via `@sync` cross-reference comment when drift occurs. Intentional duplication + verification gate instead of module integration.
4. **autoCritic UUID enforcement**: Codex session ID UUID validation in both Critic persona + `oracle-reap.sh`. Claude solo analysis auto-rejected. `.claude-team.json` flag alone provides 0 enforcement → script-side logic is SSOT.
5. **PR #153 close decision**: Accept Critic's point that adding `.claude-team.json` flag alone provides 0 runtime enforcement. Enforcement point is local `oracle-reap.sh`'s UUID validation logic, and `.claude/` is outside git tracking via `.gitignore` → repo-side PR is void, only local infrastructure maintained.
6. **Wave E deferral**: `sudo fs_usage` permission dependency prevents execution in single session. Carry-over to Sprint 128 — designated as *planned follow-up not re-carry-over*. PM principle "0 carry-over" does not apply to permission-dependency blocks.

---

## Patterns

1. **Enum separation pattern**: `<Domain>` (backend contract enum) ↔ `<Domain>Display` (UI display-only extension) separation. POST/filters use `<Domain>`, charts/display use `<Domain>Display`. Separation guaranteed via regression tests.
2. **SWR race-free optimistic pattern**:
   ```typescript
   await mutate(updater, { revalidate: false, optimisticData, rollbackOnError: true });
   await fetch(...).then(...);
   await mutate();  // explicit revalidate (server-authoritative)
   ```
3. **`@sync` cross-reference comment pattern**: When module separation is forced (e.g., Edge runtime), both functions' JSDoc get `@sync <relative-path>:<function-name>` comment + synchronization requirement on drift codified.
4. **Local infrastructure SSOT principle**: Repo-side flags like `.claude-team.json` are *declarative policy*. Runtime enforcement is the SSOT in local scripts (`oracle-reap.sh`/`oracle-spawn.sh`) validation logic. Adding flag without script-side reference = 0 enforcement.

---

## Critic-Passed codex Session Cumulative Log

| Wave | Round | Session ID | Result |
|------|-------|------------|--------|
| Wave A | 1st | `019dc214-3a86-7670-b068-c72041922ff0` | P1+P2 found (backend contract + empty result regression) |
| Wave A | 2nd | `019dc220-04a9-70c1-8a43-af94d550066d` | P1/P2 resolved, new P2 (English label regression) |
| Wave A | 3rd | `019dc228-35b4-7080-91e0-048392ff4f58` | ✅ Merge-ready |
| Wave B | 1st | `019dc215-842c-7a21-b0f4-574827880ff6` | P1 race condition found |
| Wave B | 2nd | `019dc221-b4f4-7e30-9612-31de70cba6ba` | P1 resolved, 2 new P2 items deferred as seeds |
| Wave F | 1st | `019dc216-56b1-70c0-9bd9-91145b449502` | Lack of enforcement flagged → PR #153 closed |

---

## Metrics

| Metric | Value |
|--------|-------|
| Merged PRs | 2 (#151, #152). PR #153 closed (no enforcement) |
| Total commits (pre-squash) | 7 (Wave A 3 + Wave B 4) |
| Critic codex cross-reviews | 6 rounds (Wave A 3 + Wave B 2 + Wave F 1) |
| New regression tests | 22 (B-2 admin/feedbacks 20 + B-1 fix race 2) |
| New enum separations | 1 (`Difficulty` ↔ `DifficultyDisplay`) |
| New i18n keys | 2 (analytics.unclassified ko+en) |
| Jest path alias introduced | 1 (`@messages/*`) |
| `@sync` cross-reference comments | 2 (middleware + locale-path) |
| Sprint 126 seed closure | 4/5 (Wave E deferred to Sprint 128 due to permission dependency) |

---

## Lessons Learned

1. **Risk of shared enum extension**: Even adding just one value to an enum in the frontend can break backend validation via POST payload. UI display-only categories must be separated into a dedicated enum and enforced via regression tests. Sprint 127 Wave A's 1st commit was caught exactly on this point by Critic, resolved with 2nd separation commit.
2. **SWR `revalidate: true` anti-pattern**: `revalidate: true` in optimistic update causes GET to fire before PATCH completes, creating a race condition. Safe sequencing: apply optimistic only with `revalidate: false` → explicit `mutate()` in PATCH success path. Race accurately verifiable with deferred Promise regression tests.
3. **`@sync` comments prevent Edge runtime drift**: middleware (Edge) and client util (Node/Browser) are forced module-separated and cannot be unified. Documenting synchronization requirement via intentional duplication + `@sync` cross-reference comment is pragmatic. Consider adding verification gate (grep `@sync` then check diff of both sides) as future infrastructure work.
4. **Flag addition alone = 0 enforcement**: Added `requireSessionId: true` to `.claude-team.json` but `oracle-reap.sh` doesn't reference this flag → 0 runtime enforcement. Critic accurately identified this, PR #153 closed. Enforcement point is *script-side validation logic*, and repo-side flags are only declarative policy. SSOT is local infrastructure.
5. **Separating permission-dependent work**: Permission-dependent tasks like `sudo fs_usage` not executing in a single session is normal. Don't force it — carry over to Sprint 128 and explicitly designate as *planned follow-up not re-carry-over*. PM principle "0 carry-over" does not apply to permission-dependency blocks.

---

## Sprint 128 Seeds (not re-carry-overs — new findings and follow-ups)

### SWR + Concurrency (Sprint 127 Wave B Critic 2nd round findings)

- [ ] admin/feedbacks: when status filter active, optimistic update leaves rows in non-matching categories (counts stale) → add filter consistency validation
- [ ] admin/feedbacks: when two rows changed quickly, GET after first PATCH overwrites second optimistic — remaining race → introduce in-flight PATCH count or row-scoped mutate

### Oracle Infrastructure (Sprint 126→127 carry-over, permission dependency block)

- [ ] Wave E: `sudo fs_usage -w -f filesys claude` to demonstrate H1 hypothesis (`.claude/` sensitive path protection) → decide whether to proceed with path rename

### Critic Workflow (Sprint 127 Wave F reinforcement)

- [ ] Connect `oracle-spawn.sh` to reference `.claude-team.json` `dispatch.autoCritic.requireSessionId` flag (currently only `oracle-reap.sh`'s hardcoded UUID validation works)

### Technical Debt (Sprint 127 Wave A Critic 3rd round observation)

- [ ] Narrow `AnalyticsCharts.tsx` `DifficultyRow.tier` from `string` → `DifficultyDisplay` (not a blocker, follow-up work)
