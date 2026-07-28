---
sprint: 264
title: "Clearing Carryover Work (Critic SIGTERM root cause · seed representativeness · 256~259 ADR gap)"
date: "2026-07-28"
status: completed
agents: [Oracle, Curator, Scribe]
related_adrs: ["sprint-263", "sprint-262"]
related_memory: ["sprint-window"]
topics: ["critic-gate", "acp", "operations", "problem", "recommendation", "adr", "documentation"]
tldr: "Cleared three carryover items accumulated across 255~263 in one pass. (1) Identified the root cause of the Critic gate's repeated ACP SIGTERM interruptions — codex was launched *inside* the ACP session process tree, so the child was reaped (SIGTERM) when the turn ended; this was already structurally resolved by Sprint 262's detached-cron redesign (0 SIGTERM across 8 post-redesign PRs #507·#509~515; the observed signal 13 was benign SIGPIPE from codex's internal grep). Added ensure-critic-crons.sh for idempotent re-registration against cron loss. (2) Re-reviewed BOJ recommendation seed representativeness → #521 `10e4c377` (12→23); the Critic caught 3 tier mislabels vs solved.ac ground truth (15649 GOLD→SILVER, 1005·2098 PLATINUM→GOLD), exposing 0 real PLATINUM → added 3 verified PLATINUM seeds (3653·11375·1761) to meet item2's goal, plus a Trivy brace-expansion 5.0.7→5.0.8 override. (3) 256~259 retrospective ADR gap → #522 `eb338f75` (KR+EN, index 201). A parallel Oracle session repeatedly pre-applied the same fixes — discriminated by measurement only, avoiding rework."
---
# Sprint 264 — Clearing Carryover Work (Critic SIGTERM root cause · seed representativeness · 256~259 ADR gap)

_Date: 2026-07-28_

## Goal

Clear three items carried over across 255~263 in a single Sprint 264 pass. The scope is **accumulated-debt cleanup**, not feature development.

**Target (user-confirmed — all three)**
- item1 — Identify the **root cause** of the Critic gate's repeated ACP SIGTERM interruptions (carried 261→263)
- item2 — Re-review the actual representativeness of the BOJ/Programmers recommendation seed list (carried 255~261)
- item3 — Close the 256~259 retrospective ADR gap (write 4)

## Decisions

### D1. Critic SIGTERM root cause — in-session launch → turn reap (item1, already structurally resolved)

The root cause of the Critic gate's past repeated SIGTERM interruptions was that codex was launched **inside the ACP session process tree**, so the child was reaped (signal 15) together when the session turn ended. This was **already structurally resolved by Sprint 262's detached-cron redesign** (`launch-critic.sh` → queue marker → `critic-runner` cron launches codex detached, outside the ACP session). Measuring the 8 post-redesign PR logs (#507·#509~515) showed **0** SIGTERM; the observed `signal 13` was benign SIGPIPE from codex's internal grep pipe (review completed normally). In other words, item1 was not "unresolved-and-open" but "resolved-yet-undocumented", and this sprint confirmed it empirically.

### D2. Idempotent re-registration against cron loss — ensure-critic-crons.sh (item1 residual risk)

If any of the three detached crons (`critic-runner`·`critic-gate-watchdog`·`merge-watch`) becomes unregistered or lost, the gate **stops silently** (more dangerous than SIGTERM — no alert at all). To eliminate this single point of failure, `ensure-critic-crons.sh` (idempotent re-registration) was added as an Oracle-profile operations script. It lives outside this repo (profile scripts) and is not a PR target.

### D3. Seed representativeness — correct to solved.ac ground-truth tiers + secure real PLATINUM (item2, #521)

BOJ recommendation seeds were expanded 12→23 (to reinforce GOLD/PLATINUM fallback), but the Critic gate caught **3 tier mislabels (P2)** vs solved.ac ground truth: `15649` (N and M (1)) actually SILVER but labeled GOLD; `1005` (ACM Craft)·`2098` (Traveling Salesman) actually GOLD but labeled PLATINUM. These mislabels left **0** real PLATINUM, so item2's goal (securing high-tier fallback) itself was unmet. → Corrected to ground-truth tiers and added 3 verified PLATINUM seeds (`3653`·`11375`·`1761`). As a side fix, the Trivy-flagged `brace-expansion` 5.0.7 CVE-2026-14257 (transitive HIGH) was resolved via a 5.0.8 override.

### D4. Closing the 256~259 retrospective ADR gap (item3, #522)

The 256~259 retrospective ADR gap, previously under a parallel session's jurisdiction, was handled within this sprint's scope. The Scribe delegation generated only 256 and then stalled (ACP background stall), so the missing pieces (KR 257·258·259 + EN 256·257·258·259) were completed by hand after gathering commit facts. The `docs/adr/README.md` retrospective-ADR count was corrected `197→201` (passing CI `Quality — docs` `--strict`).

## Implementation

- **item1**: root-cause identification (doc/log analysis) + `ensure-critic-crons.sh` (profile scripts, outside repo). No code change.
- **item2 (#521 `10e4c377`)**: `services/problem/src/problem/recommendation-seeds.ts` — seeds 12→23, 3 ground-truth tier corrections + 3 PLATINUM additions; `package.json` brace-expansion 5.0.8 override. `tsc` exit 0 · jest 19 suites/266 tests pass (Oracle re-verified directly).
- **item3 (#522 `eb338f75`)**: `docs/adr/sprints/sprint-{256,257,258,259}.md` (KR) + `docs/adr-en/sprints/…` (EN) + `docs/adr/README.md` count. EN 213/213 · doc-refs intact.

**Verification (physical facts)**: both #521 and #522 Critic-verdict **CLEAN** (confirmed by Oracle direct log read), CI green, squash-merged after mergeState CLEAN — #521 `10e4c377`, #522 `eb338f75` confirmed on origin/main.

## Incidents

1. **Parallel Oracle session collision (recurring)**: (a) While trying to push+PR the 263 retrospective ADR, discovered a parallel session had already merged PR #520 — cleaned up the revived stale branch via the GitHub API. (b) Before I started, a parallel session had **already pre-applied and pushed all** of #521's 3 Critic fixes (tier corrections, PLATINUM additions, Trivy) and #522's README fix — discriminated by measurement (remote commit history) and avoided rework (my local branch lagged remote, so push was withheld). Exactly the parallel-session PR-collision pattern in memory.
2. **Auto-verdict false positive (reconfirmed)**: the `.verdict` auto-parser labeled #521·#522 "CLEAN-hint" and the #521 re-review "REVIEW-NEEDED", but both codex verdict sections were CLEAN. The auto-verdict is a hint only — reconfirmed that the gate is Oracle's direct log read (seed-investigation keywords in the log body misled the scanner).
3. **#522 BEHIND**: #521 and Dependabot #517 merged into main first, leaving #522's branch BEHIND so auto-merge did not fire → `gh pr update-branch`, then auto-merged.
4. **EN ADR written by hand**: `ANTHROPIC_API_KEY` unset, so `translate-adr.mjs` (exit 2) could not run → EN ADR written by hand (same as Sprint 261~263). Key re-rotation is deprecated per user instruction.

## Carryover

- None. (All three 255~263 carryover items resolved.)

## Lessons

- **Carryover must distinguish "unidentified" from "undocumented".** item1 SIGTERM followed 261→263 as open debt, but measurement showed Sprint 262's redesign had **retroactively resolved** it. The physical fact of 0 SIGTERM across 8 PR logs flipped "root cause unknown" to "already structurally resolved" — don't treat carryover as automatically unresolved; measure the current state.
- **Parallel-session collisions are discriminated by measurement only (distrust cache).** When another Oracle session pushes PRs to the same repo, state changes in real time. Re-checking remote commit history and existing PRs before every edit/push avoided rework, duplication, and revived stale branches.
- **Seed representativeness requires external-SSOT (solved.ac) measurement.** Trusting self-declared tiers turns "add PLATINUM fallback" into GOLD duplicates that miss the goal — the Critic caught this via external fact-checking. For data seeds, fact verification, not code review, is the crux.
- **An auto-verdict hint is not the gate.** Even when the `.verdict` parser mislabels CLEAN/REVIEW, Oracle's direct log read is final — automation goes as far as alerting/queuing; verdict confirmation stays with the human (Oracle).
