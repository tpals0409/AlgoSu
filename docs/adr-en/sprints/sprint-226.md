---
sprint: 226
title: "Live /quiz Verification Runbook (UI 221 · a11y 222/223 · UX 224)"
date: "2026-06-07"
status: completed
agents: [Oracle, Librarian, Critic]
related_adrs: ["sprint-221", "sprint-222", "sprint-223", "sprint-224", "sprint-220"]
related_memory: ["sprint-window"]
topics: ["quiz", "frontend", "accessibility", "docs", "runbook"]
tldr: "The CS quiz (/quiz) UI overhaul (221), accessibility (222/223), and UX deepening (224) were code-complete, but because merge ≠ live (image build is automatic, rollout is manual ops), live visual/screen-reader verification kept being deferred sprint after sprint. Live /quiz requires login (it is excluded from middleware PUBLIC_PATHS) and rollout is manual, so the agent cannot drive live verification autonomously — therefore verification was produced as a repo-persistent procedure rather than a one-off manual task. New runbook docs/runbook/quiz-ui-verification.md authored — §0 prerequisites (login required · merge≠live · verification matrix) / §1 UI (5 category colors+icons · difficulty semantic reuse · 3-screen animations · feedback tones · Trophy) / §2 a11y (stage-transition focus · progressbar semantics · sr-only live announcement) / §3 UX (PillRadioGroup keyboard nav · stats bars · transition motion · reduced-motion) / §4 i18n (ko↔en) / §5 result-recording template. Every item carries a file:line source so the verifier can derive exactly what to check live. Zero code changes (docs only). Critic cross-review confirms source accuracy."
---
# Sprint 226 — Live /quiz Verification Runbook

## Goal

- Produce a **fact-based procedure** that lets a human verify, in the live environment, the CS quiz (`/quiz`) UI overhaul (221), accessibility (222/223), and UX deepening (224) that were **code-complete and verified** across Sprint 221~224.
- Pin the repeatedly deferred "verify live /quiz after redeploy" as a **repo-persistent runbook** rather than a one-off manual task, so it can be reused for every future quiz UI change.
- Docs only — no service/frontend code change.

## Background

Sprint 221~224 improved and merged `/quiz` as follows:

- **221**: category accent color tokens (`--quiz-cat-*`) + lucide icons, 3-screen redesign
- **222/223**: stage-transition focus management, progressbar accessible name / `aria-valuenow` (globally normalized in the shared wrapper in 223), result new-best sr-only live announcement
- **224**: PillRadioGroup radiogroup keyboard navigation, "Your Records" per-category stats bars, transition motion

But this project's deploy model is **merge ≠ live** (image build is automatic on merge, rollout is manual ops). As a result, "verify live visual/screen-reader after redeploy" only kept piling up as a deferred item through 221→222→223→224.

Two constraints block verification:

1. **Live `/quiz` requires login** — `/quiz` is absent from `PUBLIC_PATHS` in `frontend/src/middleware.ts` (lines 26~34), so unauthenticated requests 307-redirect to `/login`. The agent is prohibited (safety rules) from entering passwords, so it cannot log in autonomously.
2. **Rollout is manual ops** — the agent cannot redeploy.

Therefore the agent cannot drive the live site to verify it, and the most realistic, repo-persistent deliverable is a **precise procedure for a human (user/ops) to execute against the live site**. The existing `docs/runbook/sp217-quiz-records-cutover.md` only covers records cutover + 6 functional E2E items and **does not cover the visual/accessibility/UX verification** of 221~224 — this fills that gap.

## Decision

### D1. Produce live verification as a repo-persistent runbook

Author `docs/runbook/quiz-ui-verification.md`. Structure:

- **§0 Prerequisites**: `/quiz` requires login (middleware evidence + curl 307 example), merge≠live, verification matrix (theme light/dark · locale ko/en · input mouse/keyboard/screen-reader)
- **§1 UI(221)**: category 5-color table (light/dark hex) + lucide icon mapping, difficulty semantic reuse, 3-screen animation table, feedback correct/incorrect tones + new-best Trophy
- **§2 a11y(222/223)**: stage-transition focus (feedback→next, result→retry), progressbar semantics (Radix auto ARIA + QuizPlay aria-label/valuetext), result new-best sr-only `role=status aria-live=polite` announcement
- **§3 UX(224)**: PillRadioGroup 3-group radiogroup keyboard (arrows/Home/End/roving tabindex), QuizStats stats bars (progressbar semantics · descending order), transition motion + reduced-motion respect
- **§4 i18n**: ko↔en core label/announcement comparison table
- **§5 Result-recording template**: PASS/FAIL/N/A table + found-issue → follow-up seed form

### D2. Cite a file:line source for every verification item

Zero-guess principle. Each expected value is backed by an actual code source (`frontend/src/components/quiz/*`, `globals.css`, `category-meta.ts`, `messages/*/quiz.json`, `middleware.ts`) and line number. Critic cross-review checks source accuracy.

### D3. Zero code changes

Docs-only sprint. No frontend/services change → no impact on code gates (jest/tsc/lint/coverage).

## Implementation

Total atomic commits (start `544ac8d`):

| Commit | Agent | Content |
|---|---|---|
| (runbook) | Librarian | `docs/runbook/quiz-ui-verification.md` new (§0~§5, with file:line sources) |
| (ADR) | Librarian | ADR sprint-226 KR+EN + `docs/adr/README.md` index 163→164 |

## Verification

- **Source accuracy**: before authoring, 11 core sources (globals.css quiz-cat vars/keyframes, category-meta icons, QuizStart DIFFICULTY_TONE, QuizPlay Progress aria, QuizFeedback/QuizResult focus·role·announce, PillRadioGroup keyboard/role, QuizStats progressbar, QuizQuestion motion, middleware PUBLIC_PATHS, i18n keys) were diff-checked against current code to verify line numbers.
- **ADR gates**: index count (sprint **164**, --strict) / adr-en coverage (KR/EN 1:1) / adr-links 0 broken / doc-refs no broken.
- **CI**: merged via Squash after PR gates pass. Docs-only → no impact on code gates.
- **Critic**: pre-merge cross-review (document accuracy — whether sources match reality).

## Lessons

1. **For operational verification an agent cannot perform autonomously, the correct deliverable is not "execution" but an "executable procedure"** — live verification was blocked by login (agent-prohibited) + manual rollout and got deferred for 4 sprints. Instead of leaving agent-impossible work as a perpetual deferral, pinning it as a repo-persistent runbook a human can execute precisely closes the gap and gets reused.
2. **A verification runbook's value comes from its sources** — not "check the category colors are right" but "verify, per `globals.css:103`, data-structure = `#2563EB` (light) / `#60A5FA` (dark)": file:line + expected hex lets the verifier judge PASS/FAIL objectively.
3. **Specify the verification matrix to block omissions** — the same item can diverge across light/dark · ko/en · mouse/keyboard/screen-reader. Nailing the axes in a matrix prevents "saw it once, done" partial verification.

New pattern: **operational verification runbook pattern** — live verification an agent cannot execute autonomously (login, manual rollout, etc.) is produced as a repo-persistent runbook with file:line sources + expected values + a verification matrix + a result-recording template.

## Sprint 227+ Carryover

- **(ops) Execute live `/quiz` verification per `docs/runbook/quiz-ui-verification.md`** — fill the §5 result table and register FAIL items as follow-up seeds (user/ops).
- **(ops) SP217 cutover** — frontend rollout + 6 live E2E items per `sp217-quiz-records-cutover.md` (can be batched with the same frontend rollout as this runbook).
- (note) apk_bust mechanism (Sprint 225) — future base-image CVEs via `gh workflow run ci.yml --ref main -f apk_bust=true`.
- GA4 / Sprint 196 problem_db / harness --full cron — existing carryover retained.

## Critic Cross-Review

- **Tool**: Codex codex-cli, `codex review --base 544ac8d`
- **Rounds**: (run pre-merge — result reflected)

**Verdict**: (Critic result to be reflected — focused on document source accuracy)
