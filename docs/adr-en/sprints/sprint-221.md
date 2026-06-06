---
sprint: 221
title: "Quiz UI Revamp (Full) — Category Accent Tokens + 3-Screen Redesign"
date: "2026-06-06"
status: completed
agents: [Oracle, Palette, Herald, Scribe, Librarian, Critic]
related_adrs: ["sprint-215", "sprint-216", "sprint-217", "sprint-218", "sprint-219", "sprint-220"]
related_memory: ["sprint-window", "ui-migration"]
topics: ["frontend", "ui", "design-tokens", "quiz", "accessibility"]
tldr: "A frontend-only sprint that fully revamps the start/play/result screens of the CS quiz (/quiz) — feature-complete since Sprints 215–219 — onto the design-token system. It registers 20 new per-category accent color tokens --quiz-cat-* across globals.css :root and .dark (every color WCAG AA 4.5:1+ measured — light 4.95–6.05, dark 7.03–10.59), and centralizes a category→{lucide icon, color-token var()} mapping in a new data/quiz/category-meta.ts SSOT consumed consistently by 5 components. Three restraint decisions: difficulty (EASY/MEDIUM/HARD) reuses existing semantic tokens (success/warning/error) instead of new tokens → 0 added; 0 new components/ui/ (existing Card/Button/Badge/Progress/Input/ScoreGauge + inline var()); 0 new keyframes (reuse fade-in/glow-pulse). Category colors follow the --diff-*/--lang-* precedent — kept as raw CSS variables (no @theme mapping) and consumed via inline style var() (honoring the bg-[#...] hardcode ban; react/forbid-dom-props warn is the established exception). All category pill/chip icons are aria-hidden so accessible names are preserved → 0 getByRole(name) regressions. Tests 1498→1504 (+6); quiz components + category-meta 100/100/100/100; global lines 87.67%/branches 79.02% (gates 83/71). Critic R1 CLEAN (0 findings). Code/schema are independent of live (merge≠live; separate ops carryover)."
---
# Sprint 221 — Quiz UI Revamp (Full)

## Goal

- **Fully redesign the start/play/result screens of the CS quiz (`/quiz`)** — feature-complete and verified across Sprints 215–219 — onto the design-token system.
- User-confirmed scope: (1) full revamp of all 3 screens, (2) **introduce per-category (DS/Algo/Network/OS/DB) accent color tokens + lucide icon mapping**.
- Frontend-only — no data/schema/backend change. The `/quiz` route is auth-gated, so live verification is a separate ops carryover (merge ≠ live).

## Background

Sprints 215 (minigame core), 216 (150 questions + difficulty filter UX), 217 (logged-in record server persistence), 218 (regression safety net), and 219 (lint cleanup) made the quiz **feature-complete**, but the UI stayed plain — single-color text pills for category/difficulty, a gauge+text result screen — under-using AlgoSu UI v2 (category/difficulty visual distinction, glassmorphism, animation). This sprint revamps the 3 screens while honoring the token-registration discipline (**Palette confirm → Herald register → consume**).

## Decisions

### D1. Category colors = new raw CSS-variable tokens (no `@theme` mapping)

Five category accents are registered as `--quiz-cat-{slug}-color`/`-bg` in `globals.css` `:root` (light) and `.dark` (dark) — 20 vars. Following the `--diff-*`/`--lang-*` precedent, the **`@theme inline` Tailwind mapping is omitted**; they stay raw CSS variables consumed via inline `style={{ color: 'var(--quiz-cat-*-color)' }}` (the `DifficultyBadge` pattern). This honors the `bg-[#...]` hardcode ban while keeping light/dark auto-switching.

Colors and WCAG AA (text contrast 4.5:1+) measured:

| Category | Light (on #FAFAF8) | Dark (on #0F0F12) | Icon |
|---|---|---|---|
| DATA_STRUCTURE | `#2563EB` (4.95:1) | `#60A5FA` (7.53:1) | `Boxes` |
| ALGORITHM | `#7C3AED` (5.45:1) | `#A78BFA` (7.03:1) | `GitBranch` |
| NETWORK | `#0E7490` (5.13:1) | `#22D3EE` (10.59:1) | `Network` |
| OS | `#A21CAF` (6.05:1) | `#E879F9` (7.78:1) | `Cpu` |
| DATABASE | `#047857` (5.25:1) | `#34D399` (9.95:1) | `Database` |

Soft bg = base color at light 0.10 / dark 0.14 opacity. The 5 hues (blue/violet/cyan/fuchsia/emerald) avoid overlapping the difficulty semantics (success/warning/error).

### D2. Difficulty colors = reuse existing semantics (0 new tokens)

Difficulty EASY/MEDIUM/HARD **reuses existing semantic tokens** instead of new ones: EASY→`success`, MEDIUM→`warning`, HARD→`error`, ALL→`primary` (neutral). Rationale: already light/dark + WCAG verified, intuitive mapping, and avoids token sprawl. This removes the need for a difficulty Palette wave entirely.

### D3. 0 new ui components · 0 new keyframes

Existing `Card/Button/Badge/Progress/Input/ScoreGauge` + inline `var()` cover all 3 screens → no `components/ui/` creation (which would trigger the Palette UI guide). Animations reuse `.animate-fade-in` and `@keyframes glow-pulse` (inline `style={{ animation: 'glow-pulse ...' }}` precedent) → 0 new keyframes. `prefers-reduced-motion` is already neutralized globally in globals.css, so no extra guard is needed.

## Implementation

### Deliverables (by wave)

| Wave | Agent | Files | Content |
|---|---|---|---|
| W0 | Palette | (guide) | Confirm 5 category colors + WCAG AA measurement |
| W1 | Herald | `frontend/src/app/globals.css` | Register 20 `--quiz-cat-*` tokens (light 10 + dark 10) |
| W2 | Scribe | `frontend/src/data/quiz/category-meta.ts` (new) | category→{lucide icon, colorVar, bgVar} SSOT + `index.ts` re-export |
| W2 | Scribe | `frontend/src/components/quiz/{QuizStart,QuizPlay,QuizQuestion,QuizFeedback,QuizResult}.tsx` | 3-screen redesign |
| W3 | Scribe | `__tests__/{QuizStart,QuizPlay}.test.tsx`, `data/quiz/__tests__/category-meta.test.ts` (new) | +6 regression tests |
| W4 | Librarian | `docs/adr/sprints/sprint-221.md` + EN + `docs/adr/README.md` | ADR + index 158→159 |

### Per-component changes

- **category-meta.ts (new SSOT)**: `QUIZ_CATEGORY_META: Record<QuizCategory, { icon, colorVar, bgVar }>` + `getQuizCategoryMeta()`. Colors are `var(--quiz-cat-*)` strings (0 hardcoded hex). Icons `Boxes/GitBranch/Network/Cpu/Database`.
- **QuizStart**: category pills get an icon (**aria-hidden**) + accent color when active (inline `style` var: color/bg/border); difficulty pills use semantic tones (`DIFFICULTY_TONE` static class map); header icon chip; card `animate-fade-in`. `resolveCountOptions` logic unchanged.
- **QuizPlay**: category chip in the progress header (aria-hidden icon + accent color), `animate-fade-in`. Progress bar stays primary (ui untouched).
- **QuizQuestion**: prompt promoted into a card (`bg-bg-alt` border). Submit/autoFocus/empty-input-ignore logic unchanged.
- **QuizFeedback**: container tone by correctness (`success-soft`/`error-soft` + 4px left accent border), `animate-fade-in`. `role="status"`, icon, Badge, explanation box preserved.
- **QuizResult**: new-best gets a `Trophy` badge + gauge-wrapper `glow-pulse` celebration (inline style), `animate-fade-in`. ScoreGauge / correct count / best score text preserved.

## Verification

- **tsc**: 0 errors. **next lint**: 0 errors (3 inline `var()` style `react/forbid-dom-props` warnings match the existing 459 precedent incl. `DifficultyBadge`; `next lint` does not fail on warns, same as CI).
- **test:coverage**: 148 suites / **1504 tests** PASS (1498→+6). Global lines **87.67%** / branches **79.02%** (gates 83/71). Quiz components + `category-meta.ts` **100/100/100/100**.
- **next build**: ✓. `ƒ /[locale]/quiz` **39.3 kB** (37.5kB at SP217 → +1.8kB for 6 lucide icons + meta).
- **ADR gates**: index count (sprint 159, --strict) / adr-en coverage (sprint-221 EN, --strict) / adr-links 0 broken / doc-refs no broken.

## Lessons

1. **Multi-valued categorical colors belong as raw CSS variables + inline `var()`** — Tailwind `@theme` mapping is for single-meaning tokens (primary/success); color families that grow to N entries (category/language/difficulty) follow the `--diff-*`/`--lang-*` precedent: raw variables consumed via inline `style`. The `react/forbid-dom-props` warn is the intended exception here (a token reference, not a hardcoded hex).
2. **Restraint is design quality** — reuse semantic tokens for difficulty instead of new ones, 0 new ui components, 0 new keyframes. Even a "full revamp" meets its goal by recombining existing assets, avoiding token/component/animation sprawl and the Palette UI-guide trigger.
3. **All decorative elements get `aria-hidden`** — putting icons in pills/chips pollutes the accessible name and breaks every `getByRole('button', { name })` test. Forcing `aria-hidden` on lucide icons keeps only the label text in the name, giving visual richness with 0 regressions.
4. **One SSOT for icon+color simplifies consumers** — `category-meta.ts` defining category→{icon, color tokens} once lets QuizStart (pill) and QuizPlay (chip) consume the same mapping via `getQuizCategoryMeta(category)`; adding a category means editing one place.

New pattern: **category accent token pattern** — `--quiz-cat-{slug}-color/-bg` (raw var, no @theme mapping) + `category-meta.ts` SSOT (icon+token) + inline `var()` consumption + decorative-icon `aria-hidden`. (Applying the `--diff-*`/`DifficultyBadge` precedent to the quiz domain.)

## Sprint 222+ carryover

- **(ops execution) SP217 cutover — follow `sp217-quiz-records-cutover.md` to roll out identity → gateway → frontend + verify the live `/quiz` E2E 6 items** (user/ops, important).
- Visual check of the live `/quiz` UI revamp (light/dark category colors, icons, animation) — after redeploy.
- GA4 admin (stream URL · history page_view OFF · production UAT) — user.
- Ops Sprint 196 `problem_db` migration + redeploy — user/ops.
- Harness checkup `--full` CI scheduled automation (monthly cron) review — Sprint 209 carryover.

## Critic Cross-Review

- **Scope**: 11 `frontend/` files (base `6c2c128`..HEAD, code + tests)
- **Codex command**: `codex review --base 6c2c128 -c model=gpt-5.5`
- **Session ID**: `019e9bf6-e285-79a3-84d8-55f3d73a626b`

**R1 — Critical/High/Medium/Low 0 (CLEAN)**: *"The changes are UI-focused and the new category metadata mapping is consistently wired into the quiz components with corresponding tokens and tests. I did not identify any discrete correctness, accessibility, or build-breaking issue introduced by the patch."*

**Verdict**: ✅ Mergeable — single-round CLEAN. The revamp + meta mapping are consistently wired with tokens and tests, no accessibility/build regression.
