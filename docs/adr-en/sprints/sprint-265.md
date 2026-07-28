---
sprint: 265
title: "Desktop Sidebar Resize & Collapse (feedback #12)"
date: "2026-07-28"
status: completed
agents: [Oracle, Palette]
related_adrs: ["sprint-264", "sprint-263"]
related_memory: ["sprint-window"]
topics: ["frontend", "ui", "layout", "sidebar", "feedback", "dead-code"]
tldr: "Properly implemented algosu-feedback #12 (Notion-style sidebar resize/collapse) in the real layout. #12 had been recorded 'resolved' by Sprint 263 #510, but the resize/collapse went into `StudySidebar.tsx` — dead code that never renders — leaving the actual sidebar `AppLayout.tsx` (fixed w-[220px]) untouched; the user pointed out it wasn't applied → reopened and handled properly this sprint. #524 `1d0958db`: new `useSidebarResize.ts` hook + `AppLayout.tsx` drag resize / collapse toggle / width localStorage, with the user-requested size clamp (min 180 / max 400 / default 220), and dead-code `StudySidebar.tsx` removed. The Critic caught a click-area overlap between the header logo and the expand toggle in the collapsed state (56px, P2); the Palette re-delegation stalled so Oracle fixed it directly (017bf5f9: hide the logo link, center the header, drop the toggle's absolute positioning when collapsed) → re-review CLEAN."
---
# Sprint 265 — Desktop Sidebar Resize & Collapse (feedback #12)

_Date: 2026-07-28_

## Goal

Properly implement algosu-feedback **#12** ("Notion-style sidebar resize and collapse") in the real usage layout. A single-issue sprint.

**Background — mis-resolution correction**
#12 was closed as "resolved" by Sprint 263 #510 (study-room / sidebar UX improvements), but the user pointed out it was not applied on the actual screen. Investigation showed #510 had implemented resize/collapse in `StudySidebar.tsx`, a **dead-code** file referenced only by a single JSDoc `@related` comment (never imported/rendered anywhere). The real desktop sidebar is `AppLayout.tsx` (fixed `w-[220px]`), which #510 never touched. → Reopened #12 and handled it properly as Sprint 265.

**Additional user requirement**: apply a **size limit** on drag resize (prevent over-expand/over-shrink).

## Decisions

### D1. Implementation site = the real `AppLayout.tsx`, remove dead-code `StudySidebar.tsx` (#524)

Implement resize/collapse in the actually-rendered desktop sidebar (`AppLayout.tsx`). Since `StudySidebar.tsx` — where #510 put the feature — is dead code with 0 imports, do not reuse it; **delete** it (preventing the same feature scattered across two places). Factor the resize logic into a reusable custom hook `useSidebarResize.ts`.

### D2. Size limit = clamp min 180 / max 400 / default 220 (user requirement)

Apply a **clamp** to drag resize: min 180px / max 400px / default 220px. Clamp at **both** the pointer-move moment and the localStorage-load moment, so an out-of-range stored value is always corrected to a valid width. This constant pattern was ported into the real layout using `clampWidth` (MIN 180 / MAX 400 / DEFAULT 220) from the dead-code `StudySidebar.tsx` as the reference implementation.

### D3. Resolve collapsed-header overlap = hide logo, reposition toggle (Critic P2)

The Critic caught a **click-area overlap** between the header logo link and the expand toggle (`right-2`, 24px) in the collapsed state (56px, P2) — clicking the logo fired the expand toggle instead of navigating to the dashboard. At 56px the logo and toggle cannot physically coexist, so I **hid the logo link, centered the header, and dropped the toggle's `absolute` positioning when collapsed**, eliminating the overlap at its source (consistent with the Critic's "hide/reposition one" recommendation).

## Implementation

- **#524 `1d0958db`** (`feat/sprint-265-sidebar-resize`):
  - New `frontend/.../useSidebarResize.ts` — drag-resize hook (clamp 180~400, width save/load in localStorage)
  - `AppLayout.tsx` — integrated the sidebar drag handle / collapse toggle, wired the hardcoded `md:ml-[220px]` offset to the dynamic width
  - Removed `StudySidebar.tsx` (dead code)
  - Palette impl commits `49cea675`·`4f8f2b67` + Critic P2 direct fix by Oracle `017bf5f9`

**Verification (physical facts)**: Oracle direct gate — `tsc` delta 0 (`globals.css` TS2882 is an unchanged baseline, CI green) · ESLint **0 errors** (warnings are the `react/forbid-dom-props` baseline; dynamic-width inline style is unavoidable) · jest **1860 pass/0 fail** (incl. `AppLayout.test.tsx` 10 pass). Critic re-review **CLEAN** (P2 gone). Squash-merged `1d0958db`, confirmed on origin/main.

## Incidents

1. **#12 mis-resolution / reopen**: Sprint 263 #510 implemented #12 in dead code and closed it → the non-application was found via the user's report → reopened and handled properly this sprint. Separately, #3 (tab UUID)·#6 (AI-report padding) were initially misclassified as unresolved, but measurement showed they were already resolved by PR #505 `03c13ef1` → corrected and closed.
2. **Palette re-delegation stall (ACP background)**: after the Critic P2 finding, the Palette fix re-delegation stalled for 21 minutes with 0 commits / working-tree changes → rather than wait longer, Oracle fixed P2 directly (a small FE change).
3. **Auto-verdict false positive (reconfirmed)**: the `.verdict` auto-parser labeled #524's first review "CLEAN-hint", but the codex verdict section in the log had 1 P2 → caught by Oracle's direct log read. The re-review had 0 findings = CLEAN confirmed.
4. **Local main stale misjudgment**: during the close procedure `git merge --ff-only` returned "Already up to date", but the gh-API measurement showed local lagging origin/main → stale remote-tracking ref. Reconciled with `fetch` + `reset --hard origin/main`.

## Carryover

- None. (#12 properly resolved; 0 unresolved feedback issues remaining.)

## Lessons

- **A "resolved" record must be measured down to the render path.** #510 wrote and merged code, but the component never mounted, so from the user's perspective it was unresolved. A feature placed in dead code (0 imports) is not "implemented" — before closing an issue, grep-verify it renders in the real component.
- **Size-limit clamp must be applied on both input and restore.** Clamping only at drag time lets an out-of-range value stored in localStorage restore verbatim on the next load, nullifying the limit. Boundary correction must apply to every path a value enters through.
- **Recover a stalled delegation instead of waiting.** When an ACP background delegation stalls silently (0 commits / working-tree changes), a small change is faster done by Oracle directly — discriminate the stall by measurement (commit history), not by trusting self-reports.
