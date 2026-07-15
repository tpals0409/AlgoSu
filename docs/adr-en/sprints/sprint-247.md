---
sprint: 247
title: "AI Analysis Bug Fix + Oracle Reasoning Protocol Upgrade"
date: "2026-07-07"
status: completed
agents: [Oracle, Sensei]
related_adrs: ["sprint-246"]
related_memory: ["sprint-window", "hermes-oracle-claude-acp", "project-model-selection-strategy"]
topics: ["ai-analysis", "bugfix", "circuit-breaker", "oracle-protocol", "tooling"]
tldr: "Root cause of AI analysis failures: ANTHROPIC_API_KEY not set -> Anthropic SDK init succeeds (no key validation at init time) -> first API call throws AuthenticationError -> Circuit Breaker OPEN after 5 failures -> all subsequent requests immediately return status:failed (silent failure). Fix: fail-fast validator added to config.py so the service crashes at startup (CrashLoopBackOff) instead of starting silently broken. Also: CLAUDE_MODEL_ID env-var-ized, errorType log field added (PR #458, Critic CLEAN, pytest 346 passed / 99.11%). Oracle internal upgrades: reasoning_effort medium->high, SOUL.md Reasoning Protocol B1-B5 + Verification Gate added (49->110 lines), five agent skills updated with pre-implementation reasoning verification steps. Claude Code start/stop -> sprint-open/sprint-close command rename to resolve name collision with Hermes skills (PR #457). Key lessons: silent failures must be converted to fail-fast; Fable-5's implicit reasoning patterns can be replicated in Opus via explicit protocol; Critic completion and auto-merge notification gaps identified and addressed in SOUL.md."
---
# Sprint 247 — AI Analysis Bug Fix + Oracle Reasoning Protocol Upgrade

## Goal

- Identify and fix the root cause of AI analysis service failures.
- Strengthen Oracle's reasoning protocol so Opus reproduces Fable-5-level reasoning patterns.
- Resolve the name collision between Claude Code `/start`/`/stop` commands and Hermes skills.

## Background

- User report: the ai-analysis service repeatedly returned "AI analysis failed" responses.
- Investigation result: when `ANTHROPIC_API_KEY` is not set (or expired), the Anthropic SDK initializes successfully (no key validation at init) -> the first API call raises `AuthenticationError` -> Circuit Breaker `record_failure()` fires 5 times -> **CB is permanently OPEN** -> all subsequent requests immediately return `status: failed`. The error is logged, but no operational alert fires — a **silent failure** pattern.
- Oracle side: after the Hermes migration (Sprint 246), delays in Critic responses and missing PR merge completion notifications were identified.
- Command name collision: Claude Code `/start`/`/stop` overlapped with Hermes `algosu-lifecycle-start`/`algosu-lifecycle-stop`, causing confusion on Telegram.

## Decisions

### D1. AI Analysis — introduce fail-fast validator

- Added `ANTHROPIC_API_KEY` empty-value validation to `services/ai-analysis/src/config.py` -> raises `ValueError` at service startup (triggering a k8s CrashLoopBackOff). Before: silent failure (service starts but every analysis request fails) -> After: immediate, explicit operational signal.
- Rationale: **a silent failure must become a fail-fast failure** so operators can detect it immediately. "Loud failure" is strictly better than "quietly wrong results."

### D2. CLAUDE_MODEL_ID env-var-ized

- Hard-coded `MODEL_ID = "claude-haiku-4-5-20251001"` converted to a `CLAUDE_MODEL_ID` environment variable (default preserved). Model can now be changed without a code redeploy.
- Rationale: applying the lesson from Sprint 246's Codex model-pin finding — embedding a model ID in code means model changes cost a full redeploy cycle.

### D3. Oracle reasoning_effort raised

- `config.yaml` `reasoning_effort: medium -> high`. Fable-5 uses the highest internal reasoning budget. To achieve equivalent depth in Opus, the Hermes reasoning budget must be set to `high`.

### D4. Claude Code command rename

- `.claude/commands/start.md -> sprint-open.md`, `stop.md -> sprint-close.md`. Hermes skill `source:` metadata synchronized. 8 doc files with stale references updated.
- Rationale: `start`/`stop` are generic words that conflict with Hermes skill names, reducing clarity in Telegram slash-command discovery. `sprint-open`/`sprint-close` are unambiguous.

## Implementation

### AI Analysis Bug Fix (PR #458, Sensei)

- `services/ai-analysis/src/config.py`: `ANTHROPIC_API_KEY` empty-value validator added, `CLAUDE_MODEL_ID` env-var read added.
- `services/ai-analysis/src/claude_client.py`: `errorType` log field added — allows distinguishing `AuthenticationError` and other error types in logs.
- `services/ai-analysis/requirements.txt`: Anthropic SDK lower bound set to `0.103.0` (Dependabot adoption).
- Tests: `TestAnthropicApiKeyValidation` 4 cases added; pytest **346 passed**, coverage **99.11%**.
- Ruff: F841 unused variable removed in `test_main.py:705`; 3 test files reformatted.
- **Critic (Codex gpt-5.5) CLEAN** — "Changes are consistent with the intended fail-fast configuration behavior; the AI analysis test suite passes. No actionable regressions identified."

### Oracle Reasoning Protocol Upgrade (PR #457, Oracle self)

- `SOUL.md` 49 lines -> 110 lines: `## Reasoning Protocol` (B1-B5) + `## Verification Gate` added.
  - **B1. Observe->Hypothesize->Gather**: before complex judgments, state at least 2 hypotheses, collect evidence in parallel, synthesize as "A is correct. Evidence: ___".
  - **B2. Pre-Act Failure Scan**: before code changes or deployments, derive at least 1 failure scenario; verify if verifiable before proceeding.
  - **B3. ADR Cross-Reference**: for architecture decisions, actually open the ADR (grep first); claiming "based on ADR" without reading it is prohibited.
  - **B4. Distrust Self-Reports**: agent claim of "tsc exit 0" -> Oracle must re-run directly (locks in Sprint 246 Gatekeeper false-report lesson).
  - **B5. Acknowledge Uncertainty**: "probably"/"typically" without evidence prohibited; when uncertain, state "cannot conclude until reading file X".
  - **Verification Gate**: 5 gates required before reporting any code change (physical check, tsc, eslint, jest, docs).
- Three Tier 1 agent skills (Gatekeeper, Conductor, Librarian): `[3.5 Pre-Implementation Reasoning Check]` step inserted.
- Sensei: `[3.5 AI Analysis Reasoning Protocol]` inserted (prompt hypothesis, model suitability, output validation plan, fallback logic).
- Two lifecycle skills: step 5.5 (context synthesis bridge) and step 4.5 (pre-close consistency reasoning) inserted.
- SOUL.md: Critic completion and auto-merge notification pattern formalized (background execution + upfront "will notify on completion" declaration required).

## Verification

- pytest 346 passed, coverage 99.11% (threshold 98% exceeded) ✅
- Ruff lint + format CLEAN ✅
- CI 38 SUCCESS, 12 SKIPPED (PR #458) ✅
- Critic (Codex gpt-5.5, base `ee93b0b`) CLEAN — Critical/High/Medium: 0 ✅
- doc-refs check: 469 files, broken refs: 0 ✅
- ADR gate: index **185** (sprint-247 added), EN coverage pending.

## Lessons

1. **Silent failures must be converted to fail-fast.** Even with Circuit Breaker OPEN, if the service appears healthy, operators cannot detect the problem. Required configs must be validated at startup so that misconfiguration surfaces immediately as CrashLoopBackOff.

2. **Fable-5's implicit reasoning patterns can be enforced in Opus via explicit protocol.** `reasoning_effort: high` + SOUL.md B1-B5 formalizes the thinking flow the model does implicitly, making Opus follow the same pattern under protocol constraint.

3. **Critic completion and PR merge notifications require upfront declaration + async delivery.** Foreground Codex execution risks result loss on timeout. Going forward: run in background -> send "will notify when complete" first -> deliver result on completion.

4. **auto-merge followed by no polling leaves the user without a merge notification.** After `gh pr merge --auto`, if no status polling occurs during the CI wait, the user has no way to know when the merge completed. Going forward: poll with cron or confirm immediately after CI passes.

## Carried Over

- **Operations (required)**: verify that the `ANTHROPIC_API_KEY` SealedSecret in aether-gitops contains a valid key, then redeploy (user action, critical). Without a valid key, the pod will CrashLoopBackOff after the fix is deployed.
- GA4 Enhanced Measurement OFF (user action)
- GA4 production behavior UAT
- Server redeploy + live SEO verification
- GA4 admin data stream URL alignment
