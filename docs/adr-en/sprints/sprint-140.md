---
sprint: 140
title: Problem Registration Calendar Follow-up — Deadline Edit Entry Point + Calendar UX Improvements
status: completed
period: 2026-04-29
start_commit: 26fa47b
end_commit: 2e37d1d
pr: https://github.com/tpals0409/AlgoSu/pull/185
followup_pr: https://github.com/tpals0409/AlgoSu/pull/186
related_sprints:
  - sprint-139 (calendar single widget transition — origin of this sprint)
  - sprint-130 (operational debt — sealed-secret SSoT pattern)
---

# Sprint 140 — Problem Registration Calendar Follow-up

## Context

After completing the calendar single widget + react-day-picker v9 mapping + ko locale application in Sprint 139, the user directly used the feature in production and 5 follow-up items of feedback were generated:

1. "It would be nice to have a deadline edit feature" — no path to change deadline after registration
2. "The calendar view is not intuitive and it's inconvenient because the selected date doesn't appear" — unable to confirm user input immediately
3. "The weekday display looks wrong" — regression even after Sprint 139 PR #183 grid mapping
4. "The month switch button position looks wrong" — nav button position misaligned
5. "Can't change month on the edit page" — nav button not clickable

Additionally found a separate issue during diagnosis:
- "Feedback page (`/admin/feedbacks`) inaccessible" — user email not included in ADMIN_EMAILS plaintext in production gateway-secrets

## Decisions

### Wave Split + Integrated PR Strategy
- Waves A~C integrated into a single PR (#185) — maintaining consistency across 3 entry points + bulk i18n key additions
- Follow-up as separate PR (#186) — regression found after receiving additional user feedback, single root cause (calendar.tsx)
- ADMIN_EMAILS is outside the scope of this code repo (aether-gitops + production cluster cert work) → delegated to user for direct handling

### Impact Scope Decision
- Frontend single layer → suitable for single sprint (matches sprint scoping memory)
- No DB schema changes, no backend service changes

## Changes

### Wave A — Deadline Edit Entry Point (PR #185)
`frontend/src/app/[locale]/problems/[id]/page.tsx`:
- Added `Pencil` icon import
- Added Pencil button to isAdmin conditional area in header (placed to the left of Trash2)
- Click triggers `router.push('/problems/${problemId}/edit')`
- i18n: Added `detail.editProblem` ko/en

Existing `/problems/[id]/edit/page.tsx` is already a Sprint 139 output with ADMIN guard + Calendar deadline handling complete → 0 new pages written.

### Wave B — Selected Date Text (3 Entry Points Unified)
- `AddProblemModal.tsx` ConfirmStep
- `/problems/create/page.tsx`
- `/problems/[id]/edit/page.tsx`

Each entry point adds `DAY_KEYS = ['sun','mon','tue','wed','thu','fri','sat']` module constant + `selectedDateText` computed variable. Display "Month Day (Weekday)" text below calendar in primary color + font-medium. Displayed together with existing `calculatedWeek` text.

New i18n keys:
- `form.selectedDate`: "{month}/{day} ({dayName})"
- `addModal.confirm.selectedDate`: Same pattern

Reuses `detail.deadlineFormat` + `detail.dayNames` (Sprint 139 output) pattern.

### Wave C — calendar.tsx Highlight Enhancement (PR #185)
- `weekday`: `'h-8 text-[11px] font-normal text-text-3 flex items-center justify-center'` → `'h-8 text-[11px] font-normal text-text-3 text-center leading-8'`
  - **Reason**: Applying `flex items-center justify-center` to a grid item when parent is `grid grid-cols-7` can cause unintended alignment. `text-center` + `leading-8` achieves the same visual effect while the grid cell works correctly.
- `day_button`: Added `data-[selected-single=true]:font-semibold` → visual emphasis of selected date
- `today`: `'font-semibold text-primary'` → `'font-semibold text-primary underline underline-offset-4 decoration-primary/40'` → enhanced visual distinction of today's date

### Follow-up — calendar.tsx Nav Button Position Regression (PR #186)
Additional user visual verification discovered after Wave C changes:
- "Month switch button position looks wrong"
- "Can't change month on edit page" (not clickable)

**Root cause**: Missing `relative` on `calendar.tsx` root className. react-day-picker v9's `nav` uses `absolute` positioning, and without `relative` on the root, position is calculated based on the nearest positioned ancestor. Depending on each entry point's parent container:
- AddProblemModal: nav position follows wrapping div positioning
- create/edit: nav pushed to page outer container, not clickable

**Fix** (`calendar.tsx`, +2 -2):
- root: `'p-3 mx-auto w-fit'` → `'relative p-3 mx-auto w-fit'`
- nav: `'inset-x-1 top-1'` → `'inset-x-3 top-3'` (aligned with root `p-3` padding)
- nav: Added `pointer-events-none [&>button]:pointer-events-auto` — prevents nav container floating above caption from blocking caption clicks

## Verification

- jest **1348 tests passed** (0 regressions)
- tsc clean / lint 0 new warnings
- CI 28 pass / 8 skipping / 0 fail / mergeStateStatus CLEAN
- **Critic invoked ✅** (PR #185 base origin/main, Codex `gpt-5`):
  - Command: `codex review --base origin/main`
  - Session: `019dd7c6-ee11-7d43-87ab-68b8644b24bf`
  - Result: "Changes internally consistent, edit entry button uses locale-aware router, i18n keys exist for both ko/en, selected date UI reuses existing deadline value, no additional regressions found"
  - Overall verdict: ✅ Mergeable
- Follow-up PR #186 — 4 character UI className change, 0 permission/input flow/time processing changes → Critic not invoked (same policy as Sprint 139 PR #183)

## Branch Discipline ✅
- `feat/sprint-140-calendar-followup` (PR #185)
- `fix/sprint-140-calendar-nav-position` (PR #186)
- 0 direct commits to main (**6 consecutive sprints compliant** since Sprint 134 violation)

## Findings / Separate Seeds

### react-day-picker v9 wrapper authoring: `relative` is mandatory
v9's nav uses absolute positioning based on root. Without `relative` on the wrapper component's root, the nearest positioned ancestor is used as reference → position misalignment varies by entry point environment. Needs to be added to PR pre-flight checklist (Sprint 139 follow-up dependency major upgrade check + this item).

### Production sealed-secret SSoT Conflict
- AlgoSu repo `infra/sealed-secrets/generated/sealed-gateway-secrets.yaml`: ADMIN_EMAILS key **missing** (outdated)
- aether-gitops repo `algosu/base/sealed-secrets/sealed-gateway-secrets.yaml`: ADMIN_EMAILS sealed value **present** (actually reflected in production)
- ArgoCD only watches the aether-gitops repo → sealed-secrets in the AlgoSu repo are historical artifacts
- **Sprint 141 seed**: Clean up sealed-secrets in AlgoSu repo (remove or automate sync) + write ADMIN_EMAILS update procedure runbook

### Value of User Visual Verification Reconfirmed
- After Sprint 139 PR #181 merge, user verification → 3 Calendar v9 compat regressions found (PR #183)
- After Sprint 140 PR #185 merge, user verification → 2 nav position regressions found (PR #186)
- This sprint also revealed admin permission issue due to unaddressed production sealed-secret
- **Lesson**: UI/UX work requires visual verification as a core step before merge. Regressions that cannot be caught by automated verification (jest/tsc/lint) are found every time.

### Critic Invocation Policy Application (Continued)
- Sprint 140 main PR (#185): Wave A permission entry point + routing → invoked → no regressions found, passed
- Sprint 140 follow-up (#186): 4 character UI className change → not invoked (policy compliance)
- Policy guide consistency maintained: invoke when "user input flow changes" / "time processing changes" / "new permission entry points"

### Oracle Dispatch Infrastructure P1 Unresolved (Continued)
`oracle-spawn.sh architect` PATH issue discovered in Sprint 139 was not addressed in this sprint either. Proceeded with Oracle working directly. **Carried over to Sprint 141**.

## Sprint 141 Carryover

- **Oracle `oracle-spawn.sh` PATH environment check** (Sprint 139 P1, 2 consecutive sprints unresolved)
- **Dependency major upgrade wrapper compatibility check + add to PR pre-flight checklist** (same pattern recurred in Sprint 139 + Sprint 140 follow-up)
- **en locale dynamic mapping** (next-intl locale ↔ react-day-picker locale connection)
- **AlgoSu repo sealed-secrets/ cleanup** (Sprint 140 new — resolve SSoT conflict with aether-gitops)
- **ADMIN_EMAILS update procedure runbook** (Sprint 140 new)
- Maintain 4 accumulated seeds:
  - github-worker errorFilter wrapper + WeakSet synchronization (Sprint 135 carryover)
  - ai-analysis Python CB schema unification (state 0/0.5/1 → 0/1/2 + name label)
  - CLAUDE.md `"ai-feedback"` → `"ai-analysis"` naming correction
  - E2E auto PR CI integration (accumulated since Sprint 134)

## Operational Work (Completed Directly by User)
User directly performed the following on the production cluster:
- Updated `ADMIN_EMAILS` sealed value in aether-gitops repo `algosu/base/sealed-secrets/sealed-gateway-secrets.yaml`
- Generated sealed value including `tpals0409dev@gmail.com` with production cluster cert
- Confirmed `/admin/feedbacks` access activated after ArgoCD sync + Gateway pod rolling restart

This work requires production cluster access + sealed-secrets-controller cert and cannot be performed in Oracle's local environment (local k3d) → delegated to user. Not having the AI collaboration environment (Claude Code) directly access production security zones is a security best practice.
