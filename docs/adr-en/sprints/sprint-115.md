---
sprint: 115
title: "Phase E Verification — Critic Codex Cross Code Review Demo and Bug Fixes"
period: "2026-04-22"
status: complete
start_commit: 24ac1b7
end_commit: 35ccc2b
---

# Sprint 115 — Phase E Verification — Critic Codex Cross Code Review Demo and Bug Fixes

## Background

In Sprint 114, the Critic (reviewer) agent was established and Codex CLI installation, persona, and pipeline integration were completed, but **Phase E (actual demo verification)** was carried over due to waiting for user login. This sprint executes the carried-over Phase E to prove Critic's real-world value and fix defects found during review.

The verification target is Sprint 113's SWR data fetching standardization commits (`75cb80f..e4f0641`), also demonstrating the Codex CLI direct call bypass path (`codex review --base <SHA>`) as an alternative to Claude Code built-in slash commands.

## Goals

| Phase | Content | Status |
|-------|---------|--------|
| E1 | Verify Codex CLI direct call path (`codex review --base`) | ✅ Complete |
| E2 | Sprint 113 SWR commit 1st review — P2 2 issues found | ✅ Complete |
| E3 | P2 fix commit (`24ac1b7`) + re-review — P1 1 issue found | ✅ Complete |
| E4 | P1 fix commit (`35ccc2b`) + final review — no regression confirmed | ✅ Complete |

---

## Decisions

### D1. SWR Key Strategy = `[path, studyId]` Tuple

**Background**: SWR cache key was composed of API path only, causing cache contamination where previous study data remained when switching studies.

**Options**:
- (A) Keep single `path` string key + full invalidation via `invalidateAllCache()` on switch
- (B) **`[path, studyId]` tuple key** ← selected — studyId included in key enables automatic cache separation

**Selected**: (B) — Tuple key leverages SWR's automatic cache separation, reducing dependency on `invalidateAllCache()` and immediately isolating previous study data on study switch.

**Result**: SWR keys changed to `[path, studyId]` in `use-problems.ts` and `use-submissions.ts`.

---

### D2. Error Display = SWR error Direct Binding

**Background**: The existing pattern had a dual structure of local error state via `useState` and copying SWR error via `useEffect`. The local state persisted even after error resolution, leaving stale errors in the UI.

**Options**:
- (A) Keep local error state + `useEffect` copy pattern + add clear logic
- (B) **SWR `error` direct binding** ← selected — use `problemsError?.message` directly, `mutate()` retry on onClose

**Selected**: (B) — Since SWR manages error state internally, local state duplication is unnecessary. `mutate()` call causes SWR to automatically update errors, fundamentally resolving state sync issues.

**Result**: Local error state removed from `problems/page.tsx` and `submissions/page.tsx`, SWR error referenced directly.

---

### D3. `invalidateAllCache()` in `setCurrentStudy` = Maintain as safety net

**Background**: Since D1 achieves cache separation via tuple keys, the `invalidateAllCache()` call inside `setCurrentStudy` appears unnecessary.

**Options**:
- (A) **Maintain (safety net)** ← selected — prepared for hooks not yet using tuple keys
- (B) Remove — assume tuple keys cover completely

**Selected**: (A) — Maintain as safety net until all SWR hooks are fully migrated to tuple keys. Removal to be done in a separate sprint after complete tuple migration.

---

### D4. SWR 2.x fetcher = Detect tuple key then extract path

**Background**: Found as P1 in Critic re-review. SWR 1.x spreads array keys as `...args`, but **SWR 2.x passes array keys as a single tuple argument**. The initial `swrFetcher(...args)` signature was incompatible with SWR 2.x.

**Options**:
- (A) Receive via rest params spread (SWR 1.x approach)
- (B) **`string | readonly [string, ...]` signature + `Array.isArray` branch** ← selected

**Selected**: (B) — Detect whether it's a tuple according to SWR 2.x official behavior, extract first element as path if it is. Stable for future SWR version upgrades.

**Result**: `swrFetcher` signature in `swr.ts` changed to `string | readonly [string, ...]`, `Array.isArray` branch added. Same type applied to test mocks.

---

### D5. Critic Re-review = Mandatory 1 re-verification after P2 fixes

**Background**: Running re-review on the commit that fixed P2 issues from the 1st review revealed a new P1 issue from the fix itself. This empirically proved that "fixed so it's done" is a dangerous assumption.

**Options**:
- (A) Skip re-review after P2 fix (prioritize credit savings)
- (B) **Mandatory 1 re-verification after P2 fix** ← selected — minimize credits while catching P1 in fixes

**Selected**: (B) — A balance point that minimizes Codex credit consumption while catching secondary defects in fix commits. This sprint actually found a P1, proving the value.

**Result**: Established principle of "minimum 1 re-review after P2+ fixes" in Critic operating rules.

---

## Phase E Verification Results

| Step | Content | Result |
|------|---------|--------|
| 1 | Codex CLI direct call (`codex review --base <SHA>`) | ✅ Bypass path proven without `/codex:*` slash commands |
| 2 | ChatGPT device-auth login status check | ✅ No re-login required |
| 3 | Confirmed `--base` and `[PROMPT]` cannot be used simultaneously | ✅ Mutual exclusion confirmed |
| 4 | 1st review: Sprint 113 SWR commits | P2 2 issues found (cache contamination + error persistence) |
| 5 | P2 fix + re-review | P1 1 issue found (SWR 2.x tuple key passing behavior) |
| 6 | P1 fix + final review | ✅ No regression, ready to merge |

---

## Key Outputs

**Modified 7** (commit `24ac1b7`):
- `frontend/src/hooks/use-problems.ts` — SWR key migrated to `[path, studyId]` tuple
- `frontend/src/hooks/use-submissions.ts` — SWR key migrated to `[path, studyId]` tuple
- `frontend/src/lib/swr.ts` — swrFetcher rest params added (initial attempt)
- `frontend/src/app/(main)/problems/page.tsx` — SWR error direct binding, local state removed
- `frontend/src/app/(main)/submissions/page.tsx` — SWR error direct binding, local state removed
- `frontend/src/hooks/__tests__/use-problems.test.tsx` — tuple key test updates
- `frontend/src/hooks/__tests__/use-submissions.test.tsx` — tuple key test updates

**Modified 3** (commit `35ccc2b`):
- `frontend/src/lib/swr.ts` — swrFetcher signature `string | readonly [string, ...]` + `Array.isArray` branch
- `frontend/src/app/(main)/settings/page.test.tsx` — test mock type fix
- `frontend/src/components/__tests__/NotificationBell.test.tsx` — test mock type fix

---

## Risks & Mitigation

- **R1 SWR 2.x compatibility**: Fetcher argument passing behavior differs between SWR major versions — `Array.isArray` branch handles both 1.x/2.x
- **R2 Unconverted hooks remaining**: SWR hooks not yet migrated to tuple keys may still exist — `invalidateAllCache()` safety net maintained (D3)
- **R3 Codex credit consumption**: Re-review cycles consume additional credits — call only before merge/large changes, max 1 re-verification after P2 fixes

## Lessons Learned

- **Critic triple value proven**: (1) Catching blind spots of different model family — Codex found cache contamination that Claude missed, (2) Discovering secondary defects in fix commits — P1 SWR 2.x API difference emerged from P2 fix, (3) Final regression-free confirmation guarantees merge safety
- **`codex review` CLI works without plugin**: Even when `/codex:*` slash commands are blocked, binary direct call (`codex review --base <SHA>`) provides equivalent results. Plugin activation is not a blocker
- **SWR 2.x array key is a single tuple argument**: Unlike SWR 1.x spread approach (`...args`), 2.x passes entire array key as one argument. Fetcher signature must handle tuples — following 1.x patterns without checking official docs causes runtime failures
- **Re-verification after cross-review is mandatory**: P1 can emerge from P2 fixes themselves. This sprint empirically proved that a re-verification cycle — not "fixed so it's done" — guarantees quality. Established minimum 1 re-review after fixes as a Critic operating principle

## Carried Over

None — Phase E verification complete.
