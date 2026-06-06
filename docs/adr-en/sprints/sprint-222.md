---
sprint: 222
title: "Quiz Accessibility Deepening — Focus Management + aria-live (Follow-up to Sprint 221 Visual Revamp)"
date: "2026-06-06"
status: completed
agents: [Oracle, Scribe, Herald, Librarian, Critic]
related_adrs: ["sprint-215", "sprint-216", "sprint-217", "sprint-218", "sprint-219", "sprint-220", "sprint-221"]
related_memory: ["sprint-window", "ui-migration"]
topics: ["frontend", "ui", "quiz", "accessibility"]
tldr: "A frontend-only sprint that deepens keyboard/screen-reader accessibility of the CS quiz (/quiz) — feature- and visually-complete since Sprints 215–221. A pure a11y-logic sprint: 0 new design tokens, 0 new components, only 3 new i18n keys (play.progressAria / result.announceDone / result.announceNewBest). (D1 focus management) Move focus to the primary action button on stage transitions, using a ref+useEffect focus() pattern instead of native autoFocus — avoids jsx-a11y/no-autofocus + is testable (toHaveFocus). QuizFeedback/QuizResult fresh-mount on stage transition, so an empty-deps mount-effect suffices. (D2 aria-live/accessible name) QuizPlay Progress gets aria-label+aria-valuetext + an explicit progressbar aria-valuenow (the local progress.tsx wrapper did not forward value to Root, so Radix aria-valuenow was undefined; QuizPlay passes it directly to fix the gap — Critic R2 P2), and the QuizResult new-best announcement uses a dedicated sr-only role=status aria-live=polite region mounted empty first, then injected with the announcement text via useEffect ('exist then mutate' canonical form — Critic R1 P2), with the visual score/badge reduced to pure visual elements. (D3 restraint) 0 new tokens/components; selection pills keep button+aria-pressed (no radiogroup promotion — already WCAG-compliant, minimizes regression risk). +6 regression tests (global 1504→1510), quiz components 100/100/100/100, global lines 87.71%/branches 79.04% (gates 83/71). The unreachable ref-null short-circuit branch is istanbul-ignored (CodePanel.tsx precedent) to restore 100% branch. Critic 3 rounds (R1·R2 each P2 → resolved by 5163fdc·93ca2a7, R3 runtime CLEAN + P3 ADR i18n key-count correction). Code is independent of live (merge≠live; separate ops carryover)."
---
# Sprint 222 — Quiz Accessibility Deepening

## Goal

- **Deepen keyboard/screen-reader accessibility** of the CS quiz (`/quiz`) — feature- and visually-complete across Sprints 215–221.
- User-confirmed scope: the core axis is **accessibility deepening**. Selection pills (category/difficulty) keep their current `button`+`aria-pressed` (**no radiogroup promotion** — already WCAG-compliant, minimizing regression risk).
- Frontend-only — no data/schema/backend change. 0 new design tokens/components (pure a11y logic). `/quiz` is auth-gated, so live verification is a separate ops carryover (merge ≠ live).

## Background

Sprint 221 lifted the look of `/quiz` with category accent tokens and a 3-screen visual revamp, but on stage transitions (question → feedback → result) focus stayed at its previous position — keyboard users could not easily find the next action — and dynamic state like progress and new-best was not sufficiently announced to screen readers. Right after the visual revamp, this sprint deepens a11y by adding only **focus management + accessible names/live regions**, without creating new tokens or components.

## Decisions

### D1. Focus management = `ref + useEffect focus()` (no native `autoFocus`)

Move focus to the primary action button on stage transitions, using a **`ref` + `ref.current?.focus()` in an empty-deps mount-effect `useEffect`** instead of the native `autoFocus` attribute.

Rationale:
- Avoids the `jsx-a11y/no-autofocus` lint rule.
- Testable — regression can be verified with `expect(button).toHaveFocus()`.
- QuizFeedback/QuizResult **fresh-mount** on stage transition, so an empty-deps mount-effect that runs once per mount suffices (auto re-runs on each remount).

### D2. aria-live / accessible-name reinforcement

- **QuizPlay Progress**: add `aria-label` ("Quiz progress") + `aria-valuetext`, and **expose `aria-valuenow={percent}` explicitly**. Radix Progress normally provides `role="progressbar"`/`aria-valuenow`, but the **local `progress.tsx` wrapper used `value` only for styling and did not forward it to `ProgressPrimitive.Root`**, leaving Radix `aria-valuenow` as `undefined` (Critic R2 P2). Passing `aria-valuenow` explicitly from QuizPlay overrides it (Radix spreads user props last). No duplicate `role`. The shared `progress.tsx` itself is left untouched (scope discipline) — a global wrapper fix is carried over.
- **QuizResult new-best announcement**: remove the `role="status"` wrapper that had enclosed the visual score/badge so the **visual content is reduced to pure visual elements**, and announce via a **dedicated `sr-only` `role="status"` `aria-live="polite"` div mounted empty first, then injected with the announcement text via `useEffect`** (Critic R1 P2). A live region inserted into the DOM already-filled at mount may cause screen readers to miss the announcement, so the canonical **"exist empty first → mutate text later"** pattern stabilizes the announcement.

### D3. Restraint — 0 new tokens · 0 new components · no radiogroup promotion

0 new design tokens, 0 new components, and only **3 new i18n keys** (`play.progressAria` / `result.announceDone` / `result.announceNewBest`). Selection pills (category/difficulty) keep `button`+`aria-pressed` and are **not promoted to radiogroup** — they already satisfy WCAG, and promotion would only add regression risk from introducing arrow-key navigation/roving tabindex. The scope stays "deepen a11y only" as a follow-up to the visual revamp (221).

## Implementation

### Deliverables (by wave)

6 atomic commits total (start `68740f2`):

| Wave | Agent | Commit | Content |
|---|---|---|---|
| W1 | Scribe | `2887859` | QuizFeedback/QuizResult focus move to the primary action button on stage transition — `ref`+mount `useEffect focus()` |
| W2 | Scribe | `7d628a6` | QuizPlay Progress `aria-label` ("Quiz progress")+`aria-valuetext`, QuizResult new-best live region (initial impl), i18n `play.progressAria` (ko "퀴즈 진행률" / en "Quiz progress") |
| W3 | Herald | `cfab61d` | +5 regression tests + `istanbul ignore` on 2 source files (unreachable ref-null short-circuit branch, `CodePanel.tsx` precedent) to restore 100% branch |
| W4 | Librarian | `990ff89` | ADR sprint-222 KR+EN + `docs/adr/README.md` index 159→160 |
| P2-1 | Scribe (Critic R1) | `5163fdc` | QuizResult new-best live region **sr-only canonicalization** — remove the `role="status"` wrapper around visual content → pure visual; mount a dedicated `sr-only role="status" aria-live="polite"` div empty first, then inject the announcement via `useEffect` ("exist then mutate"). Add i18n `result.announceDone`/`result.announceNewBest` (2 keys). Switch 2 tests to async (`waitFor`) |
| P2-2 | Scribe (Critic R2) | `93ca2a7` | QuizPlay progressbar **`aria-valuenow={percent}`** explicit exposure — the local wrapper `progress.tsx` swallowed `value`, leaving Radix `aria-valuenow` `undefined`; fix by passing it directly from QuizPlay (Radix spreads user props last → override). Shared `progress.tsx` untouched (scope discipline), global wrapper fix carried over. Add `aria-valuenow='33'` assertion |

### Change details

- **QuizFeedback / QuizResult (W1 `2887859`)**: attach a `ref` to the primary action button and call `ref.current?.focus()` in an empty-deps `useEffect`. Since the component fresh-mounts on stage transition, focus auto-moves to the action button on each mount.
- **QuizPlay (W2 `7d628a6` → P2-2 `93ca2a7`)**: add `aria-label` (i18n `play.progressAria`) and `aria-valuetext` to Progress. The local wrapper `progress.tsx` did not forward `value` to `Root`, leaving Radix `aria-valuenow` empty; QuizPlay passes `aria-valuenow={percent}` explicitly to fix it (`93ca2a7`).
- **QuizResult (W2 `7d628a6` → P2-1 `5163fdc`)**: the initial impl wrapped visual content in a `role="status"` div; per Critic R1 P2, the visual content is reduced to pure visual elements and the new-best/done announcement uses a dedicated `sr-only role="status" aria-live="polite"` region mounted empty first, then injected with the announcement text via `useEffect` (`5163fdc`).
- **i18n (W2 `7d628a6` + P2-1 `5163fdc`)**: **3 new keys** — `play.progressAria` (ko "퀴즈 진행률" / en "Quiz progress"), `result.announceDone` (ko "퀴즈 완료, 정답률 {score}퍼센트입니다." / en "Quiz complete, accuracy {score} percent."), `result.announceNewBest` (ko "퀴즈 완료, 정답률 {score}퍼센트, 최고 기록을 갱신했습니다." / en "Quiz complete, accuracy {score} percent, new best record.").
- **Tests + coverage restore (W3 `cfab61d`)**: +5 regression tests — QuizFeedback focus 2 · QuizResult focus + new-best live region 2 · QuizPlay progressbar aria 1. The short-circuit branch where `ref` is null is unreachable on a fresh mount, so an `istanbul ignore` comment (`CodePanel.tsx` precedent) is added to the 2 source files to restore 100% branch. P2-1 then switches the 2 QuizResult live-region tests to async (`waitFor`), and P2-2 adds the progressbar `aria-valuenow='33'` assertion.

## Verification

- **tsc**: 0 errors. **ESLint** (real binary, `.eslintrc.json`): **0 errors / 483 warnings** — all are the existing `forbid-dom-props`/`exhaustive-deps` baseline; the 3 in the quiz directory are all the inline `var()` token-reference precedent introduced in Sprint 221. **0 new lint errors/warnings**. (The RTK wrapper's "Errors:1" is an artifact, not a real error.)
- **jest**: **148 suites / 1510 tests PASS** (1504→1510, +6). Quiz components **100/100/100/100** (stmts/branch/funcs/lines). Global coverage lines **87.71%** / branches **79.04%** (gates 83/71 pass).
- **next build**: ✓. `ƒ /[locale]/quiz` **39.3 kB** (same as Sprint 221 — a11y adds only attributes/refs, no bundle growth).
- **ADR gates**: index count (sprint **160**, --strict) / adr-en coverage (sprint-222 EN, --strict — 169/169) / adr-links 0 broken / doc-refs no broken.

## Lessons

1. **Focus management is the core of stage-transition a11y** — when a stage changes, the keyboard user's focus destination must be explicit. For fresh-mounting components, an empty-deps mount-effect `focus()` solves it concisely. Native `autoFocus` is unfavorable for lint (`jsx-a11y/no-autofocus`) and tests (hard to control timing), so the `ref` pattern is canonical.
2. **Keep live regions always in the DOM and conditionalize only the inner text** — conditionally rendering the live region (`role="status"`/`aria-live`) itself inserts it late into the DOM and may drop the screen-reader announcement. Keeping an empty live region present and filling only its content stabilizes the announcement timing.
3. **Headless components (Radix, etc.) provide role/valuenow automatically** — Progress's `role="progressbar"`/`aria-valuenow` are filled by the library, so we only reinforce the text label (`aria-label`/`aria-valuetext`). Never assign a duplicate `role`.
4. **Restraint** — the follow-up to the visual revamp (221) deepened a11y with 0 new tokens/components. By not promoting selection pills to radiogroup (already WCAG-compliant), regression risk from introducing arrow-key/roving tabindex was minimized.
5. **A live region must be "mounted empty first → then inject text" for a stable announcement** — inserting a `role="status"` already-filled at mount on a fresh-mounting component means the screen reader never detects a change and misses the announcement (Critic R1). The canonical form is a dedicated `sr-only` region present empty first, with text injected via `useEffect`.
6. **A headless wrapper that consumes (destructures) a prop can drop the ARIA derived from it** — `progress.tsx` used `value` only for styling and did not forward it to `Root`, so `aria-valuenow` was missing (Critic R2). Verify that wrapper abstractions do not swallow accessibility attributes.

New pattern: **stage-transition focus-move pattern** — in fresh-mounting components, attach a `ref` to the primary action button and call `focus()` from an empty-deps `useEffect` (no native `autoFocus`; avoids lint + enables `toHaveFocus` tests) + **always-present live region** (`role="status"`/`aria-live`, only inner text conditional) to announce dynamic state to screen readers stably.

## Sprint 223+ carryover

- **(follow-up, optional) Globally fix the shared `progress.tsx` wrapper to forward `value` to `ProgressPrimitive.Root`** — currently every progressbar in the app lacks `aria-valuenow`, a latent a11y gap. This sprint only fixed the quiz locally (scope discipline).
- Radiogroup promotion (optional) — promote category/difficulty pills to radiogroup + roving tabindex.
- Motion deepening (optional).
- **(ops execution) SP217 cutover — follow `sp217-quiz-records-cutover.md` to roll out identity → gateway → frontend + verify the live `/quiz` E2E 6 items** (user/ops, important).
- Visual check of the live `/quiz` UI revamp (Sprint 221) — light/dark category colors, icons, animation — after redeploy.
- GA4 admin (stream URL · history page_view OFF · production UAT) — user.
- Ops Sprint 196 `problem_db` migration + redeploy — user/ops.
- Harness checkup `--full` CI scheduled automation (monthly cron) review — Sprint 209 carryover.

## Critic Cross-Review

- **Tool**: Codex codex-cli 0.130.0, `codex review --base 68740f2 -c model=gpt-5.5`
- **Rounds**: 3

**R1 — [P2]**: the QuizResult live region was inserted into the DOM already-filled at mount, risking a missed new-best announcement → resolved by `5163fdc` (mount the sr-only region empty first + inject via `useEffect`).

**R2 — [P2]**: original P2 confirmed resolved. New [P2] — QuizPlay progressbar did not expose `aria-valuenow` (the local wrapper `progress.tsx` did not forward `value` to `Root`) → resolved by `93ca2a7` (expose `aria-valuenow` explicitly).

**R3 — runtime code CLEAN**: *"changes appear consistent and should not break existing behavior."* [P3] non-blocking — inaccurate ADR i18n key count (1→3) → corrected in this finalization commit.

**Verdict**: ✅ Mergeable — 0 Critical/High in code, both P2 findings fixed, R3 runtime CLEAN, P3 ADR correction complete.
