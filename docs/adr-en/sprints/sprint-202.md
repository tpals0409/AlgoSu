---
sprint: 202
title: "Harness Routine Checkup — Cmux/Codex/Claude Code Agent Communication Polymorphism"
date: "2026-05-27"
status: completed
agents: [Oracle, Architect, Librarian, Scribe, Critic]
related_adrs: ["sprint-141", "sprint-150", "sprint-156", "sprint-191"]
related_memory: ["sprint-window", "oracle-dispatch"]
topics: ["oracle", "infrastructure", "cleanup"]
tldr: "Routine checkup of the AlgoSu agent harness (Cmux/tmux-based Oracle dispatch + Codex cross-review). Two parallel Explore agents surfaced three defects — (i) the `agents[].model` field in `.claude-team.json` is dead code (the actual SSOT is the hardcoded `get_model()` case statement at `~/.claude/oracle/bin/oracle-spawn.sh:28-33`, with Opus pinned at 4-6); (ii) Cmux.app (`/Applications/cmux.app/Contents/Resources/bin/claude` v2.1.152) sits first in the system PATH, so the Sprint 141 PATH export (`/opt/homebrew/bin` first) diverges from actual runtime behaviour; (iii) `.claude-tools/oracle-respond.sh`+`discord-receiver.py` have zero live callers. The user picked \"report + full overhaul,\" so all of it is handled in a single sprint. Phase A·B: refactor `get_model()` to jq-lookup the `.claude-team.json` SSOT (with the fallback case also bumped to opus 4-7), prepend the Cmux.app path to the runner PATH, and confirm that `oracle-auto-critic.sh:12` `CODE_CHANGING_AGENTS` ↔ `.claude-team.json` line 36 stay aligned (no change needed). Phase C: delete the three dormant files locally (`oracle-respond.sh`, `discord-receiver.py`, `discord-last-id`) — `.claude-tools/` is gitignored so the git diff is zero — and reclassify `discord-send.sh` from `live` to `dormant` (its sole caller was `oracle-respond.sh`; the BOT_TOKEN plaintext keeps simple deletion deferred to Phase 4). Out-of-repo edits (`~/.claude/oracle/bin/`) are preserved in the new RUNBOOK `docs/runbook/oracle-model-ssot.md` so other machines can replay them. Critic (Codex) Critical/High 0. Confirmed-healthy: autoCritic pipeline shows an actual fire trace (2026-05-22 `critic-task-...` log), Codex CLI 0.130.0 is available, and the Cmux Opus 4.7 compatibility dry-run passes (`claude --model claude-opus-4-7 -p \"ping\"` → `pong`)."
---
# Sprint 202 — Harness Routine Checkup — Cmux/Codex/Claude Code Agent Communication Polymorphism

## Goal

- Routine checkup of the AlgoSu agent harness (Cmux.app-bundled claude + tmux-based Oracle dispatch + Codex cross-review).
- Verify that communication polymorphism (multiple model/CLI back-ends — Claude Opus·Sonnet + Codex) behaves as intended, and remediate any defects in the same sprint.
- Persist the checkup result as an ADR so it becomes the baseline for the next routine checkup.

## Background

- Agent harness infrastructure:
  - **Cmux.app** (`/Applications/cmux.app/Contents/Resources/bin/claude` v2.1.152, the claude CLI bundled by the macOS desktop app) — first in the system PATH.
  - **tmux** 3.6a (Homebrew) — the parallel-agent spawn back-end of the Oracle dispatch pipeline (`~/.claude/oracle/bin/oracle-*.sh`, 17 scripts, Sprint 82~).
  - **Codex CLI** 0.130.0 (Homebrew) — the cross-review back-end for the Critic agent (`codex review --base main`, Sprint 116~).
  - **Claude Code (Homebrew)** — alternative back-end (`/opt/homebrew/bin/claude`), currently second in PATH and therefore unused.
- The auto-Critic chain (Sprint 117~) detects commits from code-changing agents and triggers `codex review --base <HEAD_BEFORE>` through `oracle-auto-critic.sh` (with `requireSessionId: true` enforced).
- Stability signal accumulated in memory right before the checkup: Sprint 199~201 all passed the merge gate with `codex review --base main` reporting Critical/High 0.
- Latest Claude model IDs in the environment context: `claude-opus-4-7` / `claude-sonnet-4-6` / `claude-haiku-4-5-20251001`. The `claude-opus-4-6` in `.claude-team.json` is suspected of being one generation behind → the focus of the checkup.

## Decisions

### D0. Checkup procedure — two Explore agents in parallel

- Split the checkup surface into two and run Explore in parallel: (i) Oracle dispatch lifecycle + model-polymorphism path (`oracle-spawn.sh` model-ID consumption lines + `.claude-team.json` usage); (ii) Codex integration + autoCritic pipeline liveness + dormant Discord remnants.
- After consolidating the findings, ask the user (via AskUserQuestion) to pick the scope (`report only / report + core update / report + full overhaul`) → **"report + full overhaul"** selected. Checkup ADR + defect remediation are completed in the same sprint.

### D1. Three defects — what the checkup surfaced

1. **Model-ID SSOT split (severe)** — the `agents[].model` field in `.claude-team.json` is dead code. The actual model-ID decision is made by the hardcoded case statement of `get_model()` at `~/.claude/oracle/bin/oracle-spawn.sh:28-33`. Updating the JSON alone cannot switch models. As a result, the four Opus agents (`conductor`/`gatekeeper`/`librarian`/`palette`) keep using the one-generation-behind `claude-opus-4-6`.
2. **Cmux/Homebrew claude PATH priority mismatch (medium)** — `which -a claude` shows both binaries: Cmux.app (first) + Homebrew (second). The Sprint 141 runner export PATH explicitly placed `/opt/homebrew/bin` first, but when tmux pane inherits the parent shell's PATH Cmux.app wins, while if it does not inherit Homebrew wins — runner intent diverges from runtime behaviour.
3. **Dormant Discord remnants (cleanup)** — the Phase 3 targets listed in `docs/runbook/claude-tools.md`, namely `.claude-tools/oracle-respond.sh` + `discord-receiver.py`, have zero live callers. Inactive since 2026-02-28. The exact same condition that allowed the Sprint 191 deprecation pattern (verify trigger path → delete) applies.

### D2. Confirmed-healthy — no intervention

- All 17 Oracle dispatch scripts present. Lifecycle (`init → build-prompts → create-task → dispatch → spawn → auto-critic → reap → cleanup`) is normal.
- autoCritic pipeline has an **actual fire trace** — `~/.claude/oracle/logs/critic-task-20260522-105029-34585.out` (2026-05-22 10:52:11, Codex session `019e4d60-c3a1-76c2-bcff-8acae901ceeb`). `requireSessionId: true` is enforced at runtime.
- Codex CLI 0.130.0 is available. Sprint 199~201 all used the identical pattern (`codex review --base main`) and merged with Critical/High 0.
- `oracle-auto-critic.sh:12` `CODE_CHANGING_AGENTS` ↔ `.claude-team.json` `dispatch.codeChangingAgents` (line 36) — **identical nine agents confirmed in sync** (`conductor gatekeeper librarian architect postman curator herald palette sensei`). No change needed; only a one-line ADR note.

### D3. Scope of remediation — Phases A·B·C·D

- **Phase A·B (oracle-dispatch defect remediation)**: model SSOT integration + explicit Cmux PATH priority. Out-of-repo patches are preserved in a new RUNBOOK.
- **Phase C (Discord remnant deletion)**: delete the three dormant files locally + update the RUNBOOK. `discord-send.sh` carries plaintext BOT_TOKEN, so simple deletion is held back — only the `live`→`dormant` reclassification happens now, and processing is deferred to Phase 4 (after the Discord operations direction is decided).
- **Phase D (ADR + persistence)**: write KR/EN ADRs covering the checkup result, decisions, remediation, and verification.

### D4. Cmux Opus 4.7 compatibility — pre-flight dry-run

- A2 (`.claude-team.json` opus 4-6 → 4-7) is only safe if Cmux.app v2.1.152 can call the new model ID. A single dry-run `claude --model claude-opus-4-7 -p "ping"` returned `pong` with exit 0 → compatibility OK → proceed with remediation. Had it failed, the decision tree was to keep opus at 4-6 in A2 and defer to a Cmux.app upgrade sprint.

## Implementation

### Phase A — Model SSOT integration + Opus 4.7 transition (PR #357 `0cdcd4e` chore(runbook))

#### A1. `~/.claude/oracle/bin/oracle-spawn.sh:28-45` `get_model()` jq-lookup refactor (out of repo, PR diff 0)

- The old definition (lines 28-33) was a hardcoded case. After the refactor, `get_model()` jq-looks-up `agents[].model` from `.claude-team.json`, with a fallback case for missing JSON or missing jq. The fallback opus is bumped to 4-7 in lockstep so the latest model is still selected if the JSON is broken.
- Reuses `detect_project_dir()` (lines 64-78) to determine the project path. Function definition order does not matter for bash because it is evaluated at call time (`get_model()` is invoked from inside `main()` at line 96).

#### A2. `.claude-team.json` opus 4-6 → 4-7 (4 lines, lines 10·11·12·19)

- The four Opus agents (conductor·gatekeeper·librarian·palette) get their `model` field replaced in bulk via `replace_all`. The eight Sonnet agents stay at 4-6 because that already matches the latest in the environment context.
- Verification: `jq -r '.agents[] | "\(.name)\t\(.model)"' .claude-team.json` → all four Opus at 4-7, all eight Sonnet at 4-6.

#### A3·B3. New RUNBOOK `docs/runbook/oracle-model-ssot.md` (preserves out-of-repo patches)

- Same pattern as `docs/runbook/oracle-tmux-path.md` (Sprint 141) — out-of-repo changes to `~/.claude/oracle/bin/oracle-spawn.sh` are preserved as full patch code so they can be replayed on other machines.
- Sections: Background / Prerequisites (`brew install jq`) / Patch A1 (get_model jq lookup) / Patch B1 (PATH Cmux first) / Application procedure / Verification / Rollback / Future seeds.
- §6 verification includes the procedure to extract the function definition block → source it → print the 12-agent model mapping.

### Phase B — Cmux PATH priority + autoCritic sync verification (same PR #357 commit)

#### B1. `~/.claude/oracle/bin/oracle-spawn.sh:131-134` runner PATH export Cmux first (out of repo)

- Preserve the Sprint 141 lines, add a Sprint 202 comment, and prepend the Cmux.app path as the first token in PATH:

```bash
export PATH="/Applications/cmux.app/Contents/Resources/bin:/opt/homebrew/bin:/opt/local/bin:/usr/local/bin:/usr/bin:/bin:${PATH:-}"
```

- On machines without Cmux.app the token is silently skipped because the directory does not exist → no side effect. The Sprint 141 fail-fast `command -v claude` guard is left intact.

#### B2. `~/.claude/oracle/bin/oracle-auto-critic.sh:12` CODE_CHANGING_AGENTS sync verification

- Pre-flight check: `oracle-auto-critic.sh:12`'s `CODE_CHANGING_AGENTS="conductor gatekeeper librarian architect postman curator herald palette sensei"` ↔ `.claude-team.json` line 36 `dispatch.codeChangingAgents` array — **identical nine agents confirmed in sync**. No change; a single ADR line records the result.

### Phase C — Dormant Discord remnant deletion (PR #357 `0fb4340` chore(runbook))

#### C1. `.claude-tools/` local deletion (gitignored, git diff 0)

- `rm /Users/leokim/Desktop/leo.kim/AlgoSu/.claude-tools/oracle-respond.sh`
- `rm /Users/leokim/Desktop/leo.kim/AlgoSu/.claude-tools/discord-receiver.py`
- `rm /Users/leokim/Desktop/leo.kim/AlgoSu/.claude-tools/discord-last-id` (polling-state file for discord-receiver, attached artifact)
- Because `.claude-tools/` is in `.gitignore`, `git status` shows zero changes. Other-machine sync follows the manual procedure documented in the RUNBOOK §5 history.

#### C2. `discord-send.sh` decision — deferred to Phase 4

- After C1, the sole caller (`oracle-respond.sh`) is gone and the script has zero callers. However, it embeds plaintext BOT_TOKEN, so simple deletion risks unintended token exposure / missed rotation on the next machine setup → for this sprint we only reclassify it from `live` to `dormant` and defer processing to Phase 4 (after the Discord operations direction is decided and BOT_TOKEN rotation is confirmed).

#### C3. `docs/runbook/claude-tools.md` update

- Remove the three dormant rows from the §2 table (`oracle-respond.sh`, `discord-receiver.py`, `discord-last-id`).
- Reclassify `discord-send.sh` from `live` to `dormant`, with the note "Sprint 202 caller 0 confirmed; simple deletion held back because BOT_TOKEN plaintext is still embedded."
- Add the note "send trigger absent, effectively frozen" to `discord-inbox.md` (log classification preserved).
- Add `Phase 3 (Sprint 202 ✅)` to the §4 roadmap table; redefine `Phase 4 (TBD)` as "discord-send.sh processing + BOT_TOKEN rotation."
- Append a Sprint 202 row to §5 history — deleted files, reclassification reason, and other-machine sync procedure.

### Phase D — ADR + README index

- Create `docs/adr/sprints/sprint-202.md` (this document, KR — MEMORY pattern + sprint-201 structure inherited).
- Create `docs/adr-en/sprints/sprint-202.md` (EN translation, zero Hangul residue required).
- Update `docs/adr/README.md`: retrospective sprint ADRs `(139)` → `(140)`, `Sprint 62~201` → `Sprint 62~202` (3 places total).
- `docs/adr-en/README.md` does not state a count/range → no change.

## Verification

### Static checks

- `bash -n ~/.claude/oracle/bin/oracle-spawn.sh` — syntax OK.
- `jq -r '.agents[] | "\(.name)\t\(.model)"' .claude-team.json` — four Opus at 4-7, eight Sonnet at 4-6.
- `which -a claude` — both Cmux.app and Homebrew present.

### Lifecycle / model-lookup dry-run

- Cmux Opus 4.7 compatibility: `claude --model claude-opus-4-7 -p "ping"` → `pong`, exit 0.
- Direct call of the `get_model()` function: `sed -n '17,79p' ~/.claude/oracle/bin/oracle-spawn.sh > /tmp/sp202-fns.sh; bash -c 'source /tmp/sp202-fns.sh; ...'` (R2 P2 fix — extends to 17,79 to include the closing brace of `detect_project_dir()` at line 78) → the 12-agent mapping matches the `.claude-team.json` SSOT (conductor/gatekeeper/librarian/palette → `claude-opus-4-7`, the other 8 → `claude-sonnet-4-6`). This proves the jq lookup actually reads the SSOT.

### Document gates

- `node scripts/check-adr-links.mjs` exit 0.
- `node scripts/check-doc-refs.mjs` 0 broken.
- `node scripts/check-adr-index-count.mjs --strict` → sprint 140 match.
- `node scripts/check-adr-en-coverage.mjs --lint` → 149/149.

### Critic merge gate

- `codex review --base main` (Codex) — Critical/High **0** + session ID `<to be filled at sprint close>` recorded.

### CI

- `gh pr create` → CI green (Quality·Build Blog SSG·doc-refs·check-adr-links etc.) → squash merge.

## Lessons / Patterns

- ① **"configured via JSON" is not the same as "the JSON is the SSOT" — dead-code audit is item #1 of any routine checkup** — the `model` field in `.claude-team.json` appeared in docs, self-introductions, and indexes but never actually participated in model-ID decisions. A "looks-like-SSOT" that is actually dead code only surfaces when an external change (such as a new model release) happens — "is the declared SSOT really the SSOT?" should be a standard checkup item.
- ② **Make PATH priority match the intent** — Sprint 141 only assumed the case where tmux pane fails to inherit PATH and put Homebrew first, but on the user's actual environment (with Cmux.app installed) the parent shell's PATH is inherited normally and Cmux.app wins — a contradiction. PATH should be explicit so the intended back-end stays first across every possible environment combination.
- ③ **Dormant cleanup follows the Sprint 191 deprecation pattern verbatim** — "verify trigger path → confirm zero live callers → delete → append a RUNBOOK §history row." This sprint added the variable of plaintext BOT_TOKEN, and in that case the conservative path is: defer immediate deletion, reclassify as dormant, and process in Phase 4. Files with secret-exposure risk should be processed alongside an explicit operations decision.
- ④ **Routine checkup output = remediation + ADR** — the "report only" option discovers a defect but delays remediation, which contaminates the next sprint's context. Bundling remediation with the checkup in the same sprint avoids that. The key is to present the scope options clearly to the user and let them choose.

## New patterns

- **Harness routine checkup checklist** — (i) CLI back-end availability (claude/codex/tmux + `which -a` to catch PATH conflicts); (ii) declared SSOT mapping vs code SSOT (trace the actual consumption lines of `.claude-team.json`-like config files); (iii) does the model ID match the environment's latest model (environment context vs config); (iv) dispatch lifecycle fire trace (`~/.claude/oracle/logs/` latest mtime); (v) autoCritic sync (`CODE_CHANGING_AGENTS` ↔ JSON array); (vi) live-caller verification for dormant remnants (`grep -r` repo + external bin directory) — the next routine checkup reuses this list verbatim.
- **Model SSOT integration pattern** — JSON SSOT + script function jq-lookup + fallback case (covering missing JSON / missing jq). Future model-ID updates are now completed in a single JSON location.
- **PATH-first-token explicit pattern** — when the environment uses a CLI bundled by a desktop app, the first token of the runner export PATH should explicitly be that app's path. On machines without the app the token is silently ignored, so there is no side effect.
- **Dormant processing for secret-bearing files** — dormant files containing plaintext BOT_TOKEN/API_KEY should be reclassified to dormant rather than simply deleted, with processing deferred to a follow-up phase tied to an operations decision.

## Carry-over

- **Operations carry-over: run Sprint 196 migration + redeploy** (user/operations): `npm run migration:run` on `problem_db` (jsonb migration + GIN, runbook `SET statement_timeout=0`).
- **Phase 4 — `discord-send.sh` processing** (after Discord operations direction + BOT_TOKEN rotation): pick among reactivate / delete / Secret-store migration.
- (Optional) **CI `PYTHON_VERSION` 3.12 → 3.13** bump (separate sprint).
- (Optional) **Promote the Build Blog (SSG) job to a branch-protection required check** — re-listed from Sprint 201 carry-over.
- (Optional) **github-worker/ai-analysis bootstrap smoke** — extend the Sprint 200·199 NestJS pattern to the remaining services.
- (Optional) **Add `oracle` to `commitlint` `scope-enum`** — this sprint's first attempt at `chore(oracle):` was blocked by scope-enum; revisit once oracle-domain work grows.
- (Seed) **Automate the harness routine checkup** — script the "Harness routine checkup checklist" in this ADR and consider running it every N sprints.
- Accumulated UAT (user, manual): Programmers re-submission grading / production Grafana CB dashboard in English.
