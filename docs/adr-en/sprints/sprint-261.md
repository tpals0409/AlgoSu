---
sprint: 261
title: "Feedback → GitHub Issue Auto-Sync + Migration Timestamp CI Guard"
date: "2026-07-24"
status: completed
agents: [Oracle]
related_adrs: ["ADR-031", "sprint-260"]
related_memory: ["sprint-window"]
topics: ["identity", "feedback", "github", "migration", "ci", "typeorm"]
tldr: "Closed two operational improvements as Sprint 261. (1) #497 — on identity feedback save, create a GitHub issue directly in the central repo carrying the full context (new GithubIssueService, fine-grained PAT + REST fire-and-forget), and downgrade Discord to a simple arrival notice carrying only the issue link. Resolves the dev-environment feedback re-entry bottleneck. Adds `feedbacks.github_issue_number/url` columns + migration. Failure isolation (issue/Discord failures do not affect feedback save). Rationale recorded in ADR-031 (DB-boundary external export + PII minimization). (2) #498 — TypeORM orders migrations by `parseInt(className.substr(-13))`; a 14-digit timestamp truncates and sorts before base tables, breaking fresh-DB migrate. Add `scripts/check-migration-timestamps.mjs` (--strict CI gate + quality-migrations job) blocking new >13-digit migration filenames (existing 7 prod-applied 14-digit files grandfathered). #498 is the structural recurrence-prevention for #497's Critic P1 (timestamp truncation bug). The Critic gate was skipped this sprint due to an ACP constraint (repeated SIGTERM termination) and deferred to Sprint 262 — merged after confirming CI green + mergeable CLEAN. #497 `552afc3` (jest 302/302) · #498 `317efeb` (CI 37/37)."
---
# Sprint 261 — Feedback → GitHub Issue Auto-Sync + Migration Timestamp CI Guard

_Date: 2026-07-24_

## Goal

Retroactively close **as Sprint 261** two operational improvements that were merged after Sprint 260 without a formal `/sprint-open`. The two are logically linked — #498 structurally blocks (via a CI guard) the TypeORM ordering pitfall that surfaced in the migration introduced by #497 (#497 Critic P1).

**Targets**
- #497 `552afc3` — `services/identity` feedback save → GitHub issue auto-sync + Discord notification downgrade
- #498 `317efeb` — `.github/workflows/ci.yml` + `scripts/check-migration-timestamps.mjs` enforcing 13-digit migration timestamps

## Decisions

### D1. Export feedback context outside the DB boundary as a GitHub issue (#497, ADR-031)

To eliminate the bottleneck of manually re-typing feedback in the dev environment, on feedback save we create a GitHub issue directly in the central repo carrying the full context (body, pageUrl, browserInfo, publicId, study). We introduce `GithubIssueService` but call REST directly by cloning the existing Discord fire-and-forget `fetch` pattern (no Octokit), and minimize permissions with a fine-grained PAT (issues:write, single repo). The DB-boundary external-export and PII-minimization rationale is recorded separately in ADR-031 (KR+EN).

### D2. Downgrade Discord to an arrival notice, with failure isolation (#497)

The previous Discord full-context payload is replaced by the GitHub issue, and Discord is downgraded to a simple arrival notice carrying only the issue link. Screenshots carry only a dashboard link (GitHub does not render data URIs). Issue-creation and Discord-send failures are isolated so they do not affect the feedback save transaction.

### D3. Structurally block migration timestamp misordering via CI (#498)

TypeORM orders migrations by the last 13 digits of the class name (`parseInt(className.substr(-13))`). A 14-digit `YYYYMMDDHHMMSS` (e.g. `20260723000000`) truncates to `260723000000` and sorts **before** the base-table creation migration (`1709000017000`), so on a fresh DB the `ALTER TABLE` runs before the table exists and breaks. #497 corrected that one file to a proper 13-digit epoch-ms (`1784851200000`), but a per-file fix cannot prevent recurrence, so we add a CI gate (`--strict`, quality-migrations job) blocking new >13-digit filenames. The existing 7 prod-applied 14-digit files are grandfathered since renaming them would trigger a re-run.

## Implementation

- **#497** (`services/identity`):
  - New `GithubIssueService` (171 lines) + `github-issue.module.ts` — fine-grained PAT + direct REST call
  - `feedback.entity.ts` `github_issue_number`/`github_issue_url` columns (dedup) + migration `1784851200000-AddFeedbackGithubIssueColumns.ts`
  - `feedback.service.ts` post-save issue-creation trigger + failure isolation · `discord-webhook.service.ts` downgraded to simple notice
  - `infra/sealed-secrets/sealed-secrets-template.yaml` `GITHUB_FEEDBACK_ISSUE_TOKEN`/`REPO` keys added
  - `docs/adr/ADR-031` (KR+EN) new
- **#498** (CI):
  - `scripts/check-migration-timestamps.mjs` (236 lines) — enforces 13-digit new-migration filenames, grandfather list for existing 14-digit files
  - `.github/workflows/ci.yml` quality-migrations job + `--strict` gate added

**Verification (physical facts)**: #497 `552afc3` jest 302/302, coverage 99.87%/99.56%/100%/100%, ADR EN 206/206. #498 `317efeb` CI 37/37 green, mergeable=CLEAN. Both PRs merged to origin/main (squash).

**Critic**: On the ACP backend, the Critic (Codex) run was terminated by repeated SIGTERM(15) mid codebase-grep — no verdict produced. Under a service-stability judgment, the **Critic gate was skipped this sprint**, and merge proceeded after confirming CI green + mergeable CLEAN. Root-causing the Critic infra constraint is deferred to Sprint 262 (user decision 2026-07-24). That said, #497 had already incorporated its own pre-merge Critic-round findings: P1 (timestamp truncation), P2 (AbortController 10s timeout), P3 (issueUrl persistence order).

## Incidents

1. **Repeated Critic-gate non-completion**: The PR #498 Critic terminated with `SIGTERM(15)` mid codebase-scan in `/tmp/critic-pr498.log` — no verdict / `.done` marker produced. Recurring ACP constraint (same form as Sprint 251·254·260). By user decision, skipped this sprint + deferred to Sprint 262.
2. **Retroactive sprint close**: Both #497·#498 were merged without a formal `/sprint-open` — unrecorded in any sprint after Sprint 260. Closed as a retroactive Sprint 261 bundle during the stop procedure (user confirmed).
3. **Migration deployment path confirmed**: Investigating whether the new migration needed a manual run, the identity manifest's `db-migrate` initContainer auto-runs `migration:run` before app boot → a GitOps redeploy IS the migration. Local Docker/k3d is irrelevant; no manual run needed. Actual-application verification (initContainer logs) requires production cluster access and is not possible from Oracle's local shell (user's responsibility).
4. **EN ADR hand-authored**: With `ANTHROPIC_API_KEY` unset, `translate-adr.mjs` (Claude API) could not run → the sprint-261 EN ADR was hand-authored preserving structure and technical terms. Key rotation is deprecated per user instruction (2026-07-21).

## Carryover

- [ ] Root-cause and fix the Critic-gate repeated ACP SIGTERM termination — **Sprint 262** (explicit user carryover)
- [ ] Re-examine the real representativeness of the BOJ recommendation seed list (carryover continued from Sprint 255~260)
- [ ] 256~259 retrospective ADR gap — owned by the parallel Oracle session (not this session's scope)

## Lessons

- **TypeORM orders migrations by the last 13 digits of the class name as an integer.** A 14-digit timestamp truncates and sorts before base tables → fresh-DB migrate breaks. A per-file fix cannot prevent recurrence, so **block it structurally via a CI guard** (per-file fix #497 → structural block #498).
- **Offload manual, repetitive work that becomes a dev bottleneck (feedback re-entry) outside the DB boundary**, but keep permission minimization (fine-grained PAT, single repo), PII minimization, and failure isolation as mandatory gates.
- **When the Critic gate repeatedly fails due to an infra constraint**, a service-stability-first judgment allows skipping the gate + deferring — but CI green + mergeable CLEAN remains the irreplaceable minimum gate.
