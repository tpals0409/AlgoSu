---
sprint: 114
title: "Critic Agent Establishment — Codex-based Cross Code Review"
period: "2026-04-22"
status: complete
start_commit: e4f0641
end_commit: 84e044e
---

# Sprint 114 — Critic Agent Establishment (Codex-based Cross Code Review)

## Background

AlgoSu has 11 agents (Echelon 1–3) dividing MSA migration work under Oracle's direction. Code review has been handled by two axes — Gatekeeper (security/contracts) and Oracle (planning/ADR) — but **both operate within the Claude model family**, making it impossible to cross-validate blind spots that the same model misses (blind spots from the same training distribution).

OpenAI's `codex-plugin-cc` (https://github.com/openai/codex-plugin-cc) enables calling Codex (gpt-5) CLI as slash commands within Claude Code:
- `/codex:review` — general code review
- `/codex:adversarial-review` — design decision/failure mode pressure review
- `/codex:status`, `/codex:result`, `/codex:cancel` — background task management

Using this to establish a **merge-gate dedicated Critic (reviewer)** agent as Echelon 2 Core.

## Goals

| Phase | Content | Status |
|-------|---------|--------|
| A | Codex CLI installation + codex-plugin-cc plugin setup | ✅ Partial (A1) / ⏸ Awaiting user action (A2 login, A3 plugin) |
| B | `.claude/commands/agents/critic.md` persona writing | ✅ Complete |
| C | Oracle pipeline integration (algosu-oracle.md, oracle-spawn.sh, oracle-build-prompts.sh, prompts/critic.txt) | ✅ Complete |
| D | Documentation updates (CLAUDE.md, start.md, this ADR) | ✅ Complete |
| E | Verification (Sprint 113 SWR commit target `/codex:review --base 75cb80f` demo) | ⏸ After user login |

---

## Decisions

### D1. Agent Name = Critic

**Background**: Need appropriate name for a dedicated 2nd-review agent based on OpenAI Codex.

**Options**:
- (A) Reviewer — too generic, confuses with existing Gatekeeper role
- (B) Auditor / Inspector — audit/inspection nuance fits but reduces creative critique
- (C) **Critic** ← selected — semantically consistent with `adversarial-review` (design challenge), matches existing naming tone (Gatekeeper/Sensei/Palette)

**Result**: Persona file `critic.md`, prompt build `prompts/critic.txt`, skill namespace `agents:critic`.

---

### D2. Echelon 2 — Core Placement

**Background**: Grade for an agent with merge-blocking authority.

**Options**:
- (A) Echelon 1 (Mission Critical, opus) — equivalent to Oracle/Gatekeeper/Librarian
- (B) **Echelon 2 (Core, sonnet)** ← selected — equivalent to Architect/Scribe/Postman/Curator
- (C) Echelon 3 (Enhancement) — downgraded to supplementary

**Selected**: (B) — Critic itself is a **wrapper delegating** review to Codex, so Claude model doesn't need to be sonnet. Merge-gate influence is significant but no direct decision-making (planning/ADR) — doesn't qualify for Echelon 1.

**Result**: `oracle-spawn.sh` `get_tier()` = 2, `get_model()` = `claude-sonnet-4-6`.

---

### D3. Interactive Mode Only (tmux dispatch as follow-up)

**Background**: Existing pipeline has `oracle-spawn.sh` spawning `claude -p` independent process in tmux pane. Whether `/codex:*` slash commands work in an independent process was unverified.

**Options**:
- (A) Write runner calling `codex exec` directly from the start
- (B) **Interactive mode only (call within Oracle session), dispatch as follow-up** ← selected

**Selected**: (B) — Risk avoidance. When Critic executes `/codex:review` directly in Oracle's main session, plugin context is preserved and user subscription/auth is naturally inherited. Spawn path only has `VALID_AGENTS` registration — actual dispatch explicitly stated as "currently unsupported."

**Result**: `critic.md` "task reception" section states "standalone execution mode: currently unsupported."

---

### D4. Scope = Review Dedicated (Rescue Excluded)

**Background**: codex-plugin-cc also provides `/codex:rescue` (bug investigation/fix delegation).

**Options**:
- (A) Include Rescue — Critic also has code modification authority
- (B) **Review dedicated (rescue excluded)** ← selected — read-only, modifications delegated to Herald/Architect/Postman, etc.

**Selected**: (B) — Single responsibility principle. If reviewer also fixes, role boundaries collapse. Rescue allowed as exception only with explicit Oracle approval when needed.

**Result**: `critic.md` prohibited actions: "direct code modification prohibited", "/codex:rescue prohibited (exception with Oracle approval)."

---

### D5. Critic Model = sonnet / Actual Analysis = Codex gpt-5

**Background**: Claude-sonnet-4-6 vs Claude-opus-4-6 selection.

**Selected**: sonnet — Claude side of Critic's role is lightweight "Korean summary/structuring of Codex results." Actual reasoning performed by Codex gpt-5 — no need for double opus cost.

---

## Key Outputs

**New 1**:
- `.claude/commands/agents/critic.md`

**Modified 5**:
- `.claude/commands/algosu-oracle.md` — agent list 11→12, code review delegation rule added
- `~/.claude/oracle/bin/oracle-spawn.sh` — critic registered in `VALID_AGENTS` + `get_tier()`
- `~/.claude/oracle/bin/oracle-build-prompts.sh` — critic added to `AGENTS` array
- `CLAUDE.md` — Agent workflow section 12 agents
- `.claude/commands/start.md` — dashboard agent list

**Auto-generated 1**:
- `~/.claude/oracle/prompts/critic.txt` (oracle-build-prompts.sh execution result)

**Installed**:
- Codex CLI 0.122.0 (global `@openai/codex`)

---

## User Follow-up Actions

1. `! codex login` — OAuth or API key registration
2. Inside Claude Code:
   ```
   /plugin marketplace add openai/codex-plugin-cc
   /plugin install codex@openai-codex
   /reload-plugins
   /codex:setup
   ```
3. Verification: Ask Oracle "Review Sprint 113 changes with Critic" → Critic executes `/codex:review --base 75cb80f`

## Risks & Mitigation

- **R1 Codex usage**: ChatGPT subscription quota consumed — Oracle calls only immediately before merge or for large changes
- **R2 Sensitive info exposure**: Caution with diff containing `.env`/JWT — explicitly stated in persona prohibited actions
- **R3 Korean response rule**: Codex responds in English — Critic persona converts to Korean summary

## Lessons Learned

- **Claude Code built-in slash commands not exposed to AI tools**: `/reload-plugins`/`/codex:setup` CLI builtins cannot be called through Bash/Skill/MCP. All 4 alternatives (Bash/Skill/tmux-send-keys/osascript) confirmed blocked. osascript failed due to macOS accessibility permission not granted (-25211). Conclusion: Plugin activation requires user slash commands or session restart
- **Manual plugin installation path equivalence**: 3 steps — `known_marketplaces.json` registration + `cache/{market}/{plugin}/{version}/` file copy + `installed_plugins.json` entry addition — are equivalent to `/plugin install` internal operation. Only activation requires `/reload-plugins`
- **Remote OAuth device-auth mode is standard**: Regular `codex login` requires localhost:1455 callback → fails on remote device approval when callback doesn't arrive. `--device-auth` mode only shares device code — can approve from anywhere on external devices → recommended default for remote/automated environments
- **codex-plugin-cc structure standard compliance**: commands(7) + agents(1: codex-rescue) + hooks + skills + prompts — fully compliant with Claude Code plugin spec. When writing Critic persona, can reference plugin internal docs (`commands/review.md` etc.) to ensure argument format consistency
- **Separate installation steps early in plan mode**: Phase A (infrastructure installation) explicitly stated as independent step parallelizable with Phase B–D (file writing) → even when user manual actions (login, slash commands) become blockers, document/persona work proceeds. Minimizes time loss in remote environments

## Carried Over

- **Phase E verification complete (Sprint 115)**: In the next session, demo review performed via `codex review --base 75cb80f` CLI direct call → P2 2 items found → Herald fix → re-review P1 1 item found → fix → final ✅. Critic triple value proven. Details: [sprint-115.md](./sprint-115.md)
