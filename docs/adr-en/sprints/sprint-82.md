---
sprint: 82
title: "Oracle tmux Auto-Dispatch Pipeline"
date: "2026-04-13"
status: completed
agents: [Oracle]
related_adrs: []
---

# Sprint 82: Oracle tmux Auto-Dispatch Pipeline

## Goals
Build an automated pipeline where Oracle spawns agents as independent processes (`claude -p`) in tmux and allocates/collects tasks via file-based IPC.

## Background
Before: 11 agents executed sequentially in a single Claude session → no parallelization, context window overload
After: Independent process spawn via tmux → parallel execution, file-based IPC

## Architecture
```
Oracle (tmux control pane)
  → oracle-dispatch.sh
    → oracle-spawn.sh {agent} (tmux tier{N} pane) — claude -p
  → oracle-reap.sh (result collection)
  → oracle-watchdog.sh (timeout monitoring)
```

### tmux Session Structure
- session: "oracle"
  - window 0 "control": Oracle process
  - window 1 "tier1": conductor, gatekeeper, librarian (dynamic pane)
  - window 2 "tier2": architect, scribe, postman, curator
  - window 3 "tier3": herald, palette, scout, sensei

### File-Based IPC
- `~/.claude/oracle/tasks/{task_id}.json` — task queue
- `~/.claude/oracle/inbox/{agent}-{task_id}.md` — agent results
- `~/.claude/oracle/prompts/{agent}.txt` — built system prompts
- `~/.claude/oracle/logs/{agent}-{task_id}.out` — stdout logs
- `~/.claude/oracle/state/panes.json` — active pane mapping
- `~/.claude/oracle/state/locks/{agent}.lock` — concurrent execution prevention

## Implementation Details

### Phase 1: Directory + Prompt Build
- `~/.claude/oracle/` directory structure created
- `_result-protocol.md`: agent result output specification
- `oracle-build-prompts.sh`: _base.md + {agent}.md + _result-protocol.md → prompts/{agent}.txt

### Phase 2: Core Scripts
- `oracle-init.sh`: tmux session initialization (4 windows)
- `oracle-spawn.sh`: agent spawn (per-tier pane, model mapping)
- `oracle-reap.sh`: result collection (inbox file + task JSON status update)
- `oracle-dispatch.sh`: dependency DAG resolution → parallel spawn
- `oracle-watchdog.sh`: 30-second interval timeout monitoring
- `oracle-status.sh`: system status query
- `oracle-cleanup.sh`: graceful shutdown

### Phase 3: Agent Prompt Refactoring
- `_base.md`: added "independent execution mode" section
- 11 agent `.md` files: `User request: $ARGUMENTS` → dual-mode task receipt section

### Phase 4: Existing System Integration
- `claude-team.sh`: dispatch mode detection → oracle-init.sh / oracle-cleanup.sh integration
- `oracle-respond.sh`: task JSON creation after code work → dispatch delegation
- `oracle-system-prompt.md`: dispatch system recognition + task JSON format
- `.claude-team.json`: 11 agents + presets + dispatch settings

### Phase 5: Oracle Skill Modification
- `algosu-oracle.md`: added dispatch pipeline usage + judgment criteria

## Agent Model Mapping
| Tier | Agent | Model |
|------|-------|-------|
| 1 | conductor, gatekeeper, librarian | claude-opus-4-6 |
| 2 | architect, scribe, postman, curator | claude-sonnet-4-6 |
| 3 | herald, scout, sensei | claude-sonnet-4-6 |
| 3 | palette (exception) | claude-opus-4-6 |

## Verification
- `oracle-build-prompts.sh`: 11/11 agents built successfully
- `oracle-status.sh`: normal output confirmed (no active session state)

## File List
| File | Action |
|------|--------|
| `~/.claude/oracle/bin/oracle-init.sh` | New |
| `~/.claude/oracle/bin/oracle-spawn.sh` | New |
| `~/.claude/oracle/bin/oracle-reap.sh` | New |
| `~/.claude/oracle/bin/oracle-dispatch.sh` | New |
| `~/.claude/oracle/bin/oracle-watchdog.sh` | New |
| `~/.claude/oracle/bin/oracle-status.sh` | New |
| `~/.claude/oracle/bin/oracle-cleanup.sh` | New |
| `~/.claude/oracle/bin/oracle-build-prompts.sh` | New |
| `~/.claude/oracle/_result-protocol.md` | New |
| `.claude/commands/agents/_base.md` | Modified |
| `.claude/commands/agents/*.md` (11 files) | Modified |
| `~/.claude/oracle-respond.sh` | Modified |
| `~/.claude/oracle-system-prompt.md` | Modified |
| `~/.claude/claude-team.sh` | Modified |
| `.claude-team.json` | New |
| `.claude/commands/algosu-oracle.md` | Modified |
