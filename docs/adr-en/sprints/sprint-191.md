---
sprint: 191
title: "Batch resolution of carryover seeds — filterAdjacency P2 · .claude-tools Phase 2 · prom-client Case C/D"
date: "2026-05-21"
status: completed
agents: [Oracle, Architect, Scribe, Critic]
related_adrs: ["sprint-190", "sprint-189", "sprint-135", "sprint-156"]
related_memory: ["sprint-window"]
topics: ["operations", "cicd"]
tldr: "Resolve the 8 carryover seeds accumulated through Sprint 190 in a single batch, classified into 3 tiers after measuring value/risk. Implement 3 (filterAdjacency P2 + removal of dead unresolved UI · .claude-tools Phase 2 deletion · prom-client Case C/D regression specs), verify-and-close 2 (already implemented), decision-based close 3 (zero value / counterproductive). Zero issues after 2 Critic rounds, CI green."
---
# Sprint 191 — Batch resolution of carryover seeds (filterAdjacency P2 · .claude-tools Phase 2 · prom-client Case C/D)

## Goal

- Per the user directive ("resolve all carryover seeds"), process the 8 carryover seeds accumulated through Sprint 190 in a single batch.
- Rather than treating "resolve" as "implement" for everything, measure each seed's **value/risk via upfront investigation** and classify into 3 tiers: implement (valuable/safe) / verify-and-close (already implemented) / decision-based close (zero value or counterproductive).

## Background

- Through Sprint 185~190, items like "optional follow-ups", "H3 PR table", and "filterAdjacency P2" had been cumulatively carried forward in every sprint's carryover list (sprint-181~190 §carryover). Some were already implemented (post-merge gate, doc-refs bare-path), some had ambiguous definitions, and some would become dead code with zero targets.
- This continued the Sprint 190 lesson: rather than implementing accumulated seeds all at once, measure each item's actual value and process selectively.

## Decisions

### D1. 3-tier classification of 8 seeds (user-confirmed after investigation)

Investigation measured each seed's state, presented to the user, who confirmed "#6~8 = decision-based resolution":

| # | Seed | Tier | Rationale |
|---|------|------|-----------|
| 1 | filterAdjacency P2 | Implement | unresolved `to` is absent from the full document set, causing phantom nodes / count mismatch |
| 2 | .claude-tools Phase 2 | Implement | 2 deprecated files, 0 live callers |
| 3 | prom-client Case B~D | Implement | Case A·B already covered, only C·D are gaps |
| 4 | post-merge deploy gate | Verify-and-close | `compute-deploy-gate.sh` (Sprint 160) already implemented |
| 5 | doc-refs bare-path | Verify-and-close | all 8 prefixes covered (Sprint 182) already implemented |
| 6 | coverage-gate skipped removal | Decision-based | removal would make the gate itself silently skip → check omission |
| 7 | H3 PR table extraction | Decision-based | 0 H3 tables with a Phase column → dead code |
| 8 | (adr) layout split | Decision-based | usePathname() (Sprint 188) works correctly, zero observable change |

### D2. filterAdjacency P2 — count safety + dead UI removal (Critic P2)

- Unified the edge-keep condition to require **both from·to to be surviving nodes** (`nodeIds.has(e.from) && nodeIds.has(e.to)`). Unresolved edges are naturally excluded because `to` is a non-existent reference → structurally blocks mermaid implicit nodes / count mismatch.
- Critic (Codex) R1 flagged P2: this change leaves the `showUnresolved` toggle / dashed legend / caption non-functional (dead UI). With 0 unresolved edges and low priority, the user confirmed **UI removal** over placeholder nodes (feature preservation).
- `showResolved`→single `showEdges` toggle, buildChart renders only edges between declared nodes (including the getSubgraph path phantom guard), i18n (ko+en) cleanup.

### D3. prom-client Case B~D — fill only the gaps + §9-3 correction

- Investigation found Case A (duplicate registration) and B (label cardinality `normalizePath`) already have specs across all NestJS services + ai-analysis. Only the unverified gaps were filled:
  - **Case C** (worker registry isolation): verify the github-worker isolated registry output contains prefixed `nodejs_`/`process_` default metrics.
  - **Case D** (Python explicit metric): verify ai-analysis explicit `algosu_ai_analysis_*` metrics are exposed.
- Added a Case A~D regression-spec mapping to `monitoring-logging.md §9-3` + **corrected Case D**: `prometheus_client` auto-registers GC/platform collectors in the default REGISTRY (`python_gc_*`/`python_info` exposed, `process_*` on Linux), so "gc_*/process_* absent" was inaccurate → the essence is "Node-style `collectDefaultMetrics` not called".

## Implementation

### Implementation commits (5 commits, PR #335 squash → `2db66dd`)

- `02cb0d2` fix(blog) — filterAdjacency P2: keep only edges where both from·to are surviving nodes
- `64f568b` chore(docs) — .claude-tools Phase 2: delete 2 deprecated files + reflect in runbook
- `e59fa3c` test(github-worker) — prom-client Case C isolated-registry default-metric regression spec
- `ba6d816` test(ai-analysis) — prom-client Case D explicit-metric regression spec + §9-3 mapping/correction
- `0addc4b` fix(blog) — remove unresolved-edge UI (Critic P2)

### .claude-tools Phase 2 notes

- `.claude-tools/` is in `.gitignore` (untracked) → the file deletion itself is a local operation; the only tracked change is the runbook update. Trigger path verification: 0 live callers in `~/.claude/oracle/bin/` and internal files. `.claude-team.json` (critic dispatch config) is a separate file and was preserved.

## Verification

- **blog**: tsc 0 · build all routes static (incl. graph) · output has new labels (`연결 표시`/`Show edges`) and lacks the old unresolved UI (EN "Unresolved" is an ADR node-label false positive).
- **service tests**: github-worker 179 tests pass (incl. Case C) · ai-analysis Case D pass (metrics.py 100%).
- **6 gates green**: doc-refs 343 0broken · i18n-residue 2.19%<8% · blog-crosscheck KR10/EN10 0 · adr-links 1921 0broken · adr-conversion 12/12 · adr-en 137/137 · adr-index sprint 128.
- **Critic**: `codex review --base main` 2 rounds — R1 P2 1 finding (unresolved toggle disabled) → UI removal applied, **R2 zero issues**.
- **CI #335**: SUCCESS 40 / SKIPPED 9 / NEUTRAL 1 / **FAILURE 0** (incl. Build Blog · Test AI Analysis · github-worker · E2E · Coverage Gate · Trivy).

## Lessons / Patterns

- ① **For accumulated seeds, measuring value/risk and selecting beats batch implementation (inherited from / re-proven by Sprint 190)** — of 8 seeds, 2 were already implemented (verify only), 3 were zero-value/counterproductive (decision-based close), so actual implementation focused on 3. Upfront investigation prevented wasted work.
- ② **When a minimal fix kills adjacent UI, the Critic catches it → honest completion required** — the 1-line filterAdjacency fix corrected the count but left the `showUnresolved` toggle/legend as dead UI, which Critic (Codex) flagged as P2. The product decision (preserve via placeholder vs remove) was delegated to the user, completing without dead UI.
- ③ **For "already implemented" seeds, verify-and-close is the resolution** — post-merge gate and doc-refs bare-path were confirmed implemented via code evidence (`compute-deploy-gate.sh` · `REPO_ROOT_PREFIXES` 8 prefixes) then removed from the backlog. "Resolve" includes verification/closure/decision documentation, not just implementation.
- ④ **Investigate existing coverage before adding regression specs** — prom-client "Case B~D" turned out to have Case A·B already covered across all services, so the real gap was only C·D. Re-writing B would have duplicated. As a byproduct, the inaccurate Case D description in §9-3 (ignoring prometheus_client's auto collectors) was corrected against empirical output.

## Carryover

- Accumulated UAT (user-direct): seed #5 Programmers resubmission grading / seed #9 English production Grafana CB dashboard ai-analysis visual consistency / Sprint 160~191 cumulative UAT
- New seed: **Python 3.14 compatibility** — `test_main.py` 4 tests fail under local Python 3.14 due to removal of `asyncio.get_event_loop()` auto loop creation (CI uses Python 3.12 and passes; unrelated to this sprint). → handle in Sprint 192.
