---
sprint: 139
title: Problem Registration UX Improvement — Calendar-Based Registration + Week Auto-Calculation
status: completed
period: 2026-04-28
start_commit: 608e276
end_commit: e2879c7
pr: https://github.com/tpals0409/AlgoSu/pull/181
followup_pr: https://github.com/tpals0409/AlgoSu/pull/183
related_sprints:
  - sprint-99 (week calculation algorithm established)
  - sprint-95 (Baekjoon → Programmers migration — external dependency retrospective)
---

# Sprint 139 — Calendar-Based Problem Registration + Week Auto-Calculation

## Context
User feedback: "Instead of the two-step select dropdown where weekNumber is manually selected when adding a problem, change it so the user only selects the deadline from a calendar and the week number is automatically calculated internally by the program."

Previous flow:
- User selects "Week 3 of May" from the `weekNumber` dropdown → selects deadline from a day-of-week select within that week
- DB stores `week_number` varchar(20) column + `deadline` timestamp separately
- UX friction requiring the user to enter the same domain concept (study week) twice

## Decision (Option A Adopted)
**Client derives weekNumber from deadline and includes it in the API payload.**

| Option | Change Scope | Adopted |
|--------|-------------|---------|
| A: Client derive + include in backend payload | frontend only | ✅ Selected |
| B: Backend calculates from deadline | frontend + backend service | Separate seed |
| C: Remove `week_number` column, always derive | frontend + backend + DB migration | Separate seed |

Reasons for choosing Option A:
- No DB schema changes — existing backend logic such as `findByWeekAndStudy` maintained as-is
- Minimum regression risk (single frontend domain)
- Options B/C have cleaner SSoT structure but separated into individual sprints

## Impact Scope (3 Entry Points)
The user feedback's "problem add UI" was actually **2 locations** — only (1) was identified during scouting, (2) was discovered during work:

1. `/problems/create` fullscreen page (admin only)
2. `AddProblemModal` modal on the `/problems` list page (more common UI)
3. `/problems/[id]/edit` edit page (symmetry maintenance)

All three entry points used the same pattern (2-step select) so changed together.

## Changes

### Wave A — Inspection only (no commit)
- Existing `getCurrentWeekLabel(date: Date = new Date())` signature already accepts arbitrary Date argument → no need to add new function, reused as-is
- `getWeekOptions`/`getWeekDates`/`matchDeadlineToWeekDate` were only used in create/edit pages → confirmed removable after Wave B/C

### Wave B+C+D — Integrated commit (`4dbae8f`)
Atomic change required due to shared schemas/utils.

- `frontend/src/lib/schemas/problem.ts`: Remove `weekNumber` field
- `frontend/src/lib/problem-form-utils.ts`: Remove weekNumber from `ProblemFormState`/`ProblemFormErrors`/`validateProblemForm`
- `frontend/src/app/[locale]/problems/create/page.tsx`: 2-step select → single `<Calendar mode="single">` widget, read-only display of derived weekNumber
- `frontend/src/app/[locale]/problems/[id]/edit/page.tsx`: Same pattern
- New i18n key: `problems.form.calculatedWeek` ("Auto-calculated: {week}")
- Tests: Added Calendar/buttonVariants mocks, updated weekNumber cases in schemas/utils tests

### `d1f4e49` — AddProblemModal same change
- `ConfirmStep`: Remove two-step selects, integrate calendar widget
- Removed unused helpers: `generateWeekData`/`getWeekDateData`/`WeekOption`/`DateOption`/`DAY_KEYS` (-178 lines)
- Cleaned up unused i18n keys: `weekLabel`/`weekPlaceholder`/`deadlinePlaceholder`/`weekFormat`/`dateFormat`
- Tests: Updated `selectWeekAndSubmit` helper to calendar click pattern

### `9301354` — Sprint 139 cleanup
- `problem-form-utils.ts`: Remove `getWeekOptions`/`getWeekDates`/`matchDeadlineToWeekDate`/`DAY_NAMES` (-76 lines)
- `problem-form-utils.test.ts`: Remove describe blocks for above functions (-128 lines)
- Clean up stale `jest.mock` items in create/edit page tests
- Remove unused i18n keys: `form.weekLabel`, `errors.validation.problem.weekNumberRequired`, `addModal.dayNames`, `addModal.validation.weekRequired`

### `a26f9d5` — Critic P1 fix
**Codex review caught 2 P1 regressions**:
> Calling `date.toISOString()` directly in `Calendar onSelect` of create/edit pages serializes as local midnight in UTC+ timezones like KST → deadline effectively ends one day early at 00:00 on the intended date. The existing select method normalized to 23:59:59, and AddProblemModal also applied the same normalization, but it was missed in the new create/edit code.

Fix: Apply the same pattern already used in AddProblemModal:
```ts
const iso = date
  ? new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59).toISOString()
  : '';
```

Critic re-verification passed: "P1 regression resolved, no additional defects found."

## Verification
- `pnpm type-check` pass (frontend)
- `pnpm lint` clean (warnings only, unrelated to existing code)
- `pnpm test` **1348 tests passed** (130 suites, 0 regressions; 1361 → removed 13 unused util tests → 1348)
- CI: 30 SUCCESS / 8 SKIPPED / 0 FAILURE (mergeStateStatus CLEAN)
- Critic 2 rounds (P1 2 → 0)

## Branch Discipline ✅
- New branch `feat/sprint-139-calendar-based-problem-create` (608e276 base)
- 4 atomic commits → PR #181 → Squash merge
- 0 direct commits to main (Sprint 135/136/137/138/139 — 5 consecutive sprints compliant since Sprint 134 violation)

## Findings / Separate Seeds

### Oracle Dispatch Infrastructure Issue (P1)
- Attempted to spawn Architect via `oracle-spawn.sh architect` → immediate `env: claude: No such file or directory` failure in tmux pane
- Root cause estimate: `claude` CLI not found in PATH of tmux pane environment (separate from Sprint 125 D2 H1 sensitive path protection)
- **Workaround**: Oracle proceeded directly (PM consensus plan + Wave-unit atomic commits + Critic external verification as supplement — Critic ultimately caught 2 P1 issues, justifying the workaround)
- **Sprint 140 seed**: `oracle-spawn.sh` PATH environment check + fallback or explicit error output when `claude` is not found

### Ambiguity in User Feedback's "Add Problem" Scope
- Work began without precisely identifying which UI "add problem" referred to → AddProblemModal discovered additionally during work → included in the same commit bundle
- **Lesson**: User feedback keywords like "add problem" should be verified with pre-grep for repeated patterns before finalizing the plan

### Accumulated Unused i18n Keys
- `addModal.dayNames` (7 keys × 2 langs), `addModal.validation.weekRequired`, `form.weekLabel`, etc. — became unused after changes, but if not cleaned up immediately can cause ko/en mismatches/confusion
- All cleaned up in this sprint. Future i18n key additions/removals are recommended to be included in PR unit cleanup commits.

### Critic Invocation Policy Application Example
- Sprint 131~138 had appropriate Critic non-invocation policy for infra yaml/seed changes
- Sprint 139 involved **form validation logic + user input flow + timezone normalization** with high correctness risk → Critic invoked → 2 P1 issues caught → value of invocation policy proven
- Future policy guide: Critic invocation mandatory when "user input flow changes" or "time processing changes"

## Follow-up (PR #183, `f9d8420` → main `e2879c7`)

3 calendar regressions found by user visual verification immediately after PR #181 merge:

1. **ko locale not applied** — English month names ("April 2026") + English weekday names ("Su Mo Tu We Th Fr Sa") displayed
2. **Weekday header grid broken** — only `Su` appears above the first column, remaining `MoTuWeThFrSa` bunched together above the 4th column
3. **Modal left-aligned** — calendar not centered

### Root Cause
react-day-picker **v9.14.0** is installed but `frontend/src/components/ui/calendar.tsx` uses **v8 className keys**, which don't match v9 standard keys, causing all 8 classNames to be invalid and falling back to default flex layout.

### v8 → v9 className Mapping
| v8 (before) | v9 (after fix) |
|---|---|
| `caption` | `month_caption` |
| `nav_button_previous`/`nav_button_next` | `button_previous`/`button_next` |
| `table` | `month_grid` |
| `head_row` | `weekdays` |
| `head_cell` | `weekday` |
| `row` | `week` |
| `cell` | `day` |
| `day` (button) | `day_button` |

### Fix
- Updated v9 className key mappings
- Default `locale` prop set to `ko` (imported from `react-day-picker/locale` — date-fns/locale re-export)
- Force `weekdays`/`week` to `grid grid-cols-7` → uniform 7-column split
- Calendar outer `mx-auto w-fit` → centered in modal
- AlgoSu design tokens (`text-text-3`, `bg-primary-soft`, etc.) applied
- `selected`/`today`/`range_*` states applied via v9 data attribute selectors (`data-[selected-single]`/`data-[range-*]`)

### Verification
- typecheck pass / lint warnings only / 1348 tests pass (0 regressions)
- CI 30 SUCCESS / 8 SKIPPED / 0 FAILURE
- Critic not invoked (UI className update, low code correctness risk)

### Lessons
**Dependency wrapper component compatibility check was missing from PR pre-flight checklist for major version changes.** This case involved react-day-picker being upgraded from v8 → v9 at some point, but the wrapper (`calendar.tsx`) was not updated, and the regression surfaced when first actually used in Sprint 139. **Sprint 140 seed**: Add "check wrapper compatibility when major dependency upgrade" item to PR pre-flight checklist.

## Sprint 140 Carryover
- Oracle `oracle-spawn.sh` PATH environment check (Sprint 139, P1)
- Dependency major upgrade wrapper compatibility check (Sprint 139 follow-up — add to PR pre-flight checklist)
- en locale dynamic mapping (next-intl locale ↔ react-day-picker locale connection — out of Sprint 139 follow-up scope)
- Maintain 4 accumulated seeds:
  - github-worker errorFilter wrapper + WeakSet synchronization (Sprint 135 carryover)
  - ai-analysis Python CB schema unification (state 0/0.5/1 → 0/1/2 + name label)
  - CLAUDE.md `"ai-feedback"` → `"ai-analysis"` naming correction
  - E2E auto PR CI integration (accumulated since Sprint 134)
- backend weekNumber calculation from deadline (Option B) — separate seed
- `week_number` column removal (Option C) — separate seed
- Operational verification: demo login broken image recovery after ArgoCD sync (Sprint 138 carryover maintained)
