---
sprint: 93
title: "Weekly submission status/statistics bug fix — fetchActiveProblemIds CLOSED exclusion"
date: "2026-04-20"
status: completed
---

# Sprint 93 — Weekly submission status/statistics bug fix: fetchActiveProblemIds CLOSED exclusion

## Background

Users reported that the weekly submission statistics page showed incorrect counts — problems marked as CLOSED were not appearing in the statistics, even though submissions had been made for them. Root cause: `fetchActiveProblemIds()` in the Submission service was filtering only `ACTIVE` problems, silently dropping `CLOSED` ones.

## Goals

1. Fix `fetchActiveProblemIds()` to include `CLOSED` problems in weekly statistics
2. Add regression tests to prevent recurrence
3. Verify no impact on other submission flows

## Work Summary

| Commit | Agent | Content |
|--------|-------|---------|
| `a1b2c3d` | architect | Fix fetchActiveProblemIds — include CLOSED status |
| `e4f5g6h` | gatekeeper | Regression tests — 4 cases covering ACTIVE-only, CLOSED-only, mixed, empty |

## Root Cause

```typescript
// Before (bug): only ACTIVE problems returned
async fetchActiveProblemIds(): Promise<string[]> {
  const problems = await this.problemRepo.find({
    where: { status: ProblemStatus.ACTIVE },
  });
  return problems.map(p => p.id);
}
```

```typescript
// After (fix): ACTIVE + CLOSED both included
async fetchActiveProblemIds(): Promise<string[]> {
  const problems = await this.problemRepo.find({
    where: [
      { status: ProblemStatus.ACTIVE },
      { status: ProblemStatus.CLOSED },
    ],
  });
  return problems.map(p => p.id);
}
```

The function name `fetchActiveProblemIds` was intentionally kept for backward compatibility (renaming would require updates across multiple callers). A JSDoc comment was added clarifying it includes CLOSED problems.

## Verification

| Item | Result |
|------|--------|
| Weekly statistics with CLOSED problems | ✅ Now included |
| Regression test — ACTIVE only | ✅ PASS |
| Regression test — CLOSED only | ✅ PASS |
| Regression test — ACTIVE + CLOSED mixed | ✅ PASS |
| Regression test — empty | ✅ PASS |
| Existing submission service tests | ✅ 0 regression |

## Decisions

- **Include CLOSED in statistics**: CLOSED problems should appear in weekly statistics because submissions were made during their active period. Excluding them produces an incomplete view.
- **Keep function name**: `fetchActiveProblemIds` name retained to minimize diff size and caller updates. JSDoc clarification is sufficient.
- **TypeORM `where` array for OR**: TypeORM's array syntax in `where` produces `WHERE status = 'ACTIVE' OR status = 'CLOSED'` — no raw query needed.

## Lessons Learned

- **Status filtering silently drops data**: When a status enum expands, all existing filters must be audited. `fetchActiveProblemIds` was written before `CLOSED` status existed.
- **Regression test should cover each status variant**: A single happy-path test for `ACTIVE` is insufficient when status is an enum. Each variant needs its own test case.
- **Function naming can mislead**: `fetchActiveProblemIds` implied "only ACTIVE" but the business requirement is "problems that should appear in stats". Consider renaming to `fetchStatisticsProblemIds` in a future sprint.
