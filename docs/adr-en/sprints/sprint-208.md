---
sprint: 208
title: "tier2 Window Auto-Destruction Hardening + Harness Checkup Expansion"
date: "2026-05-28"
status: completed
agents: [Oracle]
related_adrs: ["sprint-206", "sprint-207"]
related_memory: ["sprint-window"]
topics: ["infra", "dispatch", "tmux", "oracle", "harness"]
tldr: "Hardened the side effect of the Sprint 207 cmd-arg pattern (respawn-pane/split-window) where the pane terminates when the runner exits, and if it is the last pane tmux auto-destroys the window (Sprint 207 §Carryover #1). Added dual defense to oracle-spawn.sh: (C) `; exec zsh -i` at the end of the command argument to keep the pane alive + (A) window existence check and auto-recreation on spawn entry. All 5 Phase C scenarios (C1a auto-recreate, C1b respawn reuse, C2 architect, C3 herald, C4 kill recovery) returned status: success. Expanded harness-checkup.sh Item 2 auto-mapping (--show-model subcommand), Item 3 --full real invocation, and Item 4 window state check (Sprint 206 seed follow-up)."
---
# Sprint 208 — tier2 Window Auto-Destruction Hardening + Harness Checkup Expansion

## Goals

- Sprint 207 §Lesson ⑤ + §Carryover #1 — harden the side effect where, after introducing the `tmux respawn-pane`/`split-window` command-argument (cmd-arg) approach, the pane terminates when the runner exits and the window is auto-destroyed if it is the last pane.
- Restore dispatch infrastructure stability in a single-sprint effort, verifying both tier1 and tier2 paths with real dispatches.
- Expand harness checkup (Sprint 206 seed) Items 2/3/4 from seed stage to real-verification stage (Sprint 206 §Carryover).

## Background

In Sprint 207, to work around the `tmux send-keys` regression (zsh path-processing hook absorbing Enter when the first argument contains a real file path), the **cmd-arg pattern** (`respawn-pane -k "<cmd>"` / `split-window "<cmd>"`) was introduced. This approach completely excludes zsh hooks because tmux forks the process directly without going through the shell — but it has the side effect that **the pane terminates when the runner exits**. When the last pane of a window disappears, tmux auto-destroys the window (unrelated to the `destroy-unattached off` default — that option destroys a session when no client is attached).

In this sprint's Phase A first command, `tmux list-windows -t oracle` showed only `control / tier1 / tier3` with `tier2` missing — exactly the phenomenon predicted in Sprint 207 §Carryover #1.

Environment: macOS 25.5.0 + tmux 3.6a + zsh 5.9.

## Decisions

### D0. Root Cause — cmd-arg Pattern Pane Termination on Runner Exit → Window Destroy if Last Pane

Both branches of `oracle-spawn.sh` pass `bash '<runner>'` alone as the command argument:
- `.0` reuse branch: `respawn-pane -k -t "$target_pane" "bash '${runner_file}'"`
- split branch: `split-window ... "bash '${runner_file}'"`

When the runner finishes, the pane executing that command also terminates. If the tier2 window has no other pane (usually 1), the entire window is destroyed. Impact: on the next tier2 (architect/scribe/postman/curator/critic) dispatch, `tmux list-panes -t "$SESSION:$window"` fails → `pane_count=0` + `pane0_cmd=""` → enters the split branch → `split-window -t "$SESSION:$window"` also fails due to the missing window → spawn itself fails.

### D1. Fix Option Comparison

| Option | Approach | Pros | Cons | Choice |
|--------|----------|------|------|--------|
| **A** | window existence check + auto-recreation on spawn entry | explicit, easy to debug, independent of reap logic | one extra `tmux list-windows` per spawn call | ✅ (2nd defense) |
| **B** | `tmux set-window-option -g remain-on-exit on` | single-line tmux option | dead pane accumulation · subtle conflict with `panes.json` reap logic · dashboard visual noise | ❌ |
| **C** | append `; exec zsh -i` to the command argument → keep pane alive | extends the Sprint 207 cmd-arg pattern as-is, no send-keys | zsh prompt persists (an advantage when debugging) | ✅ (1st defense) |

**Decision: C primary + A reinforcement (dual defense).** C protects the normal path (clean runner exit), A protects the abnormal path (external `kill-window`·tmux fault). B is avoided — the interaction between reap logic (`panes.json` tracks only live panes) and dead panes is subtle, and dashboard noise accumulates.

### D2. Delegation Judgment — Phase D·D'·E Done by Oracle Directly

The plan matrix specified Phase D·D' (harness-checkup.sh) as Architect delegation and Phase E (ADR) as Scribe delegation. However, **Phase C demonstrated dispatch recovery 5 times** (C1a/C1b/C2/C3/C4), already satisfying the goal of Sprint 207 §Lesson ⑥ (demonstrating normal delegation after dispatch recovery). harness-checkup.sh is git-tracked + affects the CI gate, and the ADR's factual accuracy is critical (Critic review target), so the cost of spec handoff and accuracy verification under delegation exceeds that of direct authoring. Therefore D·D'·E were done by Oracle directly. The dispatch recovery demonstration is satisfied by Phase C alone.

## Implementation

### Phase A — Reproduce + Root Cause Isolation ✅

`tmux list-windows -t oracle -F '#{window_name}'` → `control / tier1 / tier3` (tier2 missing, immediately reproduced). Static analysis of the `oracle-spawn.sh` cmd-arg branches confirmed the runner exit → pane termination → window destroy (if last pane) path. No further diagnosis needed.

### Phase B1 — `; exec zsh -i` Workaround (Option C)

Appended `; exec zsh -i` to both cmd-arg branches in `~/.claude/oracle/bin/oracle-spawn.sh`.

**Before**:
```bash
if [ "$pane_count" -le 1 ] && [[ "$pane0_cmd" == "zsh" || "$pane0_cmd" == "bash" ]]; then
  target_pane="$SESSION:$window.0"
  tmux respawn-pane -k -t "$target_pane" "bash '${runner_file}'"
else
  target_pane=$(tmux split-window -t "$SESSION:$window" -h -P -F '...' "bash '${runner_file}'")
fi
```

**After**:
```bash
if [ "$pane_count" -le 1 ] && [[ "$pane0_cmd" == "zsh" || "$pane0_cmd" == "bash" ]]; then
  target_pane="$SESSION:$window.0"
  tmux respawn-pane -k -t "$target_pane" "bash '${runner_file}'; exec zsh -i"
else
  target_pane=$(tmux split-window -t "$SESSION:$window" -h -P -F '...' "bash '${runner_file}'; exec zsh -i")
fi
```

Rationale: the tmux shell-command (`/bin/sh -c "..."`) runs `bash <runner>` then `; exec zsh -i` next → after the runner exits cleanly (including full cleanup trap execution), it falls back to an interactive zsh → pane kept alive → window preserved. On the next dispatch, the `.0` pane's `pane_current_command == "zsh"`, so the respawn-pane -k reuse branch works normally.

### Phase B2 — Window Existence Check + Auto-Recreation (Option A)

Added right after `acquire_spawn_lock` and before `pane_count` extraction:

```bash
if ! tmux list-windows -t "$SESSION" -F '#{window_name}' 2>/dev/null | grep -qFx "$window"; then
  log "window missing — auto-recreating: $SESSION:$window"
  tmux new-window -t "$SESSION" -n "$window"
  tmux select-pane -t "$SESSION:$window.0" -T "${window} (empty)"
fi
```

Rationale: `grep -qFx` for exact string match (avoids partial matching — distinguishes `tier1` from `tier1x`). A new window starts with the `.0` pane as zsh → enters the existing `.0` reuse branch naturally. `_lib.sh acquire_spawn_lock` serializes the entire spawn section, blocking concurrent-call races.

### Phase D' (oracle-spawn.sh) — `--show-model` Non-Destructive Subcommand

Added a branch at the top of `main()`:
```bash
if [[ "${1:-}" == "--show-model" ]]; then
  shift
  get_model "${1:?agent name required (e.g. architect)}"
  exit 0
fi
```

Rationale: branches before entering the normal spawn flow (lock creation·tmux calls·runner creation). `bash oracle-spawn.sh --show-model <agent>` → `get_model()` output only (including `.claude-team.json` jq fallback). Zero side effects. harness-checkup.sh Item 2 calls it safely.

> **Note**: `~/.claude/oracle/bin/oracle-spawn.sh` is an operational file under `~/.claude/`, not git-tracked. The change content's SSOT is the §Phase B1·B2·D' diff in this ADR.

### Phase D (harness-checkup.sh) — Item 4 Window State Check

In `scripts/harness-checkup.sh` `check_item_4_dispatch_traces()`, kept the existing 7-day dispatch log count and added a tmux oracle window state check:
```bash
if ! tmux has-session -t oracle 2>/dev/null; then
  report_warn "Item 4 — oracle session absent (oracle-init.sh not run or terminated, normal in CI)"
  return
fi
local missing_windows="" w
for w in control tier1 tier2 tier3; do
  if ! tmux list-windows -t oracle -F '#{window_name}' 2>/dev/null | grep -qFx "$w"; then
    missing_windows="${missing_windows}${w} "
  fi
done
[[ -n "$missing_windows" ]] && report_fail "Item 4 — oracle window missing: ${missing_windows}..." || report_pass "Item 4 — oracle session + 4 windows OK"
```

In a CI environment (oracle session absent), it is handled as `report_warn` to avoid FAIL → CI stays green.

### Phase D' (harness-checkup.sh) — Item 2 Auto-Mapping + Item 3 --full Real Invocation

**Item 2**: full auto-comparison of `.claude-team.json agents[].model` ↔ `oracle-spawn.sh --show-model <agent>` across all 12 agents. On mismatch, displays which SSOT is stale in `team=X,spawn=Y` form.

**Item 3**: with the `--full` flag, real invocation of `claude --model <ID> -p "ping"` against the `.claude-team.json` unique model list (`jq -r '.agents[].model' | sort -u`). Default is command persistence only (avoids per-checkup API call cost). Added `--full` flag parsing to `main()`.

### Phase E — ADR + README + RUNBOOK

This ADR (KR+EN) + `docs/adr/README.md` count 145→146·range 62~207→62~208 + `docs/runbook/harness-checkup.md` §1 `--full` description·§2 Item 2·3·4 updates·§5 Sprint 208 history.

## Verification

### Phase C — 5 Dispatch Scenarios (all status: success)

| Scenario | Path | inbox arrival | window | Result |
|----------|------|---------------|--------|--------|
| **C1a** scribe (tier2) | window missing → **B2 auto-recreate** → spawn | ~5s | tier2 restored | status: success |
| **C1b** scribe (tier2) | `.0` pane `zsh` confirmed → **B1 respawn-pane reuse** | ~5s | tier2 kept | status: success |
| **C2** architect (tier2) | `.0` respawn-pane reuse | ~5s | tier2 kept | status: success |
| **C3** herald (tier3) | tier3 `.0` reuse | ~5s | tier3 kept | status: success |
| **C4** architect (tier2) | after `kill-window -t oracle:tier2` → **B2 auto-recreate log** → spawn | ~5s | tier2 restored | status: success |

After each dispatch, `panes.json` reaped to the empty object `{}` normally. In C1b, `tmux display-message -t oracle:tier2.0 -p '#{pane_current_command}'` → `zsh` confirmed (demonstrating B1 `exec zsh -i` effect). In C4, the `[spawn] window missing — auto-recreating: oracle:tier2` log was output (demonstrating B2 effect).

### Gates

- `bash -n ~/.claude/oracle/bin/oracle-spawn.sh` → exit 0 (syntax)
- `bash oracle-spawn.sh --show-model architect` → `claude-sonnet-4-6` / `--show-model conductor` → `claude-opus-4-7` (mapping correct)
- `bash scripts/harness-checkup.sh` → PASS=6 / WARN=1 / FAIL=0 (Item 2 mapping consistent + Item 4 4 windows OK)
- `bash scripts/harness-checkup.sh --full` → Item 3 both 2 unique models respond to ping
- `node scripts/check-adr-index-count.mjs --strict` → permanent 8 / topic 1 / sprint **146**
- `node scripts/check-adr-en-coverage.mjs --lint` → **155/155 (100%)**
- `node scripts/check-doc-refs.mjs` → 0 broken
- `node scripts/check-i18n-residue.mjs --strict` → prose Hangul max ≤8%

## Critic (Codex)

- **R1** (`codex review --base 95b5e3a`, non-interactive — session ID not emitted) — **1 P2 found → resolved**
  - Finding: `scripts/harness-checkup.sh:103` Item 2 depends on the git-external `oracle-spawn.sh`'s `--show-model` subcommand. On another machine/CI with a pre-Sprint-208 oracle-spawn.sh, `--show-model` is treated as a normal spawn argument and returns empty output/exit 1 → all 12 agents falsely reported as mismatch → `harness-checkup.sh` FAILs.
  - Resolution: added feature-detect — probe with a known agent (architect); if the result is not in model-ID form (`^claude-`), skip the mapping comparison and degrade to count-only PASS. The new version proceeds with the mapping comparison; old version/missing file degrades safely. Critical/High **0**, 1 P2 resolved.
- **Compliance with the Critic placeholder regression-blocking decision** — persist up to R1 in this §Critic section; R{N≥2} (post-resolution CLEAN re-confirmation) recorded only in sprint-window/memory.
- **Among this sprint's code changes, `~/.claude/oracle/bin/oracle-spawn.sh` (git-external) is not in the codex diff**. The git-tracked changes are `scripts/harness-checkup.sh` (Item 2·3·4 + `--full`) + ADR + README + RUNBOOK. The SSOT for the oracle-spawn.sh change is the §Phase B1·B2·D' diff in this ADR, so codex performs fact verification based on the ADR content.

## Lessons

1. **N+1 sprint closure of a predicted side discovery** — the tier2 window auto-destruction noted in Sprint 207 §Lesson ⑤ (immediate carryover of side discoveries) was reproduced in this sprint's Phase A first command and hardened immediately. A complete instance of the "discover → declare carryover → close in next sprint" pattern. Writing reproduction commands and the expected cause into the carryover item makes N+1 sprint startup immediate.
2. **Role separation of dual defense** — C (`exec zsh -i`) handles the normal path (clean runner exit), A (window auto-recreation) handles the abnormal path (external kill·fault). One alone covers only one path — C alone cannot recover from external kill-window, A alone incurs window-creation cost on every dispatch. When two defenses cover orthogonal paths, 100% recovery is possible in a single sprint.
3. **Dispatch verification substitutes for delegation demonstration** — the plan tried to demonstrate dispatch recovery via delegating Phase D·E, but Phase C's 5 dispatches were already sufficient demonstration. The dispatch calls that occur naturally during verification are a stronger signal than a separate delegation demonstration. For accuracy-first work (code·ADR), delegation's cost-benefit is worth reconsidering.
4. **Non-destructive subcommand for SSOT cross-verification** — `oracle-spawn.sh --show-model` branches before the spawn flow (lock·tmux·runner) and returns only the `get_model()` output with zero side effects. To let an external script safely call an SSOT function's output, providing a non-destructive entry point isolated from the body logic is cleanest (avoids hardcoded mapping-table duplication).
5. **Opt-in costly verification via --full flag** — Item 3's 4 real LLM pings are a burden on every checkup run. Opting in with `--full` separates it from the default run (command persistence), so routine checkups are free and real calls happen only at sprint close / model retirement checks. A pattern of not forcing costly verification onto the gate and turning it on only when needed.

## New Patterns

- **cmd-arg pattern pane-keep hardening** — append `; exec zsh -i` to the end of `respawn-pane`/`split-window` command arguments to fall back to an interactive shell after the runner exits → preserve pane·window. Compatible with the Sprint 207 cmd-arg pattern (zsh hook bypass) and the standard hardening that blocks window auto-destruction.
- **spawn-entry window self-recovery** — at spawn start, confirm the target window exists with `tmux list-windows | grep -qFx "$window"` and auto-recreate with `new-window` if absent. Self-recovery of dispatch infrastructure against external kill·tmux fault.
- **non-destructive subcommand SSOT cross-verification pattern** — when verifying an SSOT-defining function (`get_model()`) externally, provide a non-destructive subcommand (`--show-model`) that does not enter the body flow, exposing output only. Maintains a single SSOT without mapping-table duplication.
- **--full opt-in pattern for costly verification** — separate costly verification items, such as real API calls, behind a `--full` flag, excluding them from the default run. Free in routine, opt-in when needed.

## Sprint 209+ Carryover

- **Operational Sprint 196 migration execution + server redeploy** (user/ops) — problem_db jsonb conversion + GIN index.
- **Accumulated UAT** (user-direct) — Programmers resubmission grading / English production Grafana CB dashboard.
- **Harness checkup `--full` mode CI integration review** (optional) — whether to add `--full` execution to the regular sprint-close gate. Compare the cost of 4 API calls vs the value of early model-ID retirement detection.
