---
sprint: 222
title: "Quiz Accessibility Deepening — Focus Management + aria-live (Follow-up to Sprint 221 Visual Revamp)"
date: "2026-06-06"
status: completed
agents: [Oracle, Scribe, Herald, Librarian, Critic]
related_adrs: ["sprint-215", "sprint-216", "sprint-217", "sprint-218", "sprint-219", "sprint-220", "sprint-221"]
related_memory: ["sprint-window", "ui-migration"]
topics: ["frontend", "ui", "quiz", "accessibility"]
tldr: "A frontend-only sprint that deepens keyboard/screen-reader accessibility of the CS quiz (/quiz) — feature- and visually-complete since Sprints 215–221. A pure a11y-logic sprint: 0 new design tokens, 0 new components, only 1 new i18n key (play.progressAria). (D1 focus management) Move focus to the primary action button on stage transitions, using a ref+useEffect focus() pattern instead of native autoFocus — avoids jsx-a11y/no-autofocus + is testable (toHaveFocus). QuizFeedback/QuizResult fresh-mount on stage transition, so an empty-deps mount-effect suffices. (D2 aria-live/accessible name) QuizPlay Progress gets aria-label+aria-valuetext (Radix already provides role=progressbar/valuenow, so only the text label), and the QuizResult new-best region is wrapped in an always-present role=status aria-live=polite div (region not conditionally rendered — only the inner text is conditional — for live-region stability). (D3 restraint) 0 new tokens/components; selection pills keep button+aria-pressed (no radiogroup promotion — already WCAG-compliant, minimizes regression risk). +5 regression tests (quiz 32→37), quiz components 100/100/100/100. The unreachable ref-null short-circuit branch is istanbul-ignored (CodePanel.tsx precedent) to restore 100% branch. Code is independent of live (merge≠live; separate ops carryover)."
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

- **QuizPlay Progress**: add `aria-label` ("Quiz progress") + `aria-valuetext`. Radix Progress already provides `role="progressbar"`/`aria-valuenow`, so only the text label/value text is added — no duplicate `role`.
- **QuizResult new-best region**: wrap the new-best announcement in an **always-present** `role="status"` `aria-live="polite"` div. The region itself is not conditionally rendered — **only the inner text is conditional** — because a live region inserted into the DOM late may cause screen readers to miss the announcement; keeping an empty live region in place and filling only its content stabilizes the announcement.

### D3. Restraint — 0 new tokens · 0 new components · no radiogroup promotion

0 new design tokens, 0 new components, and only **1 new i18n key** (`play.progressAria`). Selection pills (category/difficulty) keep `button`+`aria-pressed` and are **not promoted to radiogroup** — they already satisfy WCAG, and promotion would only add regression risk from introducing arrow-key navigation/roving tabindex. The scope stays "deepen a11y only" as a follow-up to the visual revamp (221).

## Implementation

### Deliverables (by wave)

| Wave | Agent | Commit | Content |
|---|---|---|---|
| W1 | Scribe | `2887859` | QuizFeedback/QuizResult focus move — `ref`+mount `useEffect focus()`, to the primary action button |
| W2 | Scribe | `7d628a6` | QuizPlay Progress `aria-label` ("Quiz progress")+`aria-valuetext`, QuizResult new-best `role="status"` `aria-live` region, i18n `play.progressAria` (ko "퀴즈 진행률" / en "Quiz progress") |
| W3 | Herald | `cfab61d` | +5 regression tests + `istanbul ignore` on 2 source files (unreachable ref-null short-circuit branch, `CodePanel.tsx` precedent) to restore 100% branch |
| W4 | Librarian | (this commit) | ADR sprint-222 KR+EN + `docs/adr/README.md` index 159→160 |

### Change details

- **QuizFeedback / QuizResult (W1 `2887859`)**: attach a `ref` to the primary action button and call `ref.current?.focus()` in an empty-deps `useEffect`. Since the component fresh-mounts on stage transition, focus auto-moves to the action button on each mount.
- **QuizPlay (W2 `7d628a6`)**: add `aria-label` (i18n `play.progressAria`) and `aria-valuetext` to Progress. Leave Radix's `role="progressbar"`/`aria-valuenow` as-is and only add the text label/value text.
- **QuizResult (W2 `7d628a6`)**: wrap the new-best announcement in an always-rendered `role="status"` `aria-live="polite"` div, filling the inner text only when it is a new best.
- **i18n (W2 `7d628a6`)**: new `play.progressAria` key — ko "퀴즈 진행률" / en "Quiz progress". Only 1 new key.
- **Tests + coverage restore (W3 `cfab61d`)**: +5 regression tests — QuizFeedback focus 2 · QuizResult focus + new-best live region 2 · QuizPlay progressbar aria 1. The short-circuit branch where `ref` is null is unreachable on a fresh mount, so an `istanbul ignore` comment (`CodePanel.tsx` precedent) is added to the 2 source files to restore 100% branch.

## Verification

- **tsc**: 0 errors. **next lint**: 0 new errors/warnings vs. baseline (the single `react/forbid-dom-props` warn in `QuizResult.tsx` is the inline token-reference precedent introduced in Sprint 221 — not new).
- **jest (quiz)**: **6 suites / 37 tests PASS** (32→37, +5). Quiz components **100/100/100/100** (stmts/branch/funcs/lines).
- **Global coverage · next build · ADR gates**: Oracle final verification.
- **ADR gates**: index count (sprint 160, --strict) / adr-en coverage (sprint-222 EN, --strict) / adr-links 0 broken / doc-refs no broken.

## Lessons

1. **Focus management is the core of stage-transition a11y** — when a stage changes, the keyboard user's focus destination must be explicit. For fresh-mounting components, an empty-deps mount-effect `focus()` solves it concisely. Native `autoFocus` is unfavorable for lint (`jsx-a11y/no-autofocus`) and tests (hard to control timing), so the `ref` pattern is canonical.
2. **Keep live regions always in the DOM and conditionalize only the inner text** — conditionally rendering the live region (`role="status"`/`aria-live`) itself inserts it late into the DOM and may drop the screen-reader announcement. Keeping an empty live region present and filling only its content stabilizes the announcement timing.
3. **Headless components (Radix, etc.) provide role/valuenow automatically** — Progress's `role="progressbar"`/`aria-valuenow` are filled by the library, so we only reinforce the text label (`aria-label`/`aria-valuetext`). Never assign a duplicate `role`.
4. **Restraint** — the follow-up to the visual revamp (221) deepened a11y with 0 new tokens/components. By not promoting selection pills to radiogroup (already WCAG-compliant), regression risk from introducing arrow-key/roving tabindex was minimized.

New pattern: **stage-transition focus-move pattern** — in fresh-mounting components, attach a `ref` to the primary action button and call `focus()` from an empty-deps `useEffect` (no native `autoFocus`; avoids lint + enables `toHaveFocus` tests) + **always-present live region** (`role="status"`/`aria-live`, only inner text conditional) to announce dynamic state to screen readers stably.

## Sprint 223+ carryover

- Radiogroup promotion (optional) — promote category/difficulty pills to radiogroup + roving tabindex.
- Motion deepening (optional).
- **(ops execution) SP217 cutover — follow `sp217-quiz-records-cutover.md` to roll out identity → gateway → frontend + verify the live `/quiz` E2E 6 items** (user/ops, important).
- Visual check of the live `/quiz` UI revamp (Sprint 221) — light/dark category colors, icons, animation — after redeploy.
- GA4 admin (stream URL · history page_view OFF · production UAT) — user.
- Ops Sprint 196 `problem_db` migration + redeploy — user/ops.
- Harness checkup `--full` CI scheduled automation (monthly cron) review — Sprint 209 carryover.

## Critic Cross-Review

To be performed by Critic just before Oracle's merge.
