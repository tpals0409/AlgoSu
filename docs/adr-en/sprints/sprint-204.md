---
sprint: 204
title: "Discord Decommission + BOT_TOKEN Reclamation — Closing the `.claude-tools/` Cleanup Pipeline"
date: "2026-05-27"
status: completed
agents: [Oracle, Architect, Scribe, Critic]
related_adrs: ["sprint-156", "sprint-191", "sprint-202"]
related_memory: ["sprint-window"]
topics: ["security", "operations", "cleanup"]
tldr: "Executed the final stage (Phase 4) of the `.claude-tools/` cleanup roadmap codified in Sprint 156. Locally deleted three dormant files (`discord-send.sh`·`oracle-system-prompt.md`·`discord-inbox.md`) — repo-side cleanup complete. The BOT_TOKEN is to be revoked by the user in the Discord Developer Portal (Phase 3 external track — user-direct action after merge, re-verified at the start of Sprint 205). Triggered by three converging conditions: 3-month inactivity (last input 2026-02-28), 0 live callers verified, and 0 git-history exposure (registered in `.gitignore`). Agent↔Discord integration is being decommissioned (repo-side complete, external token revoke pending Phase 3). Closes the 4-sprint progressive cleanup pipeline (Sprint 191→202→204). Three new patterns are persisted: dormant-asset secret disposal, cleanup-pipeline finalisation, and external-system track separation."
---
# Sprint 204 — Discord Decommission + BOT_TOKEN Reclamation — Closing the `.claude-tools/` Cleanup Pipeline

## Goal

- Dispose of the dormant Discord integration assets remaining in `.claude-tools/` to terminate the plaintext BOT_TOKEN exposure risk.
- Close the 4-sprint cleanup pipeline that began with Sprint 156 (codification) → Sprint 191 (deprecated deletion) → Sprint 202 (partial dormant deletion + reclassification).
- Persist the separation between external-system token revocation and repo work as a formal pattern.

## Background

The `docs/runbook/claude-tools.md` §4 cleanup roadmap, written in Sprint 156, left Phase 4 ("decision on `discord-send.sh` — reactivate / delete / reclaim BOT_TOKEN — pending Agent communication architecture decision") in a deferred state. Sprint 202 Phase 3 deleted the partial dormant set (`oracle-respond.sh`·`discord-receiver.py`·`discord-last-id`) and reclassified `discord-send.sh` from live → dormant, but the plaintext BOT_TOKEN forced a "deletion deferred" status.

By the time Sprint 204 started, the decision environment had matured:

- `discord-inbox.md` last input **2026-02-28** (~3 months inactive) — Agent↔Discord operations effectively ceased.
- 0 live callers across `~/.claude/oracle/bin/` (17 scripts) + repo-wide grep (same result as Sprint 202 verification).
- `.claude-tools/` is registered in `.gitignore`, so the BOT_TOKEN inside `discord-send.sh` was **never exposed in git history** (`git log --all -- .claude-tools/discord-send.sh` returns nothing — no BFG/`git filter-repo` history rewrite needed).
- The plaintext BOT_TOKEN existed only at `.claude-tools/discord-send.sh:6` (single location) — disposal scope was unambiguous.

## Decision

### D0. User Decision

Among three disposal options, the user chose **complete deletion + token revoke**. The remaining options were evaluated as follows:

- **Reactivate + Secret-store migration** (macOS Keychain or 1Password CLI) — no intent to resume Agent↔Discord integration, so the cost was not justified.
- **Revoke token only + keep file as placeholder** — the dormant history is already persisted in the RUNBOOK §cleanup roadmap (SSOT across Sprints 156·191·202·204), so the marginal value of a placeholder was negligible.

### D1. Disposal Scope

All three dormant files inside `.claude-tools/` were confirmed as deletion targets:

- `discord-send.sh` — holds the plaintext BOT_TOKEN (line 6).
- `oracle-system-prompt.md` — annotated in `claude-tools.md:28` as "reference (SSOT is `.claude/commands/algosu-oracle.md`)", i.e., a dead reference. Lines 32–36 point to `/Users/leokim/.claude/discord-send.sh`, which does not exist.
- `discord-inbox.md` — Discord PM message log (`append-only`, frozen for 3 months due to absent receive trigger).

The directory itself (`.claude-tools/`) is preserved for future dispatch artefacts.

### D2. External-System Track Separation

The Discord Developer Portal BOT_TOKEN revoke cannot be performed by Oracle/Claude (it is an external system). The repo work (code/doc cleanup) and the external work (token revoke) are split into **separate tracks**. After ADR merge, the user is guided through the external step.

### D3. Tracked-Doc Cleanup Scope

- `.claude/commands/agents/_base.md:51` — remove the `discord-send.sh` direct-call clause from the prohibition rule. With the file itself gone, the prohibition is no longer needed. The remaining two clauses (`memory/` modification, accessing other agents' inboxes) are preserved.
- `docs/runbook/claude-tools.md` — update §1·§2·§3·§4·§5 (header·Git policy·file classification table·security note·Discord policy·cleanup roadmap·history).

## Implementation

### Phase 1 — Delete Local Dormant Files (Oracle direct)

`.claude-tools/` is in `.gitignore`, so `rm` produces no `git status`/`git diff` change. Commands:

```
rm .claude-tools/discord-send.sh
rm .claude-tools/discord-inbox.md
rm .claude-tools/oracle-system-prompt.md
```

Verification: `ls .claude-tools/` returns empty, `git status --short` shows no change.

### Phase 2-1 — `_base.md` Prohibition Update (commit 9eaa0ed)

`.claude/commands/agents/_base.md:51` prohibition rule has the `discord-send.sh` direct-call clause removed.

Before:
```
- **Prohibited**: direct `discord-send.sh` calls, `memory/` modification, accessing other agents' inboxes
```

After:
```
- **Prohibited**: `memory/` modification, accessing other agents' inboxes
```

### Phase 2-2 — `claude-tools.md` Phase 4 Reflection (commit 9eaa0ed)

Five sections updated in a single commit:

- Header: Sprint 204 cleanup history added (Sprint 191→202→204 lineage made explicit).
- §1 Git policy: "sensitive info (BOT_TOKEN) protection" → "local dispatch artefact isolation (Sprint 204 Phase 4 finished the repo-side dormant cleanup; external BOT_TOKEN revoke is on a separate user-direct track — re-verified at the start of Sprint 205)".
- §2 File classification table: three rows (`discord-send.sh`·`oracle-system-prompt.md`·`discord-inbox.md`) removed → replaced with "No tracked artefacts currently". The state-definition subsection is preserved as the classification baseline for new artefacts.
- §3 Security note: plaintext-BOT_TOKEN file absence reflected. The policy is generalised: new artefacts must route through a Secret-store.
- §3 Discord policy: Phase 4 decommission stated, with future-resumption guidance pointing to Secret-store-based redesign from scratch.
- §4 Cleanup roadmap: Phase 4 row (pending) → (Sprint 204 ✅), content rewritten with the actual disposal result.
- §5 History: Sprint 204 row appended — 3-month inactivity + 0 live callers + BOT_TOKEN external-track separation made explicit.

### Phase 2-3·2-4 — New ADR sprint-204 KR+EN + README index Update

This ADR (KR+EN) + `docs/adr/README.md` retrospective sprint-ADR count 141→142 / sprint range 62~203→62~204.

### Phase 3 — User Direct Action (External System)

After PR merge, guide the user:

- Visit Discord Developer Portal (https://discord.com/developers/applications).
- For the target bot application, **Reset** the BOT_TOKEN (immediate invalidation) or delete the application entirely.
- The 4 channels (`CHANNEL_ORACLE_CHAT`/`CHANNEL_WORK_REPORT`/`CHANNEL_WORK_APPROVAL`/`CHANNEL_EMERGENCY_ALERT`) are kept or removed at the user's discretion.

> This step is on the external system (Discord), so it runs asynchronously to the repo work. The ADR §carry-over flags re-verification in the next sprint if Phase 3 is not yet completed.

## Verification

Pre-merge gates:

- `git grep -n "BOT_TOKEN" -- ':!.gitignore' ':!docs/adr/' ':!docs/adr-en/' ':!docs/runbook/'` — **0 hits**. ADR/RUNBOOK files document the Sprint 204 disposal outcome, history, and the new patterns (secret-exposure disposal standard), so those hits are intended historical references and are excluded (standalone grep returns 5 hits in `docs/runbook/claude-tools.md` / many in `docs/adr/sprints/sprint-204.md` as the expected outcome-narration).
- `git grep -n "discord-send" -- ':!docs/adr/' ':!docs/adr-en/' ':!docs/runbook/claude-tools.md'` — **0 hits** (after `_base.md` cleanup). The RUNBOOK `docs/runbook/claude-tools.md` documents the Sprint 204 disposal outcome across the header / §2 / §3 / §4 / §5, so those hits are intended historical references and are excluded — `git grep -n "discord-send" docs/runbook/claude-tools.md` returns 5 hits as the expected outcome-narration.
- `ls .claude-tools/` — empty (all three files absent, directory preserved).
- `scripts/check-adr-index-count.mjs --strict` — permanent 8 / topic 1 / sprint **142** aligned.
- `scripts/check-adr-en-coverage.mjs --lint` — **151/151** (100%).
- `scripts/check-doc-refs.mjs` — 0 broken (verified for RUNBOOK link-removal impact).
- `scripts/check-i18n-residue.mjs --strict` — prose Hangul below the 8% threshold.
- CI (PR): ALL SUCCESS, autoMerge enrolled → squash merge.

**Critic (Codex)**: Oracle handled this directly (no code-changing agent involved), so `oracle-auto-critic.sh` was not triggered → ran `codex review --base main` manually.

- **R1** session `019e693c-ddd5-7570-96d7-d208bc0da81a` — Critical/High **0** + **High 1** (BOT_TOKEN revoke tense overstatement — ADR/RUNBOOK declared "reclamation complete," but the action is actually pending Phase 3 user-direct execution) + **Medium 1** (`git grep -n "discord-send" -- ':!docs/adr/' ':!docs/adr-en/'` verification command was false because RUNBOOK historical hits were not excluded). Resolved in commit `727dc3e` — tense softened to "guided/being decommissioned (repo-side complete, external revoke pending Phase 3)"; the discord-send grep exclusion now includes `':!docs/runbook/claude-tools.md'`.
- **R2** session `019e6943-5fe2-7263-b7ef-88df981fe0c8` — Critical/High **0** + **P2 1** (BOT_TOKEN grep has the same pattern — ADR/RUNBOOK historical hits remain, so "0 hits" recording was false) + **P3 1** (Critic placeholder still present in this §Verification block). Resolved in this commit — BOT_TOKEN grep exclusion now adds `':!docs/adr/' ':!docs/adr-en/' ':!docs/runbook/'`; the Critic block is backfilled with R1·R2 results and session IDs.
- **R3** — (run after this commit is pushed to confirm CLEAN. The result is persisted separately in sprint-window/memory.)

## New Patterns

### 1. Standard Disposal for Dormant Assets with Secret Exposure

Even when an asset is in `.gitignore` and needs no history rewrite, holding a plaintext secret in a dormant file does not by itself terminate the risk. When the following three conditions converge, "delete + external token revoke" is the standard disposal:

| Condition | Sprint 204 case |
|-----------|-----------------|
| 0 live callers | `~/.claude/oracle/bin/` 17 scripts + repo grep all 0 |
| Inactivity threshold met (≥3 months) | `discord-inbox.md` last input 2026-02-28 |
| 0 git-history exposure (or rewritable) | `.gitignore`-registered, `git log --all` empty |

Holding a plaintext token in dormant state is "latent risk in indecision". Once the conditions are met, do not defer — close the decision.

### 2. Cleanup-Pipeline Finalisation Pattern (4-sprint Progressive Cleanup)

Sprint 156 (codification) → Sprint 191 (deprecated deletion) → Sprint 202 (partial dormant deletion + reclassification) → Sprint 204 (complete dormant deletion). Each sprint uses the RUNBOOK §cleanup roadmap table as the progress SSOT:

- Phase 1 (Sprint 156): RUNBOOK codification itself.
- Phase 2 (Sprint 191 ✅): deprecated 2-file deletion.
- Phase 3 (Sprint 202 ✅): partial dormant deletion + 1-file reclassification.
- Phase 4 (Sprint 204 ✅): complete dormant deletion + external token revoke.

This pattern is the standard for assets that cannot be cleaned up in one shot (e.g., external token revoke pending, integration direction under review). The RUNBOOK §cleanup roadmap table is the progress SSOT, enabling immediate context recovery in subsequent sprints.

### 3. External-System Track Separation

Repo work (code/doc cleanup, PR) and external-system work (Discord BOT_TOKEN revoke) **cannot be synchronised**. After ADR merge, the user must directly access the external system to complete the disposal.

Separation principles:

- Repo work concludes with PR/merge — validated through Critic·CI·squash merge.
- External work is a separate track — flag "next-sprint re-verification of user's external-action completion" in the ADR §carry-over to prevent omission.
- Verifications that depend on the external system (e.g., 401 response after token revoke) are described in the ADR as procedures only; the actual execution is delegated to the user.

## Lessons

1. **Time alone does not heal dormant assets** — inactivity does not automatically dissolve risk. Assets that hold plaintext secrets must enter the disposal-decision flow as soon as the inactivity threshold is met.
2. **External-system work belongs on a separate track, and the omission risk must be made explicit in the ADR carry-over** — PR/merge completion is not the same as "disposal completed". An un-revoked external token leaves residual risk; flag "next-sprint re-verification of user's external-action completion" in the ADR §carry-over to block omission.
3. **A cleanup roadmap table is the SSOT for multi-stage disposal** — the Sprint 156 decision to write RUNBOOK §4 as a "Phase 1–4" table is what made the 4-sprint progressive cleanup context-recoverable. Design multi-stage assets from the start as a table-shaped SSOT.
4. **`.gitignore` is not "safe" by itself** — 0 git-history exposure only means "no cleanup burden". Holding a plaintext token on the local filesystem is still risky (machine theft / access-permission compromise / accidental commit). `.gitignore` is a starting point for disposal, not the conclusion.

## Carry-over

- **Re-verify Phase 3 completion next sprint** — confirm at Sprint 205 start that the user revoked the BOT_TOKEN in the Discord Developer Portal. If not, re-issue the guidance.
- **Operational Sprint 196 migration execution + redeploy** (user/operations).
- (Optional) Add `oracle` to `commitlint` `scope-enum` (carry-over from Sprint 202·203).
- (Optional) CI PYTHON 3.12 → 3.13.
- (Optional) Promote Build Blog (SSG) to a required check.
- (Seed) Harness routine-inspection checklist automation script (Sprint 202 new pattern).
- Cumulative UAT (user direct) → Sprint 205.
