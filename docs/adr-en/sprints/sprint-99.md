---
sprint: 99
title: "PM QA 5 Rounds — DifficultyBadge Platform-Aware Extension + Week Calculation Formula Fix + sourcePlatform Prop Propagation"
date: "2026-04-20"
status: completed
---

# Sprint 99 — PM QA 5 Continuous Rounds: DifficultyBadge Platform-Aware Extension + Week Calculation Formula Fix + sourcePlatform Prop Propagation

## Background

After Programmers integration (Sprint 95–98), a PM-led QA session surfaced multiple UI/logic bugs across 5 rounds of iterative testing. Each round identified new issues until round 5 achieved zero defects.

## Goals

1. Fix `DifficultyBadge` to correctly render Programmers levels (Lv.1–5) vs BOJ tiers (Bronze–Ruby)
2. Fix week calculation formula returning incorrect week numbers
3. Fix `sourcePlatform` prop not propagating through all component layers
4. Achieve 0 defects in round 5 QA

## QA Round Summary

| Round | Issues Found | Issues Fixed |
|-------|-------------|-------------|
| 1 | 4 | 0 (identified only) |
| 2 | 3 | 4 |
| 3 | 2 | 3 |
| 4 | 1 | 2 |
| 5 | 0 | 1 ✅ |

## Key Bug Fixes

### DifficultyBadge Platform-Aware Extension

**Problem**: `DifficultyBadge` used BOJ tier strings ('BRONZE', 'SILVER', etc.) as the only display path. When `sourcePlatform='PROGRAMMERS'`, the badge showed nothing or an error.

**Fix**:
```tsx
// frontend/src/components/DifficultyBadge.tsx
interface DifficultyBadgeProps {
  difficulty: string;
  sourcePlatform: 'BOJ' | 'PROGRAMMERS';
}

export function DifficultyBadge({ difficulty, sourcePlatform }: DifficultyBadgeProps) {
  if (sourcePlatform === 'PROGRAMMERS') {
    const level = parseInt(difficulty.replace('LEVEL_', ''), 10);
    return <span className={`badge badge-programmers-lv${level}`}>Lv.{level}</span>;
  }
  // BOJ tier rendering (existing)
  return <span className={`badge badge-${difficulty.toLowerCase()}`}>{TIER_LABEL[difficulty]}</span>;
}
```

### Week Calculation Formula Fix

**Problem**: Week number calculation was off by 1 for weeks starting on Monday. The formula used `Math.ceil(dayOfMonth / 7)` which doesn't account for the day-of-week offset.

**Fix**: Used ISO week number calculation aligned to the study's `startDate`:
```typescript
function getStudyWeekNumber(date: Date, studyStartDate: Date): number {
  const diffMs = date.getTime() - studyStartDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.floor(diffDays / 7) + 1;
}
```

### `sourcePlatform` Prop Propagation

**Problem**: `sourcePlatform` was available in the page-level data fetch but wasn't being passed down through intermediate components to `DifficultyBadge`.

**Fix**: Traced the prop through 3 intermediate components:
1. `ProblemListPage` → `ProblemTable` (added `sourcePlatform`)
2. `ProblemTable` → `ProblemRow` (added `sourcePlatform`)
3. `ProblemRow` → `DifficultyBadge` (added `sourcePlatform`)

Added `sourcePlatform` to each component's props interface.

## Verification

| Item | Result |
|------|--------|
| DifficultyBadge — BOJ Bronze display | ✅ Correct |
| DifficultyBadge — Programmers Lv.3 display | ✅ Correct |
| Week number — study starting Monday | ✅ Correct |
| Week number — study starting mid-week | ✅ Correct |
| `sourcePlatform` visible in DifficultyBadge | ✅ Propagated |
| PM QA Round 5 | ✅ 0 defects |

## Decisions

- **Platform-aware DifficultyBadge**: Single component handles both platforms via `sourcePlatform` discriminant. No separate `ProgrammersDifficultyBadge` component.
- **ISO-aligned week calculation**: Study week number is relative to `studyStartDate`, not the calendar month. This aligns with how study coordinators communicate week numbers.
- **Prop drilling accepted for now**: 3-level prop drilling for `sourcePlatform` is acceptable. If more levels are added, context API or SWR key redesign is preferred.

## Lessons Learned

- **PM QA sessions surface integration gaps that unit tests miss**: Unit tests verified each component in isolation, but the prop propagation gap was only visible end-to-end.
- **Scouting agents can misidentify component responsibility**: Sprint 99 SSOT incident — scout reported `DifficultyBadge` didn't need changes because the prop was "available", without tracing whether it actually reached the component.
- **Prop propagation check list**: When adding a new prop to a leaf component, trace it upward through every ancestor. Document the chain: `Page → Table → Row → Badge`.
- **Iterative QA rounds converge**: 5 rounds is acceptable for a feature this size. Define "done" as 0 defects in a full round, not a fixed number of rounds.
