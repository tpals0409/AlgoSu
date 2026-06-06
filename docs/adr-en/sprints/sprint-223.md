---
sprint: 223
title: "Global progress.tsx Wrapper aria-valuenow Fix (Follow-up to Sprint 222 — Canonicalizing a Latent a11y Gap)"
date: "2026-06-06"
status: completed
agents: [Oracle, Herald, Librarian, Critic]
related_adrs: ["sprint-221", "sprint-222"]
related_memory: ["sprint-window", "ui-migration"]
topics: ["frontend", "ui", "quiz", "accessibility"]
tldr: "A frontend-only sprint that canonicalizes what Sprint 222 had worked around: the quiz progressbar's missing aria-valuenow was patched via a QuizPlay-local explicit aria-valuenow={percent}, while the root-cause shared-wrapper fix was carried over. Root cause: the shared progress.tsx wrapper destructured value but did not forward it to ProgressPrimitive.Root (value was also dropped from {...props}), so Radix could not auto-assign aria-valuenow → every progressbar using the wrapper was potentially missing aria-valuenow. (Fix) Pass value={value} explicitly to <ProgressPrimitive.Root> (before {...props}) — the Indicator transform still uses value||0, so the visual is completely unchanged. Result: every wrapper-based progressbar exposes role=progressbar's aria-valuenow/valuemin/valuemax via Radix auto-assignment. (Canonicalization) Remove the duplicate QuizPlay-local aria-valuenow={percent} that Sprint 222 added to work around the wrapper defect — Radix auto-assigns the same value; aria-label and aria-valuetext ('1 / 3') are kept because Radix cannot substitute them. (Safety net) The wrapper had no unit test; add +4 (value exposure, undefined/null indeterminate non-exposure, caller aria override). QuizPlay.test.tsx is unchanged and still passes (aria-valuenow='33'). The sole consumer of the ProgressPrimitive-based Progress is QuizPlay; ScoreGauge/CategoryBar are custom SVG/div implementations and out of scope. 0 new tokens, 0 new components. merge≠live (separate ops carryover)."
---
# Sprint 223 — Global progress.tsx Wrapper aria-valuenow Fix

## Goal

- Canonically resolve the shared `progress.tsx` wrapper a11y gap that Sprint 222 carried over as **follow-up, optional**.
- Globally fix the wrapper to forward `value` to `ProgressPrimitive.Root` so wrapper-based progressbars expose Radix's auto `aria-valuenow` (**no visual change**).
- Frontend-only — no data/schema/backend change. 0 new design tokens/components. `/quiz` is auth-gated, so live verification is a separate ops carryover (merge ≠ live).

## Background

In Sprint 222 (D2) we found the QuizPlay progress bar's `aria-valuenow` was empty and fixed it with a local patch — **passing `aria-valuenow={percent}` explicitly from QuizPlay**. But the root-cause global fix — the shared `progress.tsx` wrapper swallowing `value` instead of forwarding it to Radix — was carried over for scope discipline (ADR sprint-222 §carryover, lesson ⑥).

Confirming the root cause in code:

```tsx
function Progress({ className, value, ...props }) {   // value destructured → dropped from props
  return (
    <ProgressPrimitive.Root className={...} {...props}> {/* value not forwarded */}
      <ProgressPrimitive.Indicator style={{ transform: `translateX(-${100 - (value || 0)}%)` }} />
    </ProgressPrimitive.Root>
  );
}
```

Because `value` is destructured it is not included in `{...props}`, so it is never forwarded to `Root` and is used only in the Indicator's `transform` style. As a result Radix does not know `value` and cannot auto-assign `aria-valuenow`. **Every progressbar using the wrapper was potentially missing `aria-valuenow`** (only the quiz site had a local patch).

## Decisions

### D1. Forward `value` to `Root` in `progress.tsx` (the core one-liner)

Pass `value={value}` to `<ProgressPrimitive.Root>` **before** `{...props}`.

- The Indicator `transform` still uses `value || 0` → **completely unchanged visual**.
- Result: every wrapper-based progressbar exposes `role="progressbar"`'s `aria-valuenow`/`aria-valuemin`(0)/`aria-valuemax`(default 100) via Radix auto-assignment + normalized `data-state` (loading/complete).
- Caller-supplied `aria-*` (e.g. `aria-label`, custom `aria-valuetext`) can still **override** via the trailing `{...props}` (Radix spreads user props last — Sprint 222 lesson ④).

### D2. Remove the duplicate QuizPlay-local patch (canonicalization)

Remove the **`aria-valuenow={percent}` line** that Sprint 222 added to QuizPlay `<Progress>` to work around the wrapper defect.

- After removal, Radix auto-assigns the same value from `value={percent}` → identical exposure/behavior.
- **`aria-label` (accessible name) and `aria-valuetext` ("1 / 3") are kept** — Radix does not auto-generate an accessible name, and the default `aria-valuetext` is `"{percent}%"` (e.g. "33%"), which cannot substitute the desired "1 / 3" progress text, so keeping the caller values is required.

### D3. Restraint — clarify out-of-scope

- The **sole consumer** of the `ProgressPrimitive`-based `Progress` is QuizPlay (1 site).
- `ScoreGauge.tsx`/`CategoryBar.tsx` are progress visualizations implemented with custom SVG/div, do not use Radix, and are therefore **out of scope** for this global fix (separate sprint if needed).
- 0 new design tokens · 0 new components.

## Implementation

### Deliverables (Wave order)

2 atomic commits total (start `33155d7`):

| Wave | Agent | Commit | Content |
|---|---|---|---|
| W-A | Herald | `1b3dcf4` | `progress.tsx`: pass `value={value}` to `<ProgressPrimitive.Root>` (before `{...props}`) + JSDoc / QuizPlay: remove duplicate `aria-valuenow={percent}` (keep `aria-label`·`aria-valuetext`) |
| W-B | Herald | `001b065` | New `progress.test.tsx` +4 — value → `role=progressbar`+`aria-valuenow`/`valuemin`/`valuemax`, `undefined`/`null` (indeterminate) → no `aria-valuenow`+no crash, caller `aria-label`/`aria-valuetext` overrides Radix defaults |

### Change details

- **`progress.tsx` (W-A `1b3dcf4`)**: add `value={value}` before `{...props}` on `<ProgressPrimitive.Root>`. JSDoc documents that forwarding to Root is the prerequisite for Radix auto `aria-valuenow` and that caller `aria-*` can override via the trailing spread. Indicator style unchanged.
- **QuizPlay.tsx (W-A `1b3dcf4`)**: remove `aria-valuenow={percent}` from `<Progress>`. `value={percent}`·`aria-label`·`aria-valuetext` retained.
- **Tests (W-B `001b065`)**: new wrapper unit test (`src/components/ui/__tests__/progress.test.tsx`), 4 cases. `QuizPlay.test.tsx` unchanged — its `aria-valuenow='33'` assertion still passes via Radix auto-assignment (value=33) (regression confirmed).

## Verification

- **tsc**: 0 errors.
- **ESLint** (real binary): 0 new errors.
- **jest**: all suites PASS — progress +4 and QuizPlay regression 5 pass. Global coverage gates (lines/branches 83/71) maintained.
- **next build**: ✓. `/[locale]/quiz` bundle effectively unchanged (attribute/forwarding only, no new code).
- **ADR gates**: index count (sprint **161**, --strict) / adr-en coverage (sprint-223 EN, --strict) / adr-links 0 broken / doc-refs no broken.

## Lessons

1. **A wrapper-abstraction a11y gap must be fixed in the wrapper, not at the consumer, to resolve it globally** — Sprint 222 fixed it immediately via a QuizPlay-local patch, but other progressbars using the same wrapper still had the gap. Fixing the root cause (wrapper swallowing a prop) in the wrapper resolves all consumers at once and lets the consumer's workaround be removed.
2. **A headless wrapper is responsible for re-forwarding the props it destructures to Root** — if `value` is used only for style computation and not passed to `Root`, Radix cannot assign the prop-based ARIA. When building a wrapper, check "is the consumed prop needed for the library's automatic accessibility behavior".
3. **Auto-behavior props (value) and reinforcement props (aria-label/valuetext) play different roles** — `value` is the input from which Radix auto-assigns `role`/`valuenow`/`valuemin`/`valuemax`, while `aria-label` (accessible name) and custom `aria-valuetext` (progress text) are reinforcements the library cannot substitute, so the consumer must keep them explicit. After a global fix, remove the former (duplicate `aria-valuenow`) but keep the latter.
4. **A visual-neutral a11y fix should be locked with a regression safety net** — without a wrapper unit test, the "doesn't forward value to Root" regression can silently reappear. `progress.test.tsx` asserts value→aria-valuenow exposure to block recurrence of the global gap.

New pattern: none (global canonicalization of the existing headless-wrapper/Radix prop-forwarding pattern).

## Sprint 224+ Carryover

- radiogroup promotion (optional) — promote category/difficulty pills to radiogroup + roving tabindex (Sprint 222 carryover retained).
- quiz motion deepening · per-category statistics visualization (optional).
- **(ops) SP217 cutover — follow `sp217-quiz-records-cutover.md`: identity → gateway → frontend rollout + live `/quiz` E2E 6 items** (user/ops, important).
- live `/quiz` visual (Sprint 221) · a11y (Sprint 222) · progress screen-reader announcement (Sprint 223) verification — after redeploy, can be batched in the same frontend rollout.
- GA4 admin (stream URL · history page_view OFF · production UAT) — user-direct.
- ops Sprint 196 `problem_db` migration + redeploy — user/ops.
- harness checkup `--full` CI scheduled automation (monthly cron) review — Sprint 209 carryover.

## Critic Cross-Review

- **Tool**: Codex codex-cli 0.130.0, `codex review --base 33155d7 -c model=gpt-5.5`
- **Rounds**: 1

**R1 — CLEAN** (0 Critical/High/Medium/Low): *"The change correctly forwards the destructured Progress value to the Radix root, allowing Radix to emit progressbar ARIA attributes, and the removed QuizPlay aria-valuenow is covered by that forwarding. The added tests align with the intended behavior and no regressions are evident from the diff."*

**Verdict**: ✅ mergeable — the wrapper's `value`→`Root` forwarding emits Radix progressbar ARIA correctly, the `aria-valuenow` removed from QuizPlay is covered by that forwarding, and the added tests align with the intent. Single-round CLEAN, 0 fixes.
