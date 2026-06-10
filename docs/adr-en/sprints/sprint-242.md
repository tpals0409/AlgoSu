---
sprint: 242
title: "FE decomposition + tests (ADR-030 Q-1 FE + Q-7 + Redis logging carry-over)"
date: "2026-06-10"
status: completed
agents: [Oracle, Conductor, Critic, Scribe]
related_adrs: ["ADR-030", "sprint-241", "sprint-238"]
related_memory: ["sprint-window"]
topics: ["refactoring", "code-quality", "frontend"]
tldr: "Sprint 4 of the ADR-030 remediation roadmap. Three oversized frontend files decomposed + Sprint 241 carry-over Redis logging aligned. D (Redis carry-over): 3 carry-over files + 3 adjacent files found by full grep — 6 files total patched to the 2-argument structured-logging pattern. Q-1 (FE): AddProblemModal (805 lines) → add-problem/ 4 files (206/271/263/220) + 20-line re-export shim + 65 tests; settings (844 lines) → 243 lines + 6 section components + 28 tests; edit (748 lines) → 465 lines + 5 section components + 22 tests (3 existing hooks reused). Critic auto-critic 5 rounds (D Low1 · A CLEAN · B/C M-1+L-1 · L-1-fix Medium 2 remaining · closure Low1) + merge-gate full-base R1 (M-1) → R2 (P3) → R3 CLEAN — all findings fully fixed. frontend 171 suites / 1769 tests, coverage 88.06/80.68/85.34/88.58 (threshold 81/71/82/83 held). gateway 854+ / 98.66/96.94/96.83/98.93; submission 387 / 98.69/94.13/98.93/99.04. tsc 0 / lint 0 across all 3 services."
---
# Sprint 242 — FE decomposition + tests (ADR-030 Q-1 FE + Q-7 + Redis logging carry-over)

## Goal

- Item 4 on the ADR-030 remediation roadmap — decompose 3 oversized frontend files (Q-1 FE) and write tests alongside each extracted component (Q-7).
- Sprint 241 Critic auto-critic R2 out-of-scope finding: 3 files with Redis on-error string-interpolation (D work) — absorbed as the first task of this sprint; a full grep extends coverage to 3 additional adjacent files, totalling 6.
- Behavior-preserving — UI rendering, API calls, and error handling unchanged. Per-service coverage thresholds (frontend lines 83% / branches 71%, gateway 98/95/96/98, submission 97/92/96/97) must not be lowered; Critic merge gate required.

## Context

- `/start` argument: process ADR-030 §Decision roadmap item 4, Q-1 (FE) + Q-7.
- **Q-1 (FE)**: `AddProblemModal.tsx` at 805 lines, `studies/[id]/settings/page.tsx` at 844 lines, `problems/[id]/edit/page.tsx` at 748 lines — identified as oversized modules in the Sprint 238 audit. Logic, UI, error handling, and per-section state are all co-located in a single file.
- **Q-7**: Write tests alongside decomposed components to improve frontend test density (36% by LOC at Sprint 238 audit time).
- **D (Redis carry-over)**: Sprint 241 Critic auto-critic R2 recorded as an out-of-scope Low finding: `invite-throttle.service.ts`, `deadline-reminder.service.ts`, `notification.service.ts` using string-interpolation on Redis on-error logs. Absorbed as this sprint's first commit; a full grep surface 3 additional files (including a previously deferred oauth file) for a total of 6.

## Work summary (Conductor + Critic, 10 commits total)

### D — Redis on-error logging 2-argument alignment (commit `3969673`)

Three carry-over files (`invite-throttle.service.ts`, `deadline-reminder.service.ts`, `notification.service.ts`) migrated from single-argument `logger.error(\`${err.message}\`)` to 2-argument `logger.error(msg, err)`. A full grep revealed **3 additional adjacent files** (including a previously deferred oauth file) → **6 files total aligned**.

Aligned with the `StructuredLoggerService` second-argument Error serialization pattern (name / message / stack), preserving full stack traces. Consistent with the Sprint 241 L-1 fix on `membership-cache.service.ts`.

**Critic auto-critic (D)**: Low 1 (missing spec assertion for on-error callback) → closed by `cd2eecd` (spec assertion addition).

---

### A — AddProblemModal decomposition (commit `19619a6`)

**Decomposition layout (add-problem/ 4 files + re-export shim)**

| New file | Lines | Notes |
|----------|-------|-------|
| `add-problem/` file 1 | ~206 | Section A responsibility |
| `add-problem/` file 2 | ~271 | Section B responsibility |
| `add-problem/` file 3 | ~263 | Section C responsibility |
| `add-problem/` file 4 (entry point) | ~220 | Composition + export |
| re-export shim | 20 | Backward-compatible import path |

- `testPathIgnorePatterns` exclusion for AddProblemModal removed → **65 tests added**.
- **Behavior invariants**: API calls, form validation, and modal navigation flow unchanged.
- **Critic auto-critic (A)**: **✅ CLEAN**.

---

### B — settings page decomposition (commit `ef6a812`)

`studies/[id]/settings/page.tsx` **844 lines → 243 lines** (entry point) + **6 section components**.

- Each section component owns its local error state — self-contained within the section boundary.
- **28 tests added**.

---

### C — edit page decomposition (commit `545dc03`)

`problems/[id]/edit/page.tsx` **748 lines → 465 lines** + **5 section components**.

- **3 existing custom hooks reused** — no new hooks created (DRY compliance).
- **22 tests added**.

B/C combined **Critic auto-critic**: **2 findings** (see fixes below).

---

### Critic auto-critic R(B/C) fixes

Cross-review of B/C outputs (`ef6a812`, `545dc03`): **L-1 + M-1 found**.

**L-1 (commit `f5f1b77`)**: `@Global`-decorated singleton Logger on-error handlers called without a `context` argument — because multiple services share the same singleton instance, calls without an explicit context can inherit the most recently registered context and produce misleading log attribution. **5 on-error callback files updated** with `context: this.constructor.name` to prevent context racing.

**M-1 (commit `928d639`)**: `DeadlineSection` component exposes raw i18n translation keys in `fieldErrors` — **decomposition-boundary regression**. The original page applied `t()` before passing field errors; the extracted section component omitted the translation call. Fix: add `useTranslation` hook + apply `t(fieldErrors.deadline)`.

---

### Critic auto-critic R(L-1 fix) and residual closure

Re-review of the L-1 fix commit (`f5f1b77`): **2 Medium residuals found**.

Full grep sweep: the designated 5 files expanded to **8 total — `event-log` service discovered as an additional site**. `22ee74d` closes the remaining 3 instances.

---

### Critic auto-critic R(closure) and spec addition

Re-review of closure commit (`22ee74d`): **Low 1** (D on-error callback spec assertion incomplete) → `cd2eecd` adds `test(gateway): Redis on-error callback logger.error argument assertion`.

---

### Critic merge gate full-base R1–R3

Final review of the full branch diff (`--base 241af57`):

**R1 M-1 (commit `7d1b46d`)**: settings decomposition omits `setError(null)` on the success path — **decomposition-boundary regression**. Error Alert persists after a successful operation. Fix: extract `handleSuccess` helper, reset error state on success, add guard test.

**R2 P3 (commit `0f6e0f0`)**: `InviteCodeSection` `onSuccess` derivation — the same error-persistence pattern (Alert remains after regeneration success) → fix applied. `DeleteSection` verified against the original source (`Read`) — implementation differs and the defect is absent → **no change needed** (origin-code evidence required; inference alone was insufficient).

**R3**: **✅ CLEAN**. Merge gate closed.

---

## Incidents

1. **Critic task JSON status mis-recorded (harness slot carry-over)**: critic task JSON recorded `failed_no_codex_session` across 4 consecutive rounds — inbox result files were all present with status: success. Root cause identified as a bug in oracle-reap/runner status recording. All actual reviews completed normally. Harness bug itself is carried over.
2. **Herald scope overreach (recorded)**: During R2/R3 merge gate, Herald self-executed a Codex review — Herald's mandate covers Herald work, not Critic's independent merge-gate review. The official verdict is the one produced by the chained Critic independently; Herald's result was confirmed consistent but represents a role-boundary violation. Recorded for awareness.

## Key decisions

1. **Decomposition boundary includes error state and translations**: extracting a section component requires moving `setError(null)` success reset and `t()` translation calls into the component boundary. Failure to replicate the original page's error/translation handling patterns produces decomposition-boundary regressions.
2. **"Not applicable" judgments require reading the original source**: In R2 P3, DeleteSection was tentatively flagged as having the same defect but a source read confirmed a different implementation with no defect. Ruling based on inference alone — without reading the file — must not be accepted.
3. **Full grep outperforms a named file list**: the L-1 closure step expanded from a 5-file target list to 8 total sites by switching to a pattern-based grep; `event-log` was discovered as an additional site outside the original list.
4. **Re-export shim preserves backward-compatible import paths**: external imports of AddProblemModal from the previous path are kept working via a 20-line shim, avoiding a cross-codebase import update sweep.

## Verification

- **frontend**: `npx tsc --noEmit` 0 errors · `npm run lint` 0 errors · `npm test -- --coverage` **171 suites / 1769 tests, all passing**
  - coverage: Statements **88.06** / Branches **80.68** / Functions **85.34** / Lines **88.58** (threshold 81/71/82/83 held)
- **gateway**: `npx tsc --noEmit` 0 errors · `npm run lint` 0 errors · `npm test -- --coverage` **854+ tests, all passing**
  - coverage: Statements **98.66** / Branches **96.94** / Functions **96.83** / Lines **98.93** (threshold 98/95/96/98 held)
- **submission**: `npx tsc --noEmit` 0 errors · `npm run lint` 0 errors · `npm test -- --coverage` **387 tests, all passing**
  - coverage: Statements **98.69** / Branches **94.13** / Functions **98.93** / Lines **99.04** (threshold 97/92/96/97 held)
- Critic auto-critic: D (Low1) → A (CLEAN) → B/C (M-1 DeadlineSection translation + L-1 logger context) → fixes (`f5f1b77` + `928d639`) → L-1-fix round (Medium 2 remaining) → closure (`22ee74d`) → closure round (Low1) → spec addition (`cd2eecd`)
- Critic merge gate: R1 (M-1 · settings setError closure `7d1b46d`) → R2 (P3 · InviteCode onSuccess fix + DeleteSection origin-read `0f6e0f0`) → **R3 CLEAN**
- Branch: `refactor/sprint-242-fe-decomposition` (10 commits: `3969673` · `19619a6` · `ef6a812` · `545dc03` · `f5f1b77` · `928d639` · `22ee74d` · `cd2eecd` · `7d1b46d` · `0f6e0f0`)

## Lessons

1. **Decomposition-boundary regressions are better caught by a full-base gate than per-commit review**: both the M-1 (settings setError omission) and the translation-key exposure (DeadlineSection) occurred at decomposition boundaries. Per-commit review lacks the before/after context that a full-branch diff provides.
2. **"Not applicable" judgments require reading the original source**: InviteCode: failed to refute (fix needed). DeleteSection: source read confirmed no defect. Inference-only judgment produces errors in both directions.
3. **Full grep outperforms a named file list for tail coverage**: L-1 closure started with 5 designated files, expanded to 8 by switching to pattern-based grep, and found `event-log` as an additional site outside the original target list.

## Next sprint carry-over seeds

**Sprint 243 (planned)**: ADR-030 roadmap item 5 — S-7 Action SHA pinning, S-3 CSP nonce spike (decision only), Q-6 CI helper extraction.

**Technical debt seeds (priority order)**:
- Synchronous log calls on a singleton logger — context contamination root cause → evaluate transient scope (fundamental fix for this sprint's L-1)
- `errors` / `problems` i18n namespace wording mismatch
- ConfirmStep `tErrors` pre-existing defect
- Inline style tokenization (convert to Tailwind token classes)
- Critic task JSON status mis-recording harness bug (oracle-reap/runner)

**Ongoing carry-over**:
- Quality — docs required gate promotion review
- Harness maintenance slot (pane guard hardening + window decoration root fix + Codex model pin)
- GA4 3 items · live SEO · harness cron · webhook regenerate · cumulative UAT · blog post candidates (3 items)
