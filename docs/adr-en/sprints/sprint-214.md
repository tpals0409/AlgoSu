---
sprint: 214
title: "Echelon 1 Tier Model Migration to claude-opus-4-8"
date: "2026-05-29"
status: completed
agents: [Oracle, Critic]
related_adrs: ["sprint-202", "sprint-208", "sprint-209"]
related_memory: ["sprint-window", "oracle-dispatch"]
topics: ["oracle", "agents", "harness", "config"]
tldr: "Promoted the AlgoSu agent harness's Echelon 1 (tier 1) agents — conductor, gatekeeper, librarian — from claude-opus-4-7 to claude-opus-4-8. The three model-ID SSOT locations established in Sprint 202 (.claude-team.json agents[].model / each agent .md frontmatter / oracle-spawn.sh get_model() fallback case) were updated in sync, and the patch code and expected output in the RUNBOOK oracle-model-ssot.md were brought to the Sprint 214 state. palette (tier 3 opus exception) and the Oracle lead's own model were kept at 4-7 per the user's scope instruction ('Echelon 1 tier'), so the former single conductor|gatekeeper|librarian|palette case was split into Echelon 1 (→4-8) and palette (→4-7) cases. Before starting, claude-opus-4-8 was ping-checked (→pong) to confirm Cmux/CLI compatibility, harness Item 2 (.claude-team.json ↔ oracle-spawn.sh --show-model 3-way consistency) PASSed, and both the jq-lookup and fallback paths were verified directly. Critic (Codex) CLEAN."
---
# Sprint 214 — Echelon 1 Tier Model Migration to claude-opus-4-8

## Goal

- Promote the Echelon 1 (tier 1) agents **conductor, gatekeeper, librarian** from `claude-opus-4-7` → `claude-opus-4-8`.
- Update the three model-ID SSOT locations established in [Sprint 202](./sprint-202.md) in sync to maintain consistency.
- Keep palette (tier 3 opus exception) and the Oracle lead's own model at 4-7 per the user's scope instruction.

## Background

[Sprint 202](./sprint-202.md) resolved the dead-code problem where `.claude-team.json` `agents[].model` was unused, and refactored `oracle-spawn.sh` `get_model()` to jq-lookup `.claude-team.json`, consolidating the model-ID SSOT. Since then, model IDs must stay consistent across three locations:

1. `.claude-team.json` `agents[].model` — primary SSOT (jq-lookup target)
2. `~/.claude/oracle/bin/oracle-spawn.sh` `get_model()` fallback `case` — safety net when jq is absent / JSON is malformed (out-of-repo; patch preserved in RUNBOOK [oracle-model-ssot.md](../../runbook/oracle-model-ssot.md))
3. Each agent's `.claude/commands/agents/{name}.md` frontmatter `model:`

`harness-checkup.sh` Item 2 verifies (1) ↔ (2) consistency, and Item 3 (`--full`) verifies actual ping responses for unique model IDs.

The user instruction was "Echelon 1 tier model change to Opus 4.8" — explicitly targeting only **Echelon 1 tier (tier 1)** agents. Echelon 1 comprises conductor, gatekeeper, and librarian. palette is tier 3 but an opus exception, and Oracle is the lead (outside the tiers), so both are excluded from this scope.

## Decisions

### D0. Scope — promote only the three Echelon 1 (tier 1) agents

- **Targets**: conductor, gatekeeper, librarian → `claude-opus-4-8`
- **Excluded (kept at 4-7)**:
  - **palette** (tier 3, opus exception) — the user scoped to "Echelon 1 tier." The model policy for design-system work is a separate decision and is not changed in this sprint.
  - **Oracle lead** (`.claude/commands/algosu-oracle.md` frontmatter) — the lead/judge, not a tier 1 agent. Out of scope.
  - **Translation tooling** (the translate-adr.mjs model in `docs/adr-en/README.md`) — unrelated to agent models.

### D1. Split the fallback case

The former `oracle-spawn.sh:43` grouped `conductor|gatekeeper|librarian|palette` into one case returning `claude-opus-4-7`. Since only Echelon 1 is promoted to 4-8, the case is split in two.

```bash
# Before
conductor|gatekeeper|librarian|palette) echo "claude-opus-4-7" ;;
# After
conductor|gatekeeper|librarian) echo "claude-opus-4-8" ;;
palette) echo "claude-opus-4-7" ;;
```

The RUNBOOK `oracle-model-ssot.md` §3 patch code, §5 expected output, and §6 ping examples were split/updated identically so that replaying on another machine reproduces the Sprint 214 state.

### D2. Pre-verify the model ID (ping)

Before starting, confirm once that the new model ID `claude-opus-4-8` is actually callable (inheriting the Sprint 202 Cmux compatibility dry-run pattern).

```bash
claude --model claude-opus-4-8 -p "ping"   # → pong (compatibility OK)
```

Had the ping failed, it would mean the 4-8 ID is not yet available, so the decision tree was to defer the promotion.

### D3. Oracle performs directly

All change targets are `.claude/commands/` skill/agent files and an out-of-repo harness script (`~/.claude/oracle/bin/`). Per the `_base.md` convention, ordinary agents cannot modify skill files (Oracle only), and the harness script is out-of-repo. Therefore Oracle handles it directly as a simple config edit, with a Critic (Codex) cross-review at the merge gate.

## Implementation

Single atomic commit `efea4d2` (`chore(oracle): bump Echelon 1 tier model to claude-opus-4-8`), PR #376 Squash merge → main `a1c9167`.

### Modified files (in-repo, 5)

- `.claude-team.json` — conductor/gatekeeper/librarian `model` (3) → `claude-opus-4-8` (palette on line 19 kept at 4-7)
- `.claude/commands/agents/conductor.md` — frontmatter `model: claude-opus-4-8`
- `.claude/commands/agents/gatekeeper.md` — frontmatter `model: claude-opus-4-8`
- `.claude/commands/agents/librarian.md` — frontmatter `model: claude-opus-4-8`
- `docs/runbook/oracle-model-ssot.md` — header Sprint 214 amendment note + §3 patch case split + §3 example + §5 expected output + §6 ping examples updated

### Modified files (out-of-repo, 1)

- `~/.claude/oracle/bin/oracle-spawn.sh:43` — `get_model()` fallback case split (Echelon 1 → 4-8, palette → 4-7). Not git-tracked, so it does not appear in the PR diff; preserved as patch code in the RUNBOOK.

## Verification

Oracle direct verification:

- `bash -n ~/.claude/oracle/bin/oracle-spawn.sh` → syntax OK
- `jq -r '.agents[] | "\(.name) \(.model)"' .claude-team.json` → conductor/gatekeeper/librarian = `claude-opus-4-8`, palette = `claude-opus-4-7`, the other 8 = `claude-sonnet-4-6`
- `oracle-spawn.sh --show-model <agent>` (3-way SSOT cross-check) → exact match with the JSON mapping
- **Fallback case path verification** — running `--show-model` in a subshell with jq masked via `PATH="/usr/bin:/bin"` → conductor/gatekeeper/librarian = 4-8, palette = 4-7, architect = sonnet (both jq-lookup and fallback paths correct)
- `bash scripts/harness-checkup.sh` Item 2 → **PASS** (`.claude-team.json ↔ oracle-spawn.sh get_model() mapping consistent`, 12 agents)
- ping verification — `claude --model claude-opus-4-8 -p "ping"` → `pong` / `claude --model claude-opus-4-7 -p "ping"` → normal response
- CI #376 — `gh pr view` `mergeable: MERGEABLE` / `state: CLEAN` / `failing: []` (commitlint scope=oracle, Secret & Env Scan, Audit/Quality/Test all services pass)

## Lessons

1. **A model-ID promotion requires syncing all three SSOT locations** — the (1) `.claude-team.json` (2) `oracle-spawn.sh` fallback case (3) agent `.md` frontmatter established by Sprint 202 must all match. Changing only the primary SSOT (JSON) diverges on jq-less machines where the fallback case returns the old model. harness Item 2 verifies (1)↔(2), so confirming a PASS before merge is the safety line.
2. **A partial-scope promotion must split a grouped case** — the former `conductor|gatekeeper|librarian|palette` single case is only valid when all four share a model. To raise only Echelon 1, the case must be split so palette is not promoted unintentionally. The "tier 1 only" scope instruction was reflected directly in the case structure.
3. **Ping-check a new model ID for availability before starting** — for a new ID like `claude-opus-4-8` not listed in the environment context, confirm it is actually callable via `claude --model <ID> -p "ping"` before wiring it into config. pong → proceed, no response → defer — wiring in a nonexistent ID breaks all spawns for that tier (a generalization of the Sprint 202 Cmux compatibility dry-run pattern).
4. **The fallback path can be verified directly with a jq-masked subshell** — calling `--show-model` in a subshell that removes jq from PATH via `PATH="/usr/bin:/bin"` makes the jq-lookup fail and exercises the fallback case. Verifying both the primary path (jq-lookup) and the safety net (case) confirms SSOT consistency end-to-end.

## New Patterns

- **Fallback-case split pattern for partial-scope model promotion** — when raising the model for only some agents in a grouped `case "a|b|c|d)"`, split the promoted group and the retained group into separate cases. The SSOT (JSON) is per-item so it splits naturally, but the fallback case must be split explicitly to prevent unintended co-promotion. Update the RUNBOOK's expected-output comments together to keep replay consistency.

## Sprint 215+ Carryover

- **Server redeploy + live SEO verification** (user/ops): Sprint 212/213 deliverable. merge ≠ live; after redeploy confirm domain consistency via `curl https://algo-su.com/sitemap.xml` / `robots.txt` <!-- doc-ref-lint: ignore -->
- **GA4 data stream URL consistency + Enhanced Measurement history page_view OFF** (user, carried from Sprint 210/211/212)
- **GA4 production page_view UAT** (user, carried from Sprint 210/211)
- **Run the ops Sprint 196 migration** (user/ops)
- **Review harness `--full` CI scheduled-run automation** (carried from Sprint 209): automate early detection of model-ID retirement and new-ID availability

## Critic Cross-Review

**R1 — CLEAN** (Codex, `codex review --base a6fc66b`, codex-cli 0.130.0 / gpt-5 family, session `019e70f6-6cc4-7f71-9cbe-f0b09bd94ee6`)

> "The changes consistently update the targeted tier 1 agent model IDs and the corresponding runbook examples while preserving the documented palette exception. No actionable regressions were found in the modified files."

Critical / High / Medium / Low findings **all 0**. Confirmed the Echelon 1 model-ID updates and RUNBOOK examples are consistent and the palette exception is preserved.
