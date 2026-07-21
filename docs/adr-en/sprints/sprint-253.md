---
sprint: 253
title: "Post-Hermes-Migration Ops Stabilization — Telegram Report Format, Critic Auto-Receive, Auto-Merge Monitoring"
date: "2026-07-21"
status: completed
agents: [Oracle]
related_adrs: ["sprint-246", "sprint-247", "sprint-250"]
related_memory: ["sprint-window"]
topics: ["hermes", "oracle", "ops", "telegram", "critic-gate", "auto-merge"]
tldr: "Closed 3 operational gaps accumulated since the Hermes Agent migration (Sprint 246). (1) Telegram report format — converted the large tables in SOUL.md and the lifecycle stop/start skill report templates into phone-readable bullets (pinned the no-large-table / 3-line-summary-first rule into the source). (2) Critic gate auto-receive — proved the end-to-end pipeline with a dummy .done marker: watch-critic.sh detection -> cron delivery -> real Telegram arrival. (3) CI-green auto-merge + merge monitoring standing infra — new enable-automerge.sh (squash --auto + watch marker) + watch-merge.sh + merge-watch cron (every 2m, standing), passing MERGED/CI-fail/WAIT 3-path smoke tests. No AlgoSu repo code changes (Hermes profile = git-untracked ops config, same pattern as Sprint 250)."
---
# Sprint 253 — Post-Hermes-Migration Ops Stabilization

_Date: 2026-07-21_

## Goal

Close 3 operational gaps surfaced during real usage after the Hermes Agent migration (Sprint 246). Issues listed directly by the user (SaeMin Kim):

1. **Report format not optimized for Telegram** — large tables / multi-column reports built for a wide terminal are hard to read on a phone screen.
2. **Critic gate auto-receive unverified** — the watchdog cron is registered, but real Telegram arrival had not been verified recently.
3. **CI-green auto-merge / merge-green monitoring not automated** — only patterns were described in the system prompt; without standing infra, every merge required manual intervention.

## Decisions

### D1. Telegram report format — convert tables to bullets in 3 sources

Memory held the Sprint 252 feedback (phone-readability first), but **the sources that actually generate reports (SOUL.md, lifecycle skill templates) still used large tables** (self-contradiction). Fixed the sources directly:

- **SOUL.md `## Communication`**: pinned the Telegram-first rule — no large tables, 3-line summary first, one message = one key point, inline code only for code/SHA/commands.
- **algosu-lifecycle-stop step 6 completion report**: 8-row large table -> bullets (removed the Sprint 252 violation case).
- **algosu-lifecycle-start step 5 dashboard**: table -> bullets (resolved self-contradiction with the Telegram-principles section).

### D2. Critic gate auto-receive — end-to-end smoke test proof

The `critic-gate-watchdog` cron (every 2m, no_agent) was active, but real Telegram arrival was unverified since no real Critic ran after Sprint 251. Verified the full pipeline with a dummy `.done` marker:

- Created dummy `/tmp/critic-pr477.done` -> `watch-critic.sh` detection -> confirmed log-tail report stdout generation.
- Ran cron `run` to exercise the delivery layer -> confirmed real Telegram arrival -> confirmed marker consumption (`.sent`).
- Re-confirmed the Sprint 252 hardened script logic (trap-guaranteed `.done` + abnormal-exit detection).

### D3. CI-green auto-merge + merge monitoring as standing infra

Previously only the `gh pr merge --squash --auto` pattern was described in the system prompt, relying on Oracle memory each PR. Added standing infra:

- **`enable-automerge.sh <PR>`**: one-line helper setting `gh pr merge --squash --auto` + creating the watch marker.
- **`watch-merge.sh`**: PR-state polling — MERGED (merge-complete report), CI-fail (immediate alert), WAIT (open + CI-green not-yet-merged, silent), timeout — 3+1 paths. Failure detection via `statusCheckRollup` CheckRun (`status`+`conclusion`) / StatusContext (`state`).
- **`merge-watch` cron**: every 2m standing (reusing the critic-gate-watchdog pattern), no_agent, telegram delivery.
- MERGED / CI-fail / WAIT 3-path smoke tests passed, delivery proven (PR #477 merge-complete message arrived on Telegram).

### D4. Discard the key/token rotation follow-up item

Per user instruction, **discarded the 🔴 ANTHROPIC key / `setup-token` long-lived token rotation tracking item**. Removed only from the pending list (MEMORY.md `## follow-up needed` / `(infra)`, sprint-window backlog); historical records (completed `[x]` items, technical memo files) preserved as facts. The actual keys/tokens remain valid and operational; reissue procedures are preserved in `hermes-launchd-keychain-blocked.md`.

## Completed Items

- #1 Telegram format: SOUL.md / algosu-lifecycle-stop / algosu-lifecycle-start table -> bullet conversion
- #2 Critic auto-receive: dummy-marker end-to-end smoke test proof (real Telegram arrival)
- #3 Auto-merge + monitoring: new `enable-automerge.sh` / `watch-merge.sh` + `merge-watch` cron, 3-path smoke passed
- #4 Discarded key/token rotation tracking item (history preserved)

**Commits**: none — all deliverables live in the Hermes profile (`~/.hermes/profiles/algosu-oracle/`) as git-untracked ops config (same pattern as Sprint 250). Only the ADR (KR+EN) is recorded in the AlgoSu repo.

**Critic result**: Not applicable — no AlgoSu repo code changes (Hermes ops config change).

## Backlog

- [ ] GA4 admin Enhanced Measurement OFF / production UAT / data stream URL alignment (user-direct)
- [ ] Server redeploy + live SEO verification (ops, Sprint 212/213 deliverables)
- [ ] Harness checkup `--full` CI scheduled automation (monthly cron) review (Sprint 209 follow-up)

## Lessons

- **Memory feedback ≠ source reflection**: storing a user preference in memory does not prevent recurrence unless the sources that generate reports (SOUL.md, skill templates) are fixed. Preference rules must be pinned at the generation point (the source) to be durable.
- **Cron active ≠ delivery verified**: even if the watchdog is `scheduled` and `last ok`, real arrival is separate. Periodically prove end-to-end (detect -> deliver -> arrive -> consume) with a dummy marker to prevent silent failure.
- **Pattern described ≠ standing automation**: a procedure described in the system prompt relies on memory each run. Repeated ops must be standardized as scripts + cron to reproduce without human intervention.
