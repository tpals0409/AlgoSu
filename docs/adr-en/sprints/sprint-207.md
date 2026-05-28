---
sprint: 207
title: "oracle-spawn.sh send-keys Regression Workaround — tmux Dispatch Infrastructure Recovery"
date: "2026-05-28"
status: completed
agents: [Oracle, Scribe]
related_adrs: ["sprint-202", "sprint-206"]
related_memory: ["sprint-window"]
topics: ["infra", "dispatch", "tmux", "oracle"]
tldr: "Isolated and confirmed the root cause of the tmux dispatch instability discovered in Sprint 206 Phase F. When tmux send-keys receives a string containing a real file path as its first argument, zsh's path-processing hook absorbs the Enter keystroke. Workaround: replace send-keys with tmux respawn-pane / split-window command-argument mode. Patched oracle-spawn.sh:243-262. Verified via scribe + architect dispatch on both code paths. Dispatch infrastructure restored."
---
# Sprint 207 — oracle-spawn.sh send-keys Regression Workaround + Dispatch Infrastructure Recovery

## Goals

- Precisely isolate and apply a workaround patch for the tmux dispatch instability reported in Sprint 206 §Lesson ②.
- Verify the oracle-spawn.sh fix by confirming inbox receipt for both scribe and architect dispatches.
- Eliminate the send-keys dependency with a structural alternative to prevent Sprint 208+ dispatch regressions.

## Background

Sprint 206 Phase F first reported that after `oracle-spawn.sh architect ...` invocation, the runner command appeared in the tmux pane as typed input but Enter was never executed. Sending `tmux send-keys -t oracle:tier2 Enter` separately also had no effect. At the time, the sprint prioritized seed-stage work and Oracle used a direct fallback, but this state makes delegation of code-changing agents impossible. Sprint 207 was designated as the priority checkup sprint.

Environment: macOS 25.5.0 + tmux 3.6a + zsh 5.9. No `~/.zshrc`, no autosuggestions/syntax-highlighting installed.

## Decisions

### D0. Root Cause — Real File Path in send-keys First Argument Causes zsh Enter Absorption

An isolation matrix narrowed the reproduction condition to a single pattern: **when the string passed as the first argument to tmux send-keys contains a real, existing file path**, zsh's internal hook absorbs the Enter keystroke during path processing. Non-existent paths (`/Users/.../NONEXISTENT.sh`) and plain commands (`echo X`, `bash --version`) execute normally.

Which internal zsh hook triggers this (completion cache warm-up / path glob / glob_complete / etc.) is unresolved. Only black-box isolation was confirmed — no zsh source tracing was required.

### D1. Workaround — Remove send-keys, Adopt Command-Argument (cmd-arg) Mode

Of 7 workaround attempts, only **AG (split-window cmd-arg)** and **AH (respawn-pane cmd-arg)** succeeded:

| Attempt | Method | Result |
|---------|--------|--------|
| α split call | Two send-keys calls | ❌ |
| β sleep+C-m | sleep 0.5 then C-m | ❌ |
| ω embedded newline | `$'bash path\n'` | ❌ |
| -l literal | `send-keys -l` | ❌ |
| AC paste-buffer | paste-buffer approach | ❌ |
| **AG split-window cmd-arg** | `split-window ... "bash path"` | **✅** |
| **AH respawn-pane cmd-arg** | `respawn-pane -k -t pane "bash path"` | **✅** |

The command-argument approach has tmux directly fork the bash process without going through the zsh session, so zsh hooks do not intervene.

### D2. Applied Patch — `~/.claude/oracle/bin/oracle-spawn.sh:243-262`

Original branch:
```bash
# pane_count<=1 && idle → target=.0 → send-keys
tmux send-keys -t "$target_pane" "bash '${runner_file}'" Enter
```
```bash
# new pane needed → split-window then send-keys
tmux split-window -t "$TARGET_WINDOW" -d
tmux send-keys -t "$new_pane" "bash '${runner_file}'" Enter
```

After patch:
```bash
# pane_count<=1 && idle → respawn-pane cmd-arg (reuse .0)
tmux respawn-pane -k -t "$target_pane" "bash '${runner_file}'"
```
```bash
# new pane needed → split-window cmd-arg (send-keys fully removed)
tmux split-window -t "$TARGET_WINDOW" -d "bash '${runner_file}'"
```

All `send-keys` calls removed. The `split-window` path is simplified from 3 lines (split + pane ID capture + send-keys) to a single command.

> **Note**: `~/.claude/oracle/bin/oracle-spawn.sh` is under `~/.claude/` and is not git-tracked. The diff in this ADR §Phase D is the SSOT for this change.

### D3. Side Discovery — tier2 Window Disappears After Spawn Completes

After respawn-pane/split-window completes and the runner process exits, the tier2 window auto-destroys. This is tmux's default behavior when a window reaches 0 panes. The next dispatch may fail at the pane-count check because the window no longer exists. Adding `remain-on-exit on` or auto-recreate logic is needed, but is out of scope for this sprint. Carried over to Sprint 208.

## Implementation

### Phase A — Diagnosis and Isolation Matrix

Static analysis of `oracle-spawn.sh` identified the `tmux send-keys` call sites where the runner file path is injected into the first argument string (lines 249 and 260).

8-case isolation matrix executed sequentially to reduce reproduction to a single condition:

| Case | Enter |
|------|-------|
| `echo X` | ✅ |
| `echo 'long quoted'` | ✅ |
| `bash --version` | ✅ |
| `bash /tmp/fake.sh` (non-existent) | ✅ |
| `bash /Users/.../NONEXISTENT.sh` | ✅ |
| `bash /tmp/test-real.sh` (real file) | ❌ |
| `bash /Users/leokim/.claude/oracle/runners/scribe-task-*-run.sh` | ❌ |
| `RUNNER=/tmp/test-real.sh` (variable assignment only) | ❌ |

"Real file path included" is the decisive condition. Non-existent paths pass; real file paths fail. zsh path-processing hook intervention confirmed.

### Phase B — Workaround Attempts (Failing Series)

5 attempts using variations of send-keys:
- **α split call**: `send-keys "bash path"` + separate `send-keys "" Enter` → the second Enter is also absorbed
- **β sleep+C-m**: `sleep 0.5; send-keys -t pane "" C-m` → zsh hook persists even after sleep
- **ω embedded newline**: `\n` embedded in string → parse error or same absorption
- **-l literal**: `send-keys -l "bash path"` → literal input accepted but separate Enter still fails
- **AC paste-buffer**: `set-buffer` + `paste-buffer` → same absorption for buffer containing newline

All send-keys-based paths fail to bypass the zsh hook.

### Phase C — Working Workaround (AG + AH Adopted)

**AG (split-window cmd-arg)**: `tmux split-window -t "$TARGET_WINDOW" -d "bash '${runner_file}'"` — tmux forks bash directly. No zsh involvement. ✅

**AH (respawn-pane cmd-arg)**: `tmux respawn-pane -k -t "$target_pane" "bash '${runner_file}'"` — reuses existing pane, direct fork. ✅

Both methods fully bypass the zsh hook. AH is applied to the `.0` idle-pane-reuse branch; AG is applied to the new-split branch.

### Phase D — Apply `oracle-spawn.sh:243-262` Patch

Patched `~/.claude/oracle/bin/oracle-spawn.sh` lines 243–262:

**Before (send-keys approach)**:
```bash
if [ "$pane_count" -le 1 ] && is_pane_idle "$TARGET_WINDOW.0"; then
  target_pane="$TARGET_WINDOW.0"
  tmux send-keys -t "$target_pane" "bash '${runner_file}'" Enter
else
  tmux split-window -t "$TARGET_WINDOW" -d
  new_pane=$(tmux list-panes -t "$TARGET_WINDOW" -F '#D' | tail -1)
  tmux send-keys -t "$new_pane" "bash '${runner_file}'" Enter
fi
```

**After (cmd-arg approach)**:
```bash
if [ "$pane_count" -le 1 ] && is_pane_idle "$TARGET_WINDOW.0"; then
  target_pane="$TARGET_WINDOW.0"
  tmux respawn-pane -k -t "$target_pane" "bash '${runner_file}'"
else
  tmux split-window -t "$TARGET_WINDOW" -d "bash '${runner_file}'"
fi
```

`send-keys` calls fully removed. The `split-window` path compressed from 3 lines (split + pane ID capture + send-keys) to 1.

> **Note**: `~/.claude/oracle/bin/oracle-spawn.sh` is under `~/.claude/` and is not git-tracked. This ADR §Phase D diff is the SSOT.

### Phase E — Verification

1. `bash -n ~/.claude/oracle/bin/oracle-spawn.sh` → **SYNTAX OK** (exit 0)
2. **C2**: `oracle-spawn.sh scribe task-verify-207` → runner started → `~/.claude/oracle/inbox/scribe-task-verify-207.md` received in ~5 seconds. Content: `pong from scribe fixed-207`
3. **C3**: `oracle-spawn.sh architect task-verify-arch-207` → runner started → `~/.claude/oracle/inbox/architect-task-verify-arch-207.md` received in ~15 seconds. Content: `pong from architect verify-207`

Both tier1 (scribe, respawn-pane branch) and tier2 (architect, split-window branch) dispatch paths verified. Code-changing agent delegation path restored since Sprint 206.

## Verification

- `bash -n oracle-spawn.sh` → exit 0 (syntax clean)
- scribe dispatch C2 → inbox received in 5s (**tier1 path restored**)
- architect dispatch C3 → inbox received in 15s (**tier2 path restored**)
- `node scripts/check-adr-index-count.mjs --strict` → permanent 8 / topic 1 / sprint **145**
- `node scripts/check-adr-en-coverage.mjs --lint` → **154/154 (100%)**
- `node scripts/check-doc-refs.mjs` → 0 broken
- `node scripts/check-i18n-residue.mjs --strict` → prose Hangul max ≤8%

## Lessons

1. **Isolation matrix is sufficient to confirm black-box root cause** — Without zsh source tracing, 8 experimental cases narrowed the root cause to the single condition "real file path included in the first argument." When a reproduction condition is precise, safe workarounds can be designed without knowing the internal mechanism.
2. **send-keys routes through the shell session — inherently vulnerable to shell hooks** — tmux send-keys injects keystrokes into the target pane's shell session. zsh hooks (completion, path-processing, etc.) can intervene in unexpected ways. The command-argument (cmd-arg) approach has tmux fork the process directly, fully excluding shell hooks.
3. **Sprint 206 §Lesson ② "environment/tmux session state/Cmux.app version — multiple possibilities" converges to macOS + zsh combination** — The actual cause was neither Cmux.app version differences nor tmux configuration. zsh path-processing hooks fire regardless of tmux version. The possibilities left open in Sprint 206 were experimentally confirmed in Sprint 207.
4. **Both tiers must be verified immediately after dispatch recovery** — Verifying only tier1 (scribe) leaves the tier2 (architect, split-window branch) code path unconfirmed. C2 + C3 dual verification guarantees full branch coverage.
5. **Side discoveries should be carried over immediately** — The tier2 window disappearance is not entirely unrelated to this sprint's change (respawn-pane introduction effect), but is out of scope. Applying "discovery → explicit carryover → next sprint isolation" prevents sprint scope contamination.

## New Patterns

- **tmux dispatch cmd-arg pattern** — Use `respawn-pane -k -t pane "cmd path"` / `split-window -t win -d "cmd path"` instead of `send-keys "cmd path" Enter` so tmux forks the process directly. Shell hooks fully bypassed. Established as the standard launch pattern for oracle-spawn.sh.
- **Dispatch infrastructure isolation matrix pattern** — When shell/tmux dispatch anomalies occur, classify cases along 4 axes: "(1) simple command, (2) non-existent path, (3) real file path, (4) variable assignment only" to converge on the cause with minimal experiments. The 8-case isolation matrix from sprint-207 §Phase A is persisted as a reusable checklist for future dispatch anomaly responses.
- **tier1 + tier2 dual dispatch verification pattern** — After oracle-spawn.sh changes, verify both scribe (tier1, .0 respawn-pane path) and architect (tier2, split-window path) dispatches via actual inbox receipt. Verifying only one side leaves one of the code branches unconfirmed.

## Sprint 208+ Carryover

- **tier2 window auto-destruction mitigation (Sprint 208 priority)** — After respawn-pane/split-window runner exits, tmux auto-destroys the window when pane count reaches 0. Next dispatch may fail at pane-count check because the window no longer exists. Evaluate adding `remain-on-exit on` or auto-recreate logic (`new-window -t oracle:tier2`).
- **Harness checkup Item 2 auto-mapping comparison** — Automated comparison of `.claude-team.json agents[].model` ↔ `oracle-spawn.sh get_model()` case mappings via jq + bash (current seed only verifies agent count).
- **Harness checkup Item 3 full 12-model dry-run** — Current seed only persists the commands; future work adds actual `claude --model <ID> -p "ping"` calls for all 12 models.
- **Operations Sprint 196 migration execution + server redeploy** (user/ops).
- (Optional) Cumulative UAT (user direct): Programmers resubmission scoring / English production Grafana CB dashboard.
