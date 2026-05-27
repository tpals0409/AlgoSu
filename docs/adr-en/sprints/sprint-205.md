---
sprint: 205
title: "Phase 3 External-Work Re-verification + Two Deferred Items Resolved (commitlint oracle scope + Build Blog SSG required check)"
date: "2026-05-28"
status: completed
agents: [Oracle, Architect, Scribe]
related_adrs: ["sprint-156", "sprint-191", "sprint-202", "sprint-204"]
related_memory: ["sprint-window"]
topics: ["security", "operations", "cleanup", "ci"]
tldr: "Re-verified the Sprint 204 Phase 3 external-work items (Discord BOT_TOKEN revoke + dormant file cleanup on other machines). (a) BOT_TOKEN revoke is deferred pending an operations direction decision — termination conditions formalised. (b) Other-machine cleanup is incomplete — user must inspect and report back. The commitlint oracle scope (3-sprint cumulative carry-over, commit 6e6760c) and the Build Blog (SSG) required-check promotion (Sprint 201 regression prevention, gh api) were resolved simultaneously. New pattern: infinite-carry-over prevention formalisation."
---
# Sprint 205 — Phase 3 External-Work Re-verification + Two Deferred Items Resolved (commitlint oracle scope + Build Blog SSG required check)

## Goal

- Re-verify the Sprint 204 Phase 3 external-work items (Discord BOT_TOKEN revoke + dormant file cleanup on other machines/checkouts) and persist the outcome (deferred / incomplete).
- Formalise the infinite-carry-over prevention condition so that Phase 3 re-verification does not repeat as a structural pattern into Sprint 206+.
- Simultaneously resolve the `commitlint` oracle scope (3-sprint cumulative carry-over) and the Build Blog (SSG) required-check promotion (Sprint 201 regression prevention).

## Background

The 4-sprint progressive cleanup pipeline — Sprint 156 (RUNBOOK codification) → Sprint 191 (deprecated deletion) → Sprint 202 (partial dormant deletion + reclassification) → Sprint 204 (complete dormant deletion + repo-side BOT_TOKEN plaintext disposal) — concluded with Sprint 204. However, the external-system track (Discord token revoke + dormant file cleanup on other machines/CI checkouts) runs asynchronously from repo PR/merge as a user-direct action, so Sprint 204 ADR §carry-over explicitly mandated re-verification at Sprint 205 start.

At the same time, a `chore(oracle):` commit attempt in Sprint 202 had been blocked by `commitlint scope-enum` with "oracle is not allowed", and this item had been carried over through Sprints 203 and 204. The Sprint 201 Build Blog (SSG) regression — where a failing job was not a required check and therefore allowed the PR to merge — also remained unresolved. Both items were addressed in this sprint.

## Decision

### D0. Phase 3 (a) — BOT_TOKEN Revoke Deferred

User response: **deferred** — operations direction undecided (reviewing whether to resume or fully decommission Discord integration).

- The repo/local-file plaintext-token-holding path was terminated in Sprint 204 (`.claude-tools/discord-send.sh` deleted + blocked by `.gitignore`).
- The external token (Discord Developer Portal) is not yet revoked — the token may still be valid.
- Residual secret exposure risk: Discord API access permission may still be active (token validity unknown). However, 0 live callers (verified in Sprint 202, re-verified in Sprint 204) means there is no immediate exploitation path.
- **Infinite-carry-over prevention condition**: once an operations direction is declared, take one of two actions — (A) resume → open a Secret-store-redesign sprint, (B) full decommission → one-time Discord Developer Portal BOT_TOKEN Reset / application deletion. While undecided, track in sprint-window/memory only; avoid additional ADR commits (reusing the Sprint 204 placeholder-regression prevention pattern).

### D1. Phase 3 (b) — Other-Machine/CI Checkout Cleanup Incomplete

User response: **incomplete** — other machine not yet inspected. This workstation (where this work was executed) confirmed `ls .claude-tools/` empty.

- Cleanup command: `rm .claude-tools/{discord-send.sh,oracle-system-prompt.md,discord-inbox.md}` (same pattern as Sprint 202·204).
- `.claude-tools/` is in `.gitignore`, so this sprint's deletion does not propagate via git — each other workstation/CI checkout requires manual execution.
- **Infinite-carry-over prevention condition**: same track as D0 BOT_TOKEN revoke. If the other-machine inventory is unknown, track in sprint-window/memory only; no additional ADR commit. When the user inspects and reports completion, record in sprint-window.

### D2. Phase C — Add commitlint oracle Scope (commit 6e6760c)

Inserted `'oracle'` into the `staticScopes` array in `commitlint.config.mjs` (alphabetically sorted between `'infra'` and `'runbook'`). Delegated to Architect.

- Sprint 202 experience: a `chore(oracle):` commit attempt was blocked by "oracle is not allowed".
- Same pattern repeated as a carry-over in Sprints 203 and 204 — three accumulated carry-overs led to priority resolution this sprint.
- Verification: `echo 'chore(oracle): test' | npx commitlint` exits 0.

### D3. Phase D — Promote Build Blog (SSG) to Required Check (Oracle direct, gh api)

Added `"Build Blog (SSG)"` to GitHub branch protection `required_status_checks.contexts`.

- Sprint 201: `check-adr-links.mjs` included a `search-index.json` existence check (exit 2), but the Build Blog (SSG) job was not a required check, so a failure still allowed the PR to merge. This regression reached `main`, requiring a corrective PR #356.
- Contexts before change (3): `["Secret & Env Scan", "Detect Changed Services", "Coverage Gate"]`
- Contexts after change (4): `["Secret & Env Scan", "Detect Changed Services", "Coverage Gate", "Build Blog (SSG)"]`
- `strict: true` (unchanged)
- API command: `gh api -X POST repos/tpals0409/AlgoSu/branches/main/protection/required_status_checks/contexts -f 'contexts[]=Build Blog (SSG)'`
- Verification command: `gh api repos/tpals0409/AlgoSu/branches/main/protection --jq '.required_status_checks.contexts'`

> No git change — this is a GitHub settings modification, not a commit target. The before/after state + API command + verification command are persisted in this ADR for auditability.

## Implementation

### Phase A·B — Persist Phase 3 Outcome

This ADR (KR) + EN pair created to persist the Phase 3 (a) deferred + (b) incomplete outcomes. RUNBOOK `docs/runbook/claude-tools.md` §5 history and §Discord policy sections updated.

### Phase C — commitlint.config.mjs Patch (commit 6e6760c)

```diff
- 'e2e', 'frontend', 'infra', 'runbook', 'security',
+ 'e2e', 'frontend', 'infra', 'oracle', 'runbook', 'security',
```

Architect delegation, commit `6e6760c chore(ci): commitlint scope-enum에 oracle 추가 — Sprint 202·203·204 누적 이월 해소`.

### Phase D — GitHub Branch Protection Change (Oracle direct)

```bash
gh api -X POST repos/tpals0409/AlgoSu/branches/main/protection/required_status_checks/contexts \
  -f 'contexts[]=Build Blog (SSG)'
```

No git change. Verified 4 contexts in the GitHub API response.

### Phase E — ADR sprint-205 KR+EN + README Index Update (Scribe)

This ADR (KR) + EN pair + `docs/adr/README.md` count **142→143** / sprint range **62~204→62~205** + `docs/runbook/claude-tools.md` §5·§Discord policy update.

## Verification

- `scripts/check-adr-index-count.mjs --strict` — permanent 8 / topic 1 / sprint **143** aligned.
- `scripts/check-adr-en-coverage.mjs --lint` — **152/152** (100%).
- `scripts/check-doc-refs.mjs` — 0 broken.
- `scripts/check-i18n-residue.mjs --strict` — prose Hangul below the 8% threshold.
- `echo 'chore(oracle): test' | npx commitlint` — exit 0 (Phase C verification).
- `gh api repos/tpals0409/AlgoSu/branches/main/protection --jq '.required_status_checks.contexts'` — returns `["Secret & Env Scan","Detect Changed Services","Coverage Gate","Build Blog (SSG)"]` with all 4 contexts present (Phase D verification).
- CI green.

**Critic (Codex)**: This sprint's changes are docs-only (ADR KR+EN + RUNBOOK + README) plus a one-line `commitlint.config.mjs` patch and a GitHub API call (no git change). Since an Architect-delegated commit exists, `oracle-auto-critic.sh` is expected to trigger. Critic round results are persisted up to this commit. R{N+1}+ results are recorded in sprint-window/memory only (placeholder-regression prevention, reusing the Sprint 204 pattern).

## New Patterns

### 1. Infinite-Carry-Over Prevention Formalisation

When an external-system track is split off and the N+1 sprint re-verification is again incomplete/deferred, apply the following rules to prevent infinite ADR commit regression:

| Situation | Action |
|-----------|--------|
| Operations direction declared | Resolve in that sprint (resume → new sprint / decommission → one-time action) |
| Undecided (decision deferred) | Track in sprint-window/memory only. Avoid additional ADR commits |
| User-direct work completed and reported | Record in sprint-window. Remove item from ADR §carry-over |

This extends the Sprint 204 placeholder-regression prevention decision ("freeze the Critic block at R{N}, record R{N+1}+ in sprint-window/memory only") to external-system-track carry-overs using the same principle.

### 2. Operations-Setting-Change ADR Persistence Pattern

For external-system operations that produce no git change — GitHub branch protection, GitHub repo settings, Secret changes, etc. — persist the following in the ADR:

- Before/after state (contexts array, setting values, etc.)
- Executed API command (in reproducible form)
- Verification command (immediately auditable in the next sprint)

Even setting changes that cannot be traced through `git blame` or PR history become auditable via ADR records.

## Lessons

1. **Operational overhead of external-system track separation** — repo PR merge completes immediately, but external tasks (Discord token revoke + other-machine cleanup) are asynchronous user-direct work. Even with Sprint 205 re-verification mandated in the Sprint 204 ADR §carry-over, if the user response is "deferred / incomplete", the risk of N+2, N+3 carry-overs exists. Formalising the "terminate upon operations-direction declaration" condition in this sprint clarifies the closure trigger.
2. **Efficiency of resolving small carry-over items simultaneously** — commitlint oracle scope (3-sprint cumulative carry-over, 1-line patch) and Build Blog (SSG) required check (1-sprint carry-over, 1 API call) are both very small changes. Bundling them into an operations follow-up sprint resolves them without a dedicated sprint.
3. **Branch protection changes do not produce git commits** — the `gh api` call modifies GitHub settings with 0 git diff. Persisting the before/after contexts array + API command + verification command in the ADR §Phase D ensures auditability. This pattern is reusable for future branch protection changes.

## Critic Rounds

- **R1** `019e6b9c-2fb4-7030-b74d-797449a8a33b` — Critical/High **0** + P2 **2** + P3 **0**
  - P2-1: `_base.md:51` ban clause removed prematurely — `discord-send.sh` may still exist on other machines/CI checkouts after the Sprint 204 repo-side deletion, and the BOT_TOKEN is still valid while revoke is deferred. The agent suppression guard was absent.
  - P2-2: `claude-tools.md:65` Phase 4 row — the phrase "secret exposure risk fully terminated" contradicts Sprint 205 ADR §D0·D1 where (a) is deferred and (b) is incomplete.
  - Both items resolved in this commit: `_base.md:51` ban clause restored (conditional — remove after other-machine cleanup confirmed complete + token revoke confirmed complete) + `claude-tools.md:65` updated to "secret exposure risk termination **incomplete**" for tense alignment.
- **Placeholder-regression prevention adhered to** (Sprint 204 R4): Critic block frozen at R1 in this ADR. R2+ results recorded in sprint-window/memory only — additional ADR commits avoided.

## Carry-over

- **Phase 3 external work (re-verify at Sprint 206)**:
  - **(a) Discord BOT_TOKEN revoke** — process at the time an operations direction is declared (after Discord integration operations direction is determined). Until decided, track in sprint-window/memory only; no additional ADR commit.
  - **(b) Other workstation/CI checkout dormant file cleanup** — user must inspect and report. Cleanup command: `rm .claude-tools/{discord-send.sh,oracle-system-prompt.md,discord-inbox.md}`. On completion, record in sprint-window.
- **(Operations) Sprint 196 migration execution + redeploy** (user/operations).
- (Optional) CI PYTHON 3.12 → 3.13 upgrade.
- (Seed) Harness routine-inspection checklist automation script (Sprint 202 new pattern).
- Cumulative UAT (user direct): Programmers re-submission scoring / English production Grafana CB dashboard.
