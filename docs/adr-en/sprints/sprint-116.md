---
sprint: 116
title: "Oracle Dispatch and Agent Workflow Improvements"
period: "2026-04-22"
status: complete
start_commit: 8871e12
end_commit: TBD
---

# Sprint 116 — Oracle Dispatch and Agent Workflow Improvements

## Background

In Sprints 114–115, the Critic (reviewer) agent was established and the Codex CLI direct call path was proven, but **inconsistencies remained where the dispatch pipeline and related infrastructure did not fully recognize Critic**:

1. Critic not registered in `.claude-team.json` agents array — mismatch between team config and actual agents
2. No `merge-gate` preset — no dedicated path for calling Critic alone before merge
3. Critic persona (`critic.md`) written using `/codex:*` slash command approach — unparseable in `claude -p` non-interactive mode
4. `oracle-watchdog.sh`'s `get_tier()` function not explicitly registering Critic, relying on tier 2 fall-back
5. Potential task ID collision (microsecond-level collision during concurrent dispatch) and no tool for managing old archives

This sprint resolves these 5 inconsistencies to make Critic fully operational in the dispatch pipeline.

## Goals

| Phase | Content | Status |
|-------|---------|--------|
| A | `.claude-team.json` consistency patch (critic registration + merge-gate preset) | ✅ Complete |
| B-0 | Spike — verify `/codex:*` slash vs CLI direct call behavior | ✅ Complete |
| B-2 | Critic persona correction (`/codex:*` → Bash direct call approach) | ✅ Complete |
| C | Operational stabilization (watchdog critic explicit, task ID PID suffix, cleanup --archive-old) | ✅ Complete |
| D | Documentation sync & ADR writing (this document) | ✅ Complete |

---

## Decisions

### D1. Critic dispatch pipeline integration — tmux dispatch + Bash direct codex CLI call

**Background**: Sprint 114 D3 decided "interactive mode only, dispatch as follow-up," but Phase E (Sprint 115) proved that `codex review --base` CLI direct call works completely. Therefore, integrating dispatch via Bash tool directly calling codex CLI within an independent process (`claude -p`).

**Options**:
- (A) Keep interactive mode only — Critic called only from Oracle main session
- (B) **tmux dispatch + Bash `codex review` CLI direct call** ← selected — works completely in independent process

**Selected**: (B) — Sprint 115 Phase E verified that `codex review --commit <SHA>` / `--base <SHA>` works completely in `claude -p` environment as well. Dispatch integration enables Oracle to call Critic via the same tmux pipeline as other agents.

**Result**: `critic.md` "task reception" section "standalone execution mode: currently unsupported" → changed to supported. Explicit `codex review --commit HEAD` or `--base <SHA>` call via Bash tool.

---

### D2. Register critic in `.claude-team.json` agents/presets + create merge-gate preset

**Background**: `.claude-team.json` is the SSOT (Single Source of Truth) for agent team configuration, but registration was missing after Critic was established in Sprint 114.

**Options**:
- (A) Leave as-is — tolerate mismatch between file and actual agents
- (B) **Immediate sync** ← selected — simultaneously update agents array + presets

**Selected**: (B) — SSOT principle. The longer the inconsistency persists, the more confusion increases.

**Changes**:
- `agents` array: `critic` entry added between Curator and Herald (`tier: 2`, `model: claude-sonnet-4-6`, `description: "Codex(gpt-5) based cross code review, merge-gate reviewer"`)
- `presets.review`: `["scout", "sensei"]` → `["scout", "sensei", "critic"]`
- `presets.merge-gate`: `["critic"]` newly added — dedicated preset for Critic-only call just before merge

**Result**: Commit `d5d9585`. Team configuration fully aligned with 12 agents.

---

### D3. Critic persona correction — remove `/codex:*` slash → explicitly state Bash + codex CLI direct call

**Background**: As Sprint 116 Phase B-0 Spike conclusion, `/codex:review`-style slash commands are not parsed in `claude -p` non-interactive mode (verified). The `critic.md` persona written during Sprint 114 with `/codex:*` approach is inconsistent with the actual working path.

**Options**:
- (A) Document both approaches (interactive mode + standalone mode branching)
- (B) **Document only Bash tool direct call approach** ← selected — single path, eliminate confusion

**Selected**: (B) — Documenting two paths forces future agents to judge the correct path based on environment, adding unnecessary complexity. Bash direct call works in both environments (interactive/standalone process), so unifying to a single path.

**Result**: `critic.md` review section corrected from `/codex:review --base` → `Bash: codex review --commit HEAD` / `codex review --base <SHA>`. After correction in Sprint 116 [B-2] session (`019db372-89db-7ce3-8ee2-1852e239ddda`), 1 successful call confirmed (improvement from 2 attempts to 1).

---

### D4. Explicitly register critic in `oracle-watchdog.sh` get_tier() — remove tier 2 fall-back

**Background**: The watchdog's `get_tier()` function only explicitly registered tier 1 agents, with everything else falling back to default (tier 2). Critic was accidentally receiving tier 2, but since it wasn't explicitly registered, silent errors were possible if logic changed in the future.

**Options**:
- (A) Keep fall-back — tier 2 is correct so result is the same
- (B) **Explicitly register critic as tier 2** ← selected — express intent in code

**Selected**: (B) — "Intentionally explicit" structure over "accidentally correct" structure. Fall-back dependency can introduce bugs when tier structure changes in the future.

**Result**: `critic)` branch added to `oracle-watchdog.sh` `get_tier()` case statement (return 2).

---

### D5. Operational stabilization — task ID PID suffix + cleanup.sh `--archive-old [DAYS]`

**Background**: Two independent operational vulnerabilities handled together in Phase C.

#### D5-a. Add task ID PID suffix (collision prevention)

**Background**: Existing task ID format: `task-{DATE}-{HHMMSS}-{scope}`. Filename collision possible when multiple dispatches occur within the same second with identical timestamps.

**Options**:
- (A) Extend to microseconds (`%N`)
- (B) **Add PID suffix** ← selected — `task-{DATE}-{HHMMSS}-{PID}-{scope}` format

**Selected**: (B) — Process ID guarantees uniqueness within the same second, and enables tracing which process generated it when humans read the files.

**Result**: PID (`$$`) inserted during task ID generation in `oracle-create-task.sh`.

#### D5-b. New `cleanup.sh --archive-old [DAYS]` option

**Background**: Completed result files accumulating in `~/.claude/oracle/inbox/`, causing the directory to grow. Manual deletion is cumbersome and risks accidental deletion of important files.

**Options**:
- (A) Continue manual cleanup
- (B) **`--archive-old [DAYS]` option** ← selected — move files exceeding specified days to `~/.claude/oracle/archive/YYYY-MM/`

**Selected**: (B) — Archive move instead of deletion allows recovery. Monthly directory structure enables easy browsing of old files.

**Result**: `--archive-old [DAYS]` option added to `cleanup.sh`. Default 30 days. `archive/YYYY-MM/` auto-created.

---

## Spike Conclusion — Phase B-0

> Session ID: B-0 `019db364-ca7b-7a01-892e-668ffeef5eff`

| Verification Item | Result |
|-------------------|--------|
| `/codex:*` slash commands — operation in `claude -p` non-interactive mode | ❌ Unparseable — output as plain text |
| `codex review --commit HEAD` CLI direct call | ✅ Fully operational |
| `codex review --base <SHA>` CLI direct call | ✅ Fully operational |
| Simultaneous use of `--commit`/`--base` and `[PROMPT]` positional | ❌ Mutually exclusive (CLI error) |
| Method to pass custom instructions | `echo "instruction" \| codex review --commit HEAD` stdin approach |
| Codex version | codex-cli 0.122.0 |
| Model | gpt-5.4 |

**Key conclusion**: `/codex:*` slash commands are exclusive to Claude Code interactive mode and do not work in `claude -p` standalone processes. Calling the `codex` binary directly via Bash tool is the only common path covering both interactive and standalone modes.

---

## Verification Results

| Phase | Verification Content | Result |
|-------|---------------------|--------|
| A | `.claude-team.json` agents.length = 12, presets.merge-gate = ["critic"] | ✅ |
| A | critic registered in `oracle-create-task.sh` VALID_AGENTS confirmed | ✅ |
| B-0 | Codex CLI direct call success — review target d5d9585 merge-ready judgment | ✅ |
| B-2 | Corrected persona: 1 successful call (improved from 2 attempts to 1) | ✅ |
| B-2 | Review target 35ccc2b merge-ready judgment (session `019db372-89db-7ce3-8ee2-1852e239ddda`) | ✅ |
| C | Task ID PID suffix added — concurrent dispatch collision reproduced then resolved | ✅ |
| C | `cleanup.sh --archive-old 30` run — `archive/2026-04/` creation confirmed | ✅ |
| C | `oracle-watchdog.sh` `get_tier(critic)` = 2 explicit operation confirmed | ✅ |

---

## Key Outputs

**Modified 1** (commit `d5d9585`):
- `.claude-team.json` — agents array critic added, presets.review extended, presets.merge-gate created

**Script modifications** (`~/.claude/oracle/bin/` — outside version control):
- `oracle-watchdog.sh` — `get_tier()` critic explicitly registered (tier 2)
- `oracle-create-task.sh` — task ID PID suffix added
- `cleanup.sh` — `--archive-old [DAYS]` option newly added

**Persona correction** (`.claude/commands/agents/critic.md`):
- `/codex:*` slash command approach → Bash + `codex review --commit/--base` CLI direct call approach

**Documentation**:
- `CLAUDE.md` — `merge-gate` preset mention added to Agent workflow section
- `docs/adr/sprints/sprint-116.md` — this ADR (new)

---

## Risks & Mitigation

- **R1 `~/.claude/oracle/bin/` not version controlled**: Scripts located in home directory cannot be tracked by git. Oracle performs manual backup before modifications; PreToolUse hook exception registration added as follow-up task.
- **R2 Codex credit consumption**: Dispatch integration may increase Critic call frequency. Oracle follows guideline restricting `merge-gate` preset calls to just before merge.
- **R3 Task ID format change compatibility**: PID suffix addition may affect existing task ID parsing logic. `oracle-watchdog.sh` and `cleanup.sh` filename pattern matching maintained as prefix matching (`task-*`) for compatibility.

## Lessons Learned

- **Slash commands are interactive mode only**: Claude Code's `/foo:bar` slash commands are processed by the interactive session UI and treated as plain strings in `claude -p` standalone processes or Bash tools. When documenting slash commands in agent personas, always either include or replace with Bash direct call paths.
- **Delayed sync of SSOT files creates silent bugs**: `.claude-team.json` remained in inconsistent state for 2 sprints after Critic was established. Immediately syncing related config files when adding/modifying agents is the principle; listing config file modifications in ADR "Key Outputs" prevents omissions.
- **"Accidentally correct" structures are code debt**: Even if `get_tier()` fall-back happened to return the correct value, not expressing the intent means the next modifier may make incorrect changes not understanding the structure. Intent should always be expressed in code.
- **Immediately apply Spike conclusions to personas**: The fact that slash command parsing fails — discovered in B-0 Spike — was immediately applied to `critic.md` correction in B-2. Closing the Spike → persona correction cycle within the same sprint prevents accumulating debt for the next sprint.

## Follow-up Tasks (Next Sprint Seeds)

- **Add `oracle` to commitlint scope-enum**: Currently routing `.claude/`-related commits with `infra` scope. `oracle-*.sh`, `.claude-team.json`, `critic.md`, etc. should be separated into their own scope for clear semantics.
- **Revisit `.claude/` gitignore policy**: Establish version control strategy for agent persona files (`.claude/commands/agents/`). Currently some files are tracked and some are excluded — a consistent policy is needed.
- **Explore PreToolUse hook exception registration for `~/.claude/oracle/bin/` modifications**: Restrict Scribe and other agent access via hook so only Oracle performs script modifications.
- **Process 4 remaining sprint-window.md items**: Redis statistics cache, problem.tags JSON column migration, dashboard/page.tsx SWR migration, admin/feedbacks/page.tsx SWR migration.

## Carried Over

None — All 5 planned Phases complete.
