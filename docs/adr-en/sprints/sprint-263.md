---
sprint: 263
title: "Processing the Remaining Feedback Issue Queue (#4·#7·#8·#9·#10·#11·#12·#13·#14)"
date: "2026-07-28"
status: completed
agents: [Oracle, Gatekeeper]
related_adrs: ["sprint-262"]
related_memory: ["sprint-window"]
topics: ["frontend", "submission", "gateway", "identity", "ux", "rate-limit", "critic-gate", "config"]
tldr: "Closed the remaining algosu-feedback issue queue as Sprint 263. Six feature PRs merged — #509 (#13 surface GitHub sync failure)·#510 (#8·#9·#10·#12 study-room & sidebar UX)·#511 (#7 D-day fixed to deadline calendar days)·#512 (#2·#11 difficulty toggle & badge removal)·#514 (#14 bug-report multi-photo)·#513 (#4 submission rate limit raise + 429 UX). The Critic gate caught three distinct defect families: (1) #514 four screenshots (~2.8MB) as data URLs hit the gateway·identity default Express body limit of 100KB → 413, fixed by raising both main.ts to 5mb. (2) #513 429 copy misinformed 'still processed normally' + missing variant reset → FE copy fix & variant reset. (3) #513 re-review caught rate-limit.middleware.ts `static readonly` fields reading process.env at class-load time (before ConfigModule .env loading) → switched to ConfigService constructor injection (no prod impact, local .env override restored). As a side fix, critic-clean.sh guard false-positived on past-findings reference comments in the diff body → hardened to scan only the codex verdict section (proven on #514·#513). All PRs Critic CLEAN, CI 39/39 green."
---
# Sprint 263 — Processing the Remaining Feedback Issue Queue (#4·#7·#8·#9·#10·#11·#12·#13·#14)

_Date: 2026-07-28_

## Goal

Close the remaining items of the `tpals0409/algosu-feedback` issue queue as Sprint 263. After finishing #5 (affordance) in Sprint 262, handle the remaining UX, consistency, and stability feedback through six feature PRs, each vetted by the Critic gate.

**Target (merged)**
- #509 `e5b7d81a` — #13 surface GitHub sync failure in submission list & study room
- #510 `29d17198` — #8·#9·#10·#12 study-room & sidebar UX improvements
- #511 `9a9564be` — #7 fix D-day counting to deadline calendar days
- #512 `4d0ac0dd` — #2·#11 problem difficulty-hide toggle + algorithm tag badge removal
- #514 `bc6f637a` — #14 bug-report multi-photo attachment (up to 4) + body-limit 5mb
- #513 `14f839db` — #4 submission rate limit raise + 429 UX improvement

## Decisions

### D1. Body limit for multi-screenshot attachments — raise gateway·identity to 5mb (#514)

Bug-report multi-photos (up to 4, capped per image at `dataUrl.length > 700_000` → worst case ~2.8MB JSON) hit the default Express body-parser limit (~100KB) on **both** gateway and identity, rejecting even normal images with 413. Because the feedback path (`/api/feedbacks`) is outside the gateway proxy routing table and does not go through the stream-reconstruction logic, the `json`/`urlencoded` limits in both gateway and identity `main.ts` were raised uniformly to 5mb. Although this spans two services, a single shared limit value must be used, so it was handled through a single Gatekeeper delegation across both at once (avoiding value mismatch and push contention).

### D2. 429 rate-limit UX — fix misinformation copy + variant reset (#513)

The submission rate-limit (429) copy stated "still processed normally", making users mistake a blocked submission — which is in fact neither created nor tracked — as "accepted" (P2). The misleading parenthetical was removed on both en and ko to match actual behavior. In addition, after a 429 `submitErrorVariant='warning'` persisted, so a subsequent empty-code submission showed "Please enter your code" in the rate-limit warning style (P3); this was blocked by adding `setSubmitErrorVariant('error')` on the empty-code branch, with a regression test.

### D3. Rate-limit configuration read timing — static field → ConfigService injection (#513)

The limit constants in `rate-limit.middleware.ts` were `static readonly`, so they read `process.env['RATE_LIMIT_SUBMISSION']` at **class-load time**, running before NestJS `ConfigModule` loaded `.env`. As a result the `.env` file override was ignored and pinned to the fallback value (a gap limited to the local `.env` path — production is unaffected, since SealedSecret→container env exports to the parent process and is recognized even at static init). Following the gateway convention (`invite-throttle.service.ts`), `ConfigService` was constructor-injected to read the limits at instance time, and a regression test verifying the env override is actually honored was added.

### D4. critic-clean.sh guard hardening — scan only the codex verdict section (gate infra)

The CLEAN-marker guard scanned the **entire** Critic log and false-positived on past-findings reference comments contained in the reviewed diff body (e.g. `Critic PR#497 P1`, `Sprint 127 Wave-B P1`), rejecting CLEAN. After confirming the log structure separates into `user` (reviewed diff) and `codex` (verdict), the guard was hardened to scan **only the codex verdict section** (if codex writes an actual P0/P1 it is still detected — safety net preserved). Introduced on #514 and re-verified without false positives on the #513 re-run.

## Implementation

- **#514**: `services/gateway/src/main.ts`·`services/identity/src/main.ts` — `express.json`/`urlencoded` limit 5mb. Squash merge `bc6f637a` including fix commit `e955602`.
- **#513**: frontend `messages/{en,ko}/problems.json` 429 copy fix, `page.tsx` empty-code branch variant reset + regression test (`131e32e4`); `services/gateway/src/rate-limit/rate-limit.middleware.ts` ConfigService injection + spec env-override regression test (`4a9ecc0e`). Squash merge `14f839db`.
- **Guard hardening**: Oracle profile operations script `critic-clean.sh` (outside this repo) — verdict-section scoped scan.

**Verification (physical facts)**: all six feature PRs Critic-verdict CLEAN, CI 39/39 green. #514 local tsc exit 2 was pre-existing noise from `tsconfig.json` `baseUrl` deprecation (TS5101), unrelated to the commit — confirmed by CI `Quality — gateway`·`Quality — identity` (tsc+lint) pass. #513 gates: gateway jest 10/10 (including env-override regression), frontend jest 9/9 (including P3 regression), tsc exit 0, ESLint 0 errors.

## Incidents

1. **#514 two-stage merge block (review→BEHIND)**: with 8 CI checks green, Critic CLEAN, and auto-merge armed, it was blocked by `REVIEW_REQUIRED`, then shifted to branch `BEHIND`. `gh pr update-branch` re-synced, CI re-ran green → auto-merged. Reconfirmed that auto-merge fires only when branch freshness and approval requirements are all satisfied.
2. **critic-clean.sh guard false positive (gate infra)**: D4 above. Past Critic reference comments in the diff body were mistaken for findings → structurally blocked via verdict-section scoped scan.
3. **#513 Critic multi-stage findings**: first pass P2 (429 misinformation)·P3 (variant), re-run caught a new P2 (config read timing). The re-review accepted the prior fixes without re-flagging and newly caught a defect at a different layer — gate iteration paid off.
4. **EN ADR written by hand**: `ANTHROPIC_API_KEY` unset, so `translate-adr.mjs` (Claude API, exit 2) could not run → the sprint-263 EN ADR was written by hand preserving structure and technical terms (same as Sprint 261·262). Key re-rotation is deprecated per user instruction.

## Carryover

- [ ] Determine the **root cause** of the Critic gate's repeated ACP SIGTERM interruptions — not reproduced in Sprint 262·263 but the cause remains unidentified (261→262→263) — **target of the next sprint (264)**
- [ ] Re-review the actual representativeness of the BOJ recommendation seed list — **target of the next sprint (264)**
- [ ] 256~259 retrospective ADR gap — owned by a parallel Oracle session (not under this session's jurisdiction) — **target of the next sprint (264)**

## Lessons

- **Iterating the Critic gate surfaces defects at different layers sequentially.** #513's first pass caught UX misinformation (copy) and residual state (variant); after the fix, the re-run newly caught a **runtime initialization order** defect (static init vs ConfigModule). Not settling for a single CLEAN and re-launching on every fix commit was effective.
- **`static readonly` fields run before the DI container initializes.** Environment configuration must be read via `ConfigService` injection (instance time) to stay consistent regardless of `.env`/`ConfigModule` load order — reading `process.env` directly at class-load time depends on the framework boot order.
- **A shared cross-service limit value should be handled by a single delegation.** #514's body limit had to be the same on both gateway and identity, so splitting in parallel risked value mismatch and push contention — a single agent handled both on one branch.
- **A gate scanner should look only at the verdict output (excluding the reviewed body).** critic-clean.sh scanned the whole log and false-positived on past-findings comments inside the diff → narrowing the scope to the codex verdict section blocked it structurally (individual workaround → structural fix).
