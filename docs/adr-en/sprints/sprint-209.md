---
sprint: 209
title: "Harness Checkup --full CI Integration Decision + Item 5/6 Hardening"
date: "2026-05-28"
status: completed
agents: [Oracle]
related_adrs: ["sprint-206", "sprint-208"]
related_memory: ["sprint-window"]
topics: ["ci", "oracle", "harness", "runbook"]
tldr: "Sprint 208 §Carryover — operational maturity stage for the harness checkup seed assets (Sprint 206~208). (1) Decided whether to integrate --full (real LLM ping) into CI: CI runs on a GitHub-hosted ubuntu-latest fresh clone with no ~/.claude/oracle infrastructure, no claude/codex/tmux CLI, and no API key → running --full directly as a CI gate produces noise → decided to keep it local sprint-close only (not integrated as a CI gate). Instead, tests/ci/harness-checkup-test.sh verifies only the script logic regression in a CI-portable way (added a source guard) + /stop non-blocking reminder + RUNBOOK §3 cadence documentation. (2) Expanded Item 5 autoCritic sync from 2-way to 3-way (+_base.md §Auto Critic Review; 2-way degrade WARN when the git-external oracle-auto-critic.sh is absent). (3) Hardened Item 6 dormant verification (.claude-tools/ git-tracked residue 0 + claude-tools.md §4 cleanup roadmap deletion-Phase ✅ check)."
---
# Sprint 209 — Harness Checkup --full CI Integration Decision + Item 5/6 Hardening

## Goals

- Sprint 208 §Carryover — decide whether to integrate the harness checkup `--full` run into the regular sprint-close gate (API call cost vs. value of early model-ID retirement detection).
- Harden Item 5 (autoCritic sync) / Item 6 (dormant residue) verification from the seed stage.
- Elevate the Sprint 206~208 harness checkup seed assets to the operational maturity stage.

## Background

The harness checkup was seeded as a 6-item script in Sprint 206 (`scripts/harness-checkup.sh`), and Sprint 208 expanded Item 2 (auto-mapping), Item 3 (`--full` real invocation), and Item 4 (window state) into real-verification stage. The remaining seed assets are Item 5 (2-way comparison) and Item 6 (keyword grep only), and the operational placement of `--full` (whether to integrate into CI) remained as Sprint 208 §Carryover.

`--full` invokes a real `claude --model <ID> -p "ping"` against the unique models in `.claude-team.json` to detect model-ID retirement early (model deprecation due to Cmux.app updates). This invocation depends on the claude CLI + API key + `~/.claude/oracle/` infrastructure.

## Decisions

### D0. `--full` CI Integration — Local Only (Not Integrated as a CI Gate)

AlgoSu CI runs on a GitHub-hosted `ubuntu-latest` **fresh clone**. In this environment:
- `claude`/`codex`/`tmux` CLI absent → Item 1 FAIL
- `~/.claude/oracle/` (git-external) absent → Item 2 degrade, Item 4 WARN, Item 5 degrade
- API key absent → Item 3 `--full` ping impossible

Therefore, running `harness-checkup.sh --full` (or even the base run) directly as a CI gate becomes mostly WARN/FAIL noise. **Decision: keep `--full` for local sprint-close / immediately-after-Cmux.app-update use only, and do not integrate it as a CI gate.** Instead, verify only the script **logic regression** in a CI-portable way.

### D1. Integration Approach Comparison

| Option | Approach | Pros | Cons | Choice |
|--------|----------|------|------|--------|
| **A** | Add `--full` as a CI job | CI auto-detects model retirement | All WARN/FAIL noise due to absent oracle infra/API key; security burden of exposing API key to CI | ❌ |
| **B** | CI unit test verifying only script logic | No API/infra needed, blocks regression, reuses existing `quality-ci-scripts` pattern | Cannot detect model retirement itself (logic only) | ✅ |
| **C** | `/stop` non-blocking reminder (local opt-in) | Prompts a run at each sprint close, non-blocking | No enforcement (user may skip) | ✅ (complement) |
| **D** | RUNBOOK §3 cadence documentation only | Lightest | No automation | ✅ (base) |

**Decision: B + C + D combination.** B (CI unit test) blocks logic regression, C (`/stop` reminder) prompts a local `--full` run at each sprint close, and D (RUNBOOK cadence) documents the recommended cycle. A is avoided — exposing an API key to CI + noise.

### D2. Delegation Judgment — Oracle Direct

The plan matrix specified delegation to Architect (harness-checkup.sh/ci.yml) and Scribe (ADR/RUNBOOK/stop.md). However:
1. **`stop.md` is a `.claude/commands/` skill file** — by `_base.md:10`, only Oracle has modify permission; Scribe delegation is not allowed.
2. **harness-checkup.sh is git-tracked + affects the CI gate**, and the ADR's factual accuracy is critical (subject to Critic verification) — Sprint 208 §D2 precedent (for accuracy-priority work, direct authoring is more efficient than delegation).

Therefore this sprint was executed Oracle-direct + Critic (Codex) cross-review just before merge. Although Sprint 207~208 demonstrated dispatch recovery, so delegation capability itself is secured, direct execution is more efficient given the nature of this sprint's work.

## Implementation

### Phase A1 — Persist `--full` Local-Only Decision

Persisted the D0·D1 decision in the ADR (this document) + `docs/runbook/harness-checkup.md §3`. Split RUNBOOK §3 into "base run" and "`--full` run", explicitly stating that `--full` is local-only and not integrated as a CI gate.

### Phase A2 — CI Unit Test + Source Guard

Added a source guard at the end of `scripts/harness-checkup.sh`:
```bash
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
```
This calls `main` only on direct execution and allows tests to load functions only via `source`.

New `tests/ci/harness-checkup-test.sh` (17 cases) — inheriting the existing `tests/ci/*.sh` pure-bash pattern:
- Case 1: `--dry-run` exit 0 + 6-item output smoke
- Case 2: source guard — `main` not run on `source` (functions only)
- Case 3: Item 5 tracked SSOT (json ↔ _base.md) alignment + independent invariant re-check
- Case 4: Item 5 degrade — WARN (not FAIL) when `oracle-auto-critic.sh` absent
- Case 5: Item 6 portable (no FAIL across dormant/tracked/roadmap)
- Case 6: dormant keyword git grep invariant 0

No API/`~/.claude/oracle/` needed — CI portable. Verifying the degrade path is the key (passes even when oracle infra is absent).

### Phase A3 — ci.yml Step + Filter Reinforcement

`.github/workflows/ci.yml`:
- Added a step to the `quality-ci-scripts` job: `bash tests/ci/harness-checkup-test.sh`
- Added `scripts/harness-checkup.sh` to the `ci-scripts` filter of `detect-changes` — so the test triggers even on script-only changes (the existing `tests/ci/**` is already included).

### Phase A4 — stop.md Non-Blocking Reminder

Added a non-blocking recommendation note in step 1 of `.claude/commands/stop.md` — run `scripts/harness-checkup.sh --full` once at sprint close to detect model-ID retirement early. Noted that it degrades in environments without an oracle session/CLI.

### Phase A5 — RUNBOOK §3 Cadence Documentation

Split `docs/runbook/harness-checkup.md §3` into "base run" (no API) and "`--full` run" (API cost). `--full` is recommended once at sprint close + once immediately after a Cmux.app update, and explicitly **local-only (not integrated as a CI gate)**. Added the CI test command to §1.

### Phase B — Item 5 autoCritic Sync 3-way

Expanded the existing 2-way (`json codeChangingAgents` ↔ `oracle-auto-critic.sh CODE_CHANGING_AGENTS`) to **3-way** — additionally parsing the 9-agent list inside the "code-changing agents(...)" parentheses of `_base.md §Auto Critic Review`.

Comparison order:
1. The 2 tracked SSOTs (`.claude-team.json` ↔ `_base.md`) are always compared — portable including CI/other machines. FAIL on mismatch.
2. When the git-external `oracle-auto-critic.sh` is absent, **2-way degrade WARN** (inheriting the Sprint 208 Item 2 degrade pattern). When present, 3-way alignment PASS.

The 3 SSOT lists are normalized via the common helper `normalize_agent_list` (whitespace/comma → sorted single line) for DRY handling.

### Phase C — Item 6 Dormant Verification Hardening

Added 2 sub-checks to the existing git-grep keyword 0 verification:
- **(2) `.claude-tools/` git-tracked residue 0** — `git ls-files .claude-tools/`. Per the gitignore policy it must be untracked (`claude-tools.md §1`). WARN on violation.
- **(3) `claude-tools.md §4 cleanup roadmap` progress check** — `awk` detects **deletion-work Phase rows missing ✅** in the §4~§5 table. WARN when an incomplete cleanup Phase remains. The documentation phase (Phase 1) is naturally excluded since it contains no "deletion".

### Phase E — ADR + README + RUNBOOK

This ADR (KR+EN) + `docs/adr/README.md`·`docs/adr-en/README.md` count 146→147·range 62~208→62~209 + `docs/runbook/harness-checkup.md` §1/§2/§3/§4/§5 updates.

## Verification

### Gates

- `bash -n scripts/harness-checkup.sh` → exit 0 / `bash -n tests/ci/harness-checkup-test.sh` → exit 0
- `bash scripts/harness-checkup.sh` → PASS=8 / WARN=1 / FAIL=0 (Item 5 3-way alignment + Item 6 3 sub-checks PASS)
- `bash tests/ci/harness-checkup-test.sh` → **17/17 PASS** (including degrade, source guard, invariant)
- Item 5 degrade simulation (`ORACLE_BIN` → nonexistent path) → 2-way degrade WARN (not FAIL)
- dormant grep self-match regression 0 (new test file does not hit the Item 6 grep)
- `node scripts/check-adr-index-count.mjs --strict` → permanent 8 / topic 1 / sprint **147**
- `node scripts/check-adr-en-coverage.mjs --lint` → **156/156 (100%)**
- `node scripts/check-doc-refs.mjs` → 0 broken
- `node scripts/check-i18n-residue.mjs --strict` → prose Hangul max ≤8%

## Critic (Codex)

- (Persist the result of `codex review --base 24f4b55` performed just before merge. Honoring the Critic placeholder regression-prevention decision — persist up to R1 in this §Critic, record R{N≥2} only in sprint-window/memory.)

## Lessons

1. **A "decision not to integrate" is also worth persisting** — the `--full` non-CI-integration decision is not "doing nothing" but an active decision grounded in environment constraints (absent oracle infra/API key). Documenting the rationale in ADR §D0·D1 + RUNBOOK §3 avoids re-examining "why isn't --full in CI?" in a future sprint. NOT-to decisions must be persisted with rationale to prevent repeated cost.
2. **Tracked-first degrade for git-external dependencies secures CI portability** — Item 5 first compares the 2 tracked SSOTs (json↔_base.md, always possible) and degrades to 2-way WARN when the git-external `oracle-auto-critic.sh` is absent. Inherits the Sprint 208 Item 2 degrade pattern. Performing meaningful verification with tracked assets first and separating git-external as auxiliary verification lets a single script cover CI/other-machines/local.
3. **A one-line source guard turns a seed script into a CI logic-regression test** — the `[[ "${BASH_SOURCE[0]}" == "${0}" ]] && main "$@"` guard lets tests call functions in isolation. Even a seed-stage script becomes function-level regression-testable beyond black-box (dry-run) once a source guard is added. Items with heavy cost/infra dependence (like `--full`) are excluded from CI but their degrade path is pinned by tests.
4. **Roadmap progress checks naturally filter by semantic markers** — forcing ✅ on every Phase row in the §4 cleanup roadmap would false-positive the documentation phase (Phase 1, no ✅). The rule "force ✅ only on 'deletion'-work Phase rows" checks only meaningful cleanup phases → naturally excludes documentation phases. Semantic filtering (instead of hardcoding Phase-number exclusions) is robust to future row additions.

## New Patterns

- **"NOT-to decision" ADR persistence pattern** — a decision to "not do X" is also persisted in the ADR/RUNBOOK with environment constraints and rationale. Blocks the repeated cost of re-examination in the next sprint. The decision-version of the Sprint 205 infinite-carryover-prevention documentation pattern.
- **Tracked-first degrade pattern for git-external dependencies** — when verification targets are a mix of tracked + git-external, perform meaningful verification with tracked assets first and degrade (WARN) on git-external absence. A single script covers CI/other-machines/local. Generalized from Sprint 208 Item 2 (oracle-spawn.sh feature-detect degrade) → Sprint 209 Item 5 (oracle-auto-critic.sh absence degrade).
- **Source guard turns a seed script into a CI logic-regression test** — the `[[ "${BASH_SOURCE[0]}" == "${0}" ]] && main "$@"` guard + `tests/ci/*-test.sh` (function source calls) verify a seed script's function-level regression in a CI-portable way. Items with cost/infra dependence (`--full`) are excluded but their degrade path is pinned by tests.
- **Roadmap progress check by semantic marker** — when auto-checking a roadmap table's progress state, do not force a completion marker on every row; filter the check target semantically by work-type marker (e.g., "deletion"). Avoids documentation/specification-phase false positives + robust to future row additions.

## Sprint 210+ Carryover

- **Operational Sprint 196 migration execution + server redeploy** (user/operations) — problem_db jsonb transition + GIN index.
- **Accumulated UAT** (user-direct) — Programmers re-submission grading / English production Grafana CB dashboard.
