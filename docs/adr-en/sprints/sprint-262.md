---
sprint: 262
title: "Study Card Affordance Improvement + Problem Card Deeplink (Feedback #5)"
date: "2026-07-27"
status: completed
agents: [Oracle, Palette]
related_adrs: ["sprint-261"]
related_memory: ["sprint-window"]
topics: ["frontend", "ux", "affordance", "navigation", "i18n", "deeplink"]
tldr: "Closed algosu-feedback issue #5, redefined through user interview, as Sprint 262. The original request was 'clicking a problem in the list should navigate to that problem', but the interview revealed the root cause was a study-card affordance problem on the My Studies screen — the card body (→ dashboard) has a hover response, but the full-width primary 'View Details' button visually dominated, so users landed on study detail instead of the dashboard. Fix: (1) removed the full-width 'View Details' button, shrank it to a top-right text button (settings access is already available via the gear on the detail page), making the card body the sole large click target. (2) added cursor/hover affordance to the problem card + a study-room deeplink on click (`/studies/{id}/room?problemId={pid}` — the study room already has an entry point that auto-selects the problem from the problemId query, so zero backend/new-route change). 4 FE files (studies/page.tsx, studies/[id]/page.tsx, ko/en studies.json). Critic CLEAN (0 findings), CI 39/39 green, jest 1822/1822, tsc 0 new errors, ESLint 0 errors. PR #507 `29eac0e` (squash)."
---
# Sprint 262 — Study Card Affordance Improvement + Problem Card Deeplink (Feedback #5)

_Date: 2026-07-27_

## Goal

Close `tpals0409/algosu-feedback` issue queue item **#5** ("in My Studies → View Details → problem list, clicking a problem should jump straight to that problem") by redefining its scope through a user interview. During the interview the surface request (navigation wiring) turned out not to be the root cause — the real issue was **affordance** (the visual cue that something is clickable), and the destination was also finalized as the study room's problem view rather than the problem detail page (`/problems/{id}`).

**Target**
- #507 `29eac0e` — study card affordance redesign + problem card study-room deeplink (4 FE files)

## Decisions

### D1. Remove the full-width "View Details" button → shrink to a top-right text button (affordance re-layout)

On the My Studies screen (`studies/page.tsx`), the study card is designed to navigate to the dashboard on body click (`setCurrentStudy` + `/dashboard`), but the **full-width primary-filled "View Details" button** at the bottom of the card acted as the strongest visual element and absorbed clicks meant for the dashboard. User observation: "I don't realize the card is a button — there is a hover response, but the View Details button is so big and eye-catching that I click it instead."

The fix removes the full-width button and shrinks "View Details" to a top-right text button. The card body becomes the sole large click target, making dashboard routing clear.

### D2. Keep the settings entry point via the gear on the detail page (lossless-path verification)

The existing top-right gear (settings, ADMIN-only) is replaced with the "View Details" text, but we verified in code beforehand (failure-mode scan B2) that the settings-access path is preserved by the settings gear (ADMIN-only, `router.push('/studies/{id}/settings')`) that already exists on the detail page (`/studies/{id}`). Card → View Details → detail → settings gear. No break in the ADMIN settings path.

### D3. Problem card destination = study-room deeplink (zero backend change)

The problem card (`studies/[id]/page.tsx` `ProblemCard`) had no click behavior at all (no `onClick`/`cursor`/`hover`). We finalize the destination as **the study room's view of that problem** rather than the problem detail page. In the study room (`studies/[id]/room/page.tsx`) a problem click is a state transition (`handleSelectProblem`) rather than a route change, but it already has a deeplink entry point that reads the `?problemId=` query and auto-selects that problem. So sending the problem card to `/studies/{id}/room?problemId={problem.id}` opens the study room landed on that problem's submission status — **zero backend change, zero new route**.

## Implementation

- **`studies/page.tsx`**: removed the full-width "View Details" button, moved it to a top-right text button. Removed the inline `var(--primary)` hard style → replaced with Tailwind token classes. Kept card body → `/dashboard`.
- **`studies/[id]/page.tsx`** (`ProblemCard`): added `cursor-pointer` + hover affordance, and on click navigates via locale-aware `useRouter` to `/studies/{id}/room?problemId={problem.id}`. Passes the `studyId` prop.
- **`messages/ko/studies.json` / `messages/en/studies.json`**: added the View Details text-button label symmetrically in ko/en.

**Verification (physical facts)**: PR #507 `29eac0e` — CI 39/39 green, jest 172 suites / 1822 tests pass (`JEST_EXIT=0`, 0 coverage-threshold violations), tsc 0 new errors (only the pre-existing `layout.tsx` globals.css local artifact — identical on a clean tree), ESLint 0 errors (a warning was reduced by removing one inline style). Critic (Codex gpt-5.5) verdict CLEAN — "No actionable correctness issues were found in the diff", 0 findings. Squash-merged.

**Critic**: This sprint the Critic gate completed normally (exit 0, CLEAN) — the ACP SIGTERM interruption that recurred in Sprints 251/254/260/261 did not reproduce. Instead a separate ordering defect in the gate infrastructure actually triggered (Incident 2).

## Incidents

1. **CI Lint Commit Messages transient failure (infra)**: the sole failing job was the `wagoid/commitlint-github-action` Docker image pull timing out against the docker.io registry (`request canceled while waiting for connection`), failing all 3 retries. The commit message itself follows Conventional Commits. Re-ran only the failed job → passed. Code-unrelated transient.
2. **Critic gate ordering gap (recurring infra bug) found & fixed**: the `watch-critic.sh` watchdog, after detecting the `.done` marker and reporting to Telegram, deletes `.done`/`.started`/`.pid` (send-once); afterwards the `.done` required by `critic-clean.sh` is gone, so CLEAN-marker creation is permanently rejected. Confirmed Critic completed normally via `.verdict` (recorded only when exit 0) and passed the gate. Structural block: the watchdog now preserves `.done` as `.done.reported` instead of deleting it, `critic-clean.sh` accepts both (log 5-evidence verification kept), and `run-critic-gate.sh` cleans stale `.done.reported` on re-run. (Targets are Oracle-profile operational scripts — outside this repo.)
3. **EN ADR written by hand**: with `ANTHROPIC_API_KEY` unset, `translate-adr.mjs` (Claude API) could not run → the sprint-262 EN ADR was written by hand preserving structure and technical terms (same as Sprint 261). Key rotation remains retired per user instruction.

## Carry-over

- [ ] Investigate the **root cause** of the Critic gate ACP SIGTERM interruptions — it did not reproduce this sprint, but the cause remains unidentified (carried Sprint 261→262→263)
- [ ] Re-review the real representativeness of the BOJ recommendation seed list (carried from Sprints 255–261)
- [ ] Remaining algosu-feedback issues (unresolved among #2/#3/#4/#7–#14) — **target of the next sprint (263)**
- [ ] 256–259 retrospective ADR gap — owned by the parallel Oracle session (not this session's jurisdiction)

## Lessons

- **A feedback item's surface request and its root cause can differ.** #5 was filed as "clicking does not navigate", but the interview revealed the real cause was affordance competition (the full-width button absorbing card-body clicks). Wiring just an `onClick` onto the problem card as literally requested would have reproduced the "don't realize it's a button" problem — **the observe→hypothesize→gather interview corrected the scope.**
- **Checking existing deeplink plumbing first can make backend change zero.** The study room already had a `?problemId=` auto-select entry point — the destination was reached with only a query string, no new route/data plumbing.
- **When redesigning affordance, verify alternate entry points are lossless in code (B2).** Before removing the settings gear from the card, we confirmed the settings entry point exists on the detail page — preventing an ADMIN-path break.
- **Send-once consumption in gate infrastructure can starve a downstream gate.** When the watchdog consumes `.done` and then deletes it, `critic-clean.sh` is permanently rejected — the consumption event is structurally blocked by preserving `.reported` instead of deleting (per-case workaround → structural fix).
