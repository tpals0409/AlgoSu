---
sprint: 246
title: "Migrating AlgoSu Ops & Dev Process to the Hermes Agent System (Phase 1)"
date: "2026-06-22"
status: completed
agents: [Oracle, Sensei, Gatekeeper, Critic]
related_adrs: ["sprint-244"]
related_memory: ["sprint-window", "oracle-dispatch", "hermes-oracle-claude-acp"]
topics: ["orchestration", "hermes-agent", "migration", "tooling"]
tldr: "Phase 1 of migrating AlgoSu orchestration (Oracle + 12 agents) from Claude Code tmux dispatch to the Hermes Agent native path (skill + delegate_task + Oracle-direct codex + memory). Seven decisions agreed with the user: (1) full replacement (retire tmux); (2) concurrency max_concurrent_children 3->6, keep depth 1, redesign auto-critic as an Oracle sequential call; (3) twelve individual skills; (4) Critic runs as an Oracle-direct codex review (zero self-report risk); (5) lifecycle keeps only the procedure as a skill and invokes the verified scripts/*.mjs as-is (hybrid); (6) drop inbox -> delegate return, keep MEMORY.md as the source of truth + a Hermes memory index mirror; (7) spike first, then promote to a formal sprint. Two spike cycles proved it out: Sensei (read-only analysis quality passed) and Gatekeeper (full cycle: jwt.middleware.ts two log calls converted to 2-arg structured logging 7bb885a -> Oracle-direct verification diff/tsc/eslint/jest 18/18 -> Oracle-direct codex review CLEAN). Key finding: the default Codex models gpt-5.3-codex and gpt-5.5-codex are unsupported on the ChatGPT account (400); only gpt-5.5 (no suffix) works -> pin -c model=gpt-5.5 into the critic procedure (resolves the carried-over 'Codex model pin' memory item). Phase 1 deliverables: 12 persona skills (algosu-agent-*), algosu-agent-critic (codex pin), /start /stop lifecycle skills, max_concurrent_children 3->6, Hermes memory mirror. Most deliverables live in the ~/.hermes/ profile, outside repo git; the only repo change is spike commit 7bb885a plus this ADR. Phases 2-4 (production validation, live lifecycle runs, .claude/commands thin-shim) carried over."
---
# Sprint 246 — Migrating AlgoSu Ops & Dev Process to the Hermes Agent System (Phase 1)

## Goal

- Migrate AlgoSu's orchestration foundation (single Oracle command + 12 specialist agents) from the Claude Code-based **tmux dispatch** (`oracle-*.sh`, `inbox/*.md`, `oracle-auto-critic.sh`) to the **Hermes Agent native path** (Hermes skill + `delegate_task` + Oracle-direct `codex review` + Hermes memory).
- This is **Phase 1** — persona skill conversion + foundational infra + spike validation. Full production migration, live lifecycle runs, and `.claude/commands` cleanup are split into Phases 2-4 (a multi-sprint roadmap).
- Reduce risk via **spike first -> validate -> formal migration** rather than wholesale replacement.

## Background

- Existing system: tmux spawns the 12 agents with **unlimited parallelism + chaining + nested auto-critic (depth 2)**. Results return as `inbox/{agent}-{task}.md` files; sprint memory's source of truth is the `MEMORY.md` + `memory/*.md` files.
- For this profile, Hermes `delegate_task` is constrained to **3 concurrent / spawn depth 1** -> a 1:1 port would break parallel scale and nesting. So "what moves to native vs. what stays" had to be made explicit as decisions.
- Key insight: tmux nesting (auto-critic) existed only because "an agent calls another agent." In Hermes, **Oracle itself is the main orchestrator**, so flattening it to "two sequential Oracle calls after the work" reproduces the same result losslessly at `depth 1`.

## Decisions

### D1. Migration mode — full replacement (user)
- Retire tmux dispatch; move all agent execution onto Hermes `delegate_task`. Custom shell glue (`oracle-dispatch/reap/auto-critic.sh`) and `inbox` file returns become removal targets.

### D2. Concurrency/nesting constraint — raise config (option 2)
- `delegation.max_concurrent_children: 3 -> 6` (restore parallel width, covers nearly all real usage), keep `max_spawn_depth: 1`.
- Redesign auto-critic from an "agent commit hook (nested)" into an **Oracle post-work sequential routine** -> nesting unnecessary. Allowing depth 2 (option 3) was rejected for higher token cost, accumulating unverified self-reports, and conflict with the Oracle single-command principle.

### D3. Persona conversion — 12 individual skills
- Port each of the 12 agent personas (`.claude/commands/agents/*.md`) to an independent Hermes native skill (`algosu-agent-{name}`). Inject the relevant skill as context on each `delegate_task`.
- What was exposed as `agents:*` was a Claude Code ACP bridge **prompt-only slash command** (not wired to orchestration), so formal skill conversion was required.

### D4. Critic execution — Oracle-direct codex review (option A)
- Critic is a verification gate, so instead of going through a sub-agent (trusting self-reports), **Oracle directly** runs `codex review --commit <SHA>` (or `--base`) and judges the raw output. 1:1 alignment with the "review only the diff" logic of `oracle-auto-critic.sh`, zero self-report risk.

### D5. Lifecycle conversion — hybrid (option B)
- Only the **procedure (step definitions)** of `/start` `/stop` become Hermes skills; the **actual work** (ADR generation, `translate-adr.mjs` auto-translation, sliding-window update, 4-file consistency check) **invokes the verified existing `scripts/*.mjs` as-is**. Do not rewrite deterministic node logic as model prose (prevents drift/regression).
- Rationale: the value of the Hermes move is **orchestration/interface/runtime integration**, not prose-ification of deterministic build scripts. The `.mjs` live in `scripts/` (repo), orthogonal to removing the `.claude` SSOT (Phase 4).

### D6. Result return/memory — drop inbox + keep MEMORY as source of truth (option B)
- The `inbox/{agent}-{task}.md` file return is tmux async-structure glue -> drop it, replaced by `delegate_task` return summaries.
- Sprint memory keeps `MEMORY.md` + `memory/*.md` as **the source of truth** (a domain asset directly referenced by ADR generation, blog conversion, and the `/stop` 4-file consistency check). The Hermes profile memory holds **only a quick-recall summary index mirror** (explicitly not the source of truth).

### D7. Execution unit — spike first, then formal migration
- To validate the unverified areas of a first native transition (persona-injected delegation quality, Oracle-sequential critic) as cheaply as possible, run 2 spike cycles first -> on validation, promote to a formal sprint (plan A: the spike branch becomes the formal starting point).

## Implementation

### Spike validation (2 cycles)
- **Sensei (read-only)**: validate persona injection -> delegation -> structured report quality. Cross-checked `ai-analysis/src/circuit_breaker.py` against the cockatiel CB spec (`config.py:37-39`), found a real issue (`can_execute()` is 42 lines = violates the 20-line rule; the callback re-entry outside the lock needs documentation). Report format, line citations, and no-speculation all passed.
- **Gatekeeper (full cycle)**: converted two interpolated-string log calls in `services/gateway/src/.../jwt.middleware.ts` to 2-arg structured logging (`7bb885a`, +2/-2, aligned with the S241/242 logging direction). Oracle-direct verification (diff clean, zero type errors in that file, eslint exit 0, jest 18/18) -> **Oracle-direct `codex review --commit 7bb885a` -> CLEAN** (0 P0/P1, proving decision 4). One self-report inaccuracy (the agent claimed "tsc exit 0" but the real exit 2 was a pre-existing `tsconfig.json:12` baseUrl deprecation, harmless to the changed file) was caught by Oracle-direct verification -> proving decision 6's value.

### Foundational infra
- `delegation.max_concurrent_children: 3 -> 6` (decision 2), keep `max_spawn_depth: 1`.
- New `algosu-agent-critic` skill — Oracle-direct call procedure + Codex `-c model="gpt-5.5"` pin (reflecting the key finding).
- `/start` `/stop` -> `algosu-lifecycle-start` `algosu-lifecycle-stop` skills (decision 5, **invoke only** `translate-adr.mjs` / `check-adr-en-coverage.mjs`).
- Mirror the sprint index + decisions + Codex pin into the Hermes profile memory (decision 6, explicitly not the source of truth).

### 12 persona skills
- Created `algosu-agent-{conductor,gatekeeper,librarian,architect,scribe,postman,curator,critic,herald,palette,scout,sensei}`. Echelon tier/model mapping consistent (Tier1 opus 3 · Tier2 sonnet 4 + critic codex · Tier3 sonnet 3 + palette opus exception). 9 were ported via parallel delegation on the new `width-6` concurrency (= dogfooding the migration itself).

### ⚠️ Key finding — Codex model pin required
- Default model `gpt-5.3-codex` -> unsupported on the ChatGPT account (400), `gpt-5.5-codex` -> likewise unsupported, **`gpt-5.5` (no suffix) -> works**. Root cause: no top-level `model` set in codex `config.toml`. The critic call must pin `-c model="gpt-5.5"`. Exactly matches the accumulated memory carry-over "Codex model pin" -> resolved.

## Verification

- Spike commit `7bb885a`: diff +2/-2 clean (no other changes), zero type errors in `jwt.middleware.ts`, eslint exit 0, jest 18/18 pass — re-run directly by Oracle.
- **Critic (Codex `gpt-5.5`) CLEAN** — "merely converted two JWT middleware log calls to structured logger arguments; compatible with StructuredLoggerService behavior; no functional regression."
- Full check of the 12 skills: existence, frontmatter tier/model consistency, zero dispatch-glue leakage (the 1 critic match is an intentional contrast phrasing), zero plaintext secrets, format consistency.
- The 2 lifecycle skills: registration, frontmatter consistency, verification-script invocation lines preserved (zero logic rewrite), mirror block reflected.

## Lessons

1. **tmux nesting is not "lost" in Hermes — it is a flattening target.** Auto-critic was nested purely because tmux makes "agents independent processes." In Hermes, where Oracle is the main loop, "two sequential Oracle calls" reproduces the same result losslessly at `depth 1` — turning the constraint into a design-alignment opportunity rather than a limitation.
2. **The value of the Hermes move is orchestration/runtime integration, not prose-ifying deterministic scripts.** Verified `.mjs` (translation, window, consistency checks) belong in `terminal()` calls as-is. The "more native" temptation to absorb them into skill bodies is an anti-pattern of regressing to non-deterministic inference.
3. **Oracle-direct verification catches self-report errors.** Gatekeeper's "tsc exit 0" report diverged from the real exit 2 (pre-existing deprecation), caught by Oracle's direct re-run — proving the "sub-report = unverified self-report" principle (decision 6) within a single cycle.
4. **Spiking first cheaply closed the unverified areas of a first native transition.** Before porting all 12, the 2 cycles (Sensei flow, Gatekeeper full cycle + critic gate) confirmed decisions 1-6 hold in reality -> proceed with the formal migration on top of that confidence.
5. **Operational blockers surface only at real call time.** The need for a Codex model pin was measured not by static analysis but by the 400 error of a real `codex review` call — resolving a carried-over memory item via evidence.

## Carry-over

- **Phase 2** — production validation of the full dispatch migration (concurrent multi-agent delegation, real-world Oracle-sequential auto-critic), live runs of the remaining lifecycle.
- **Phase 3** — review migrating harness checkup / lifecycle to cron.
- **Phase 4** — thin-shim `.claude/commands` / unify the SSOT, update runbooks.
- Most deliverables live in the `~/.hermes/` profile (outside repo git) -> review a future backup/version-control policy for profile assets.
- Existing memory carry-overs: (harness slot) make the pane guard permanent + window decoration + 3-in-a-row status mis-recording · promote `Quality — docs` to required · blog topics (CS quiz S215~229, zstd) · formalize the fact-gate model-attribution check · (user console) GA4 3 items, live SEO, harness cron, webhook regenerate, accumulated UAT.
