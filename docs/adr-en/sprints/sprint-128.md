---
sprint: 128
title: "Sprint 127 Follow-up — admin/feedbacks SWR Concurrency + Oracle SSOT Integration + AnalyticsCharts Type Narrowing"
period: "2026-04-25"
status: completed
start_commit: 2bd3dfe
end_commit: b50347c
prs:
  - "(Integrated PR planned) Sprint 128 Wave A+B-1+C: admin/feedbacks concurrency + .claude-team.json flag + DifficultyDisplay type narrowing"
---

# Sprint 128 — Sprint 127 Follow-up + Oracle SSOT Integration Wrap-up

## Background

Closing 4 seeds from Sprint 127 (admin/feedbacks concurrency P2 2 items, Oracle Wave F flag not connected,
AnalyticsCharts type narrowing) in a single session. All are follow-up enhancements, not regression fixes,
and are items handed over from Critic 2nd/3rd observation.

PM principle: Following the PR #153 close decision in Sprint 127 Wave F, wrapping up the remaining
"policy + enforcement" SSOT unintegrated state in this sprint. Connecting the `.claude-team.json` flag
and `oracle-reap.sh` validation logic via env var so both point to the same truth. Unlike PR #153
which only added the flag, enforcement (reap logic) now works together.

### Sprint 128 Processing Status

| # | Item | Wave | Status |
|---|------|------|--------|
| 1 | admin/feedbacks status filter consistency (remove rows outside listUpdater scope + update counts) | A-1 | ✅ |
| 2 | admin/feedbacks concurrent PATCH in-flight race (useRef counter gating) | A-2 | ✅ |
| 3 | admin/feedbacks regression tests 5 new (filter consistency 3 + concurrent race 2) | A-3 | ✅ |
| 4 | `.claude-team.json` `dispatch.autoCritic.requireSessionId: true` reintroduction | B-1 | ✅ |
| 5 | `oracle-spawn.sh` env var passing + `oracle-reap.sh` flag branching | B-2 | ✅ (local infra) |
| 6 | `critic.md` persona wording sync (`requireSessionId` flag explicit) | B-3 | ✅ (local infra) |
| 7 | `AnalyticsCharts.DifficultyRow.tier`: `string` → `DifficultyDisplay` | C-1/C-2 | ✅ |
| 8 | analytics test fixture UPPER_CASE alignment + `UNCLASSIFIED` case | C-3 | ✅ |

---

## Wave A — admin/feedbacks SWR Concurrency Remaining P2 2 Items (commit `ed5d831`)

Assigned: architect (implementation), critic (planned — cross-review before merge)

### Background (Sprint 127 Critic 2nd Observation)

In Sprint 127 Wave B, the `revalidate: false` pattern blocked GET preceding race for single PATCH,
but two remaining scenarios were identified in Critic 2nd review:

1. **Filter consistency (P2)**: With `statusFilter='OPEN'` active, changing a row to RESOLVED →
   row persists in optimistic stage → suddenly disappears after PATCH completion triggers GET revalidation (unnatural UX).
   counts card also not synchronized.
2. **Concurrent PATCH race (P2)**: Quickly changing `fb-1`/`fb-2` two rows → PATCH2 response arrives before PATCH1
   → GET triggered by PATCH2 success reflects PATCH1 incomplete state (server still has `fb-1` as OPEN) in cache
   → cache inconsistency.

### A-1 — listUpdater Filter Consistency

Added `statusFilter` closure capture to `listUpdater` inside `handleStatusChange`. Added filter step after items.map
(exclude rows where `statusFilter !== 'ALL' && fb.publicId === publicId && newStatus !== statusFilter`).
Extracted previous status with `current.items.find(...)?.status` and performed optimistic counts -1/+1 update
(category counts like `cat:BUG` are unaffected by status changes, so they are preserved).

### A-2 — useRef in-flight Counter

Option comparison:

| Option | Complexity | Adopted |
|--------|-----------|---------|
| `useRef<number>(0)` counter | Medium | ✅ |
| row-scoped SWR key (`/api/feedbacks/{id}/row`) | High (backend endpoint needed) | ❌ |
| debounced revalidation | Medium | △ (race not fully blocked) |

Adopted: `inFlightRef`. +1 on PATCH start, -1 in finally block. Only call `mutateFeedbacks()` +
`mutateDetail()` when 0 → GET revalidation triggered only after all PATCHes complete.

Additional simplification: removed existing `isDetailOpen` branching closure. Always call `mutateDetail()`
when in-flight is 0 (safe since SWR is no-op when selectedPublicId is null). Avoids potential omission cases
when two PATCHes have different `isDetailOpen` values.

### A-3 — 5 New Regression Tests

Reused existing deferred promise + `mockFetcher.mock.calls.length` counting pattern.

- Filter consistency 3 items: row removal on out-of-scope change / row retention with ALL filter / counts -1+1 update
- Concurrent race 2 items: PATCH2 resolves first → GET pending before PATCH1 completes / PATCH failure finally counter decrement

Total admin/feedbacks tests: **22 → 27 passing**, Jest global: **1388 → 1398 passing**.

### Change Summary

- 2 files, +196/-14
  - `frontend/src/app/[locale]/admin/feedbacks/page.tsx` (handleStatusChange restructuring, +28/-14)
  - `frontend/src/app/[locale]/admin/feedbacks/__tests__/page.test.tsx` (+168 new describe blocks x2)

---

## Wave B — Oracle SSOT Integration (commit `d4c27a1` + local infra)

Assigned: architect (`.claude-team.json` + `oracle-spawn.sh` + `oracle-reap.sh`), scribe (`critic.md` wording sync)

### Background (Sprint 127 Wave F PR #153 Close Reason)

Sprint 127 Wave F introduced hardcoded UUID validation in `oracle-reap.sh` and separately added
`.claude-team.json` `dispatch.autoCritic.requireSessionId: true` flag, but **flag and validation logic were not connected**
— Critic 1st (`019dc216`) pointed out "no enforcement" → PR #153 closed.
SSOT maintained as `oracle-reap.sh` alone.

Sprint 128 goal: Reintroduce flag + connect reap logic branching for "policy + enforcement" SSOT integration on both sides.

### B-1 — `.claude-team.json` Flag Reintroduction

```json
"autoCritic": {
  "enabled": true,
  "trigger": "commitDetected",
  "method": "codex review --base <HEAD_BEFORE>",
  "requireSessionId": true
}
```

Default `true` preserves existing behavior. Opt-out requires explicit `false` setting.

### B-2 — `oracle-spawn.sh` env Passing + `oracle-reap.sh` Flag Branching

`oracle-spawn.sh` cleanup trap (just before calling `oracle-reap.sh`):

```bash
export REQUIRE_CODEX_SESSION_ID=$(jq -r '.dispatch.autoCritic.requireSessionId // "true"' \
  "${project_dir}/.claude-team.json" 2>/dev/null || echo "true")
```

`oracle-reap.sh` UUID validation block (L89~95):

```bash
local require_sid="${REQUIRE_CODEX_SESSION_ID:-true}"
if ! grep -qiE 'session id: <UUID>' "$inbox_file" 2>/dev/null; then
  if [[ "$require_sid" == "true" ]]; then
    status="failed_no_codex_session"
    warn "...→ Refusing Claude-only analysis"
  else
    warn "...(requireSessionId=false → warning only)"
  fi
fi
```

**dry-run validation** results:
- `REQUIRE_CODEX_SESSION_ID=true` + UUID missing → `failed_no_codex_session` ✅
- `REQUIRE_CODEX_SESSION_ID=false` + UUID missing → `completed` (warning only) ✅
- Default (no env) → treated as `true` preserving existing behavior ✅

### B-3 — `critic.md` Wording Sync

Toned down L50 `**Session ID Validation**` entry and L70 report format "required, result invalid if absent"
to "Required by default (toggleable via `.claude-team.json` `requireSessionId` flag). Flag changes require
Architect consultation". Actual enforcement delegated to flag and reap logic.

### Change Summary

- git tracked: `.claude-team.json` 1 file, +2/-1
- Local infra (gitignored): `oracle-spawn.sh` env export 1 line + `oracle-reap.sh` branching 6 lines + `critic.md` wording 2 lines

---

## Wave C — AnalyticsCharts Type Narrowing (commit `e92fad8`)

Assigned: herald (type + test fixture)

### Background (Sprint 127 Critic 3rd Observation)

In Sprint 127 Wave A, the `Difficulty` ↔ `DifficultyDisplay` enum separation was completed, but
`AnalyticsCharts.tsx`'s `DifficultyRow.tier` remained as `string` with unsafe cast
(`DIFFICULTY_LABELS[row.tier as DifficultyDisplay] ?? row.tier`) remaining. Handed over as Sprint 128 seed.

### C-1/C-2 — Type Narrowing + Cast Removal

```diff
- interface DifficultyRow { tier: string; count: number; color: string; }
+ interface DifficultyRow { tier: DifficultyDisplay; count: number; color: string; }

- DIFFICULTY_LABELS[row.tier as DifficultyDisplay] ?? row.tier
+ DIFFICULTY_LABELS[row.tier]
```

`DifficultyDisplay` is already imported, so no new import needed. Since `DIFFICULTY_LABELS` defines
all 7 entries (including `UNCLASSIFIED`), the `?? row.tier` fallback can also be safely removed.

### C-3 — Test Fixture UPPER_CASE Alignment

`Analytics.test.tsx` L56~59 fixture was written with `'Silver'`/`'Gold'` (PascalCase), inconsistent with the new type.
Changed to `'SILVER'`/`'GOLD'` (UPPER_CASE) + 1 `'UNCLASSIFIED'` case added.
Total solution count assertion 14 → 17.

### C-4 — Data Supplier Verification

`analytics/page.tsx` L209~221 `useMemo` `difficultyData` already supplies `DifficultyDisplay` type values
as `tier: d.key` — no changes needed. Verified `tsc --noEmit` passes after type narrowing.

### Change Summary

- 2 files, +6/-5 (`AnalyticsCharts.tsx` type + branching simplification, `Analytics.test.tsx` fixture)
- analytics Jest: 6 tests passing

---

## Critic Cross-Review Cycle (codex)

Total 3 cycles: P2 2 items + P3 1 item found → immediately fixed → 3rd cycle passed:

| Round | session ID | Found | Applied commit |
|-------|-----------|-------|----------------|
| 1st | `019dc268-054a-7021-b18f-bcff6903cb73` | P2 (missing immediate rollback on failed PATCH) + P3 (filter total mismatch) | `80ff49c` |
| 2nd | `019dc26b-3934-7e13-af09-89ae28fb18fe` | P2 (page out-of-range on total decrease) | `b50347c` |
| 3rd | `019dc26e-15c8-7a21-a244-26be25a21025` | ✅ Ready to merge — "tracked changes appear internally consistent" | — |

## Verification Results

- `npx tsc --noEmit`: passed
- `npx next lint`: 0 new warnings (only existing inline style warnings remain)
- `npx jest`: **130 suites, 1400 tests** passing (1388 → +12 new: admin/feedbacks 7 + analytics 5)
- Wave B dry-run: flag true/false both scenarios behaved as expected
- Critic 3rd codex passed (UUID forced validation passed)

## Agent Collaboration

| Agent | Responsibility |
|-------|---------------|
| architect | Wave A concurrency fix + Wave B-1/B-2 oracle infra connection |
| herald | Wave C type narrowing + test fixture |
| scribe | Wave B-3 critic.md persona wording sync |
| critic | (planned) codex cross-review before merge |

## Follow-up Seeds (Sprint 129 — new follow-up, not re-carried)

- (none) All 4 seeds closed in Sprint 128. Can add more if Critic cross-review reveals new findings.

## Learning Notes

- **Local infra + git tracked SSOT separation**: `.claude/` is gitignored, `~/.claude/` is external environment.
  Connecting flag (repo) and enforcement logic (local script) via env var allows maintaining single truth
  even across separate locations. This pattern can be reused for other policy-enforcement separation cases.
- **Closure-captured `isDetailOpen` trap**: Branching dependent on closure variables in async finally blocks
  risks stale snapshots during concurrent calls. Simpler to use the in-flight counter to decide
  synchronization timing only, and delegate branching to SWR no-op.
