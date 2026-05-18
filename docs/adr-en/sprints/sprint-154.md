---
sprint: 154
title: "Sprint 153 Automation Follow-up — git Staging Plan Specification + Broken Ref Periodic Lint"
date: "2026-05-14"
status: completed
agents: [Oracle, Architect, Scribe]
related_adrs: ["sprint-151", "sprint-152", "sprint-153"]
related_memory: ["sprint-window"]
---
# Sprint 154 — Sprint 153 Automation Follow-up: git Staging Plan Specification + Broken Ref Periodic Lint

## Goals

- Bundle-process 2 automation candidates (seed #20 / #21) derived from Sprint 153 retrospective
- **Post-detection (Phase B / Seed #21)**: Automate Sprint 153 Phase G 5-slug 23-occurrence broken ref cases as periodic lint
- **Pre-blocking (Phase A / Seed #20)**: Convert the `git mv` + sed staging omission incident that recurred twice in Sprint 153 Phase A/E into a plan-stage checklist

## Decisions

- **Phase B first / Phase A second**: Phase A persona cross-ref cites Phase B deliverable (`docs/runbook/doc-ref-lint.md`) — dependency order exists
- **Phase B**: New `scripts/check-doc-refs.mjs` + new `quality-docs` job — same pattern as existing `check-grafana-metrics.mjs` / `check-regex-robustness.mjs` (`runRegressionFixtures()` self-test + paths filter + exit code 0/1/2)
- **Phase A**: New RUNBOOK `docs/runbook/git-staging-checklist.md` + `architect.md` / `scribe.md` persona cross-ref — Sprint 153 3 incidents (commit omission / main exposure / stash drop loss) all directly reflected in recovery procedure §3
- **Incident-to-RUNBOOK 1:1 mapping principle**: Both RUNBOOKs in this sprint register the immediately preceding sprint's incidents as fixtures/cases — fixing regression blocking essence as "concrete cases" rather than "qualitative rules"
- Each phase: independent PR + Squash merge — separate change scope / risk level (Sprint 150/152/153 pattern directly inherited)

## Implementation (2 PR squash merge, origin/main `661cd59` → `cc26411`)

| PR | Phase | Changes | Lines |
|----|-------|---------|-------|
| [#244](https://github.com/tpals0409/AlgoSu/pull/244) | B | New `scripts/check-doc-refs.mjs` + CI `quality-docs` job + `docs/runbook/doc-ref-lint.md` + 2 index updates + 2 sprint-102.md exemption directives | +415 −5 |
| [#245](https://github.com/tpals0409/AlgoSu/pull/245) | A | New `docs/runbook/git-staging-checklist.md` + `architect.md` / `scribe.md` persona cross-ref + 2 index updates | +156 −3 |

### Phase B Detail — Broken Ref Lint

**`scripts/check-doc-refs.mjs`** (255 lines):
- `git ls-files '*.md'` → 159 tracked .md files (after Phase A merge)
- Two extraction rules: (1) markdown link `[text](path)` (2) bare doc path `docs/.../*.md`
- Automatic exemption: external URLs (`http://` / `https://` / `mailto:` / `file:`) / anchor-only / template variables / code fences / inline code
- Explicit exemption: line-end `<!-- doc-ref-lint: ignore -->` directive
- **Self-test fixture**: Sprint 153 Phase G 5-slug inline verification (`docs/runbook-monitoring-log-rules.md` / `-ci-cd-rules.md` / `-annotation-dictionary.md` / `-migration-rules.md` / `-work-progress-guide.md`) — exit 2 self-test fail on detection count mismatch
- Exit codes: 0 (pass) / 1 (broken ref) / 2 (self-test fail)

**CI integration** (`.github/workflows/ci.yml`):
- Added `docs` paths filter to `detect-changes` (`docs/**/*.md`, `*.md`, `.claude/commands/**/*.md`, `blog/content/**/*.mdx`, `scripts/check-doc-refs.mjs`)
- New `quality-docs` job alongside `quality-monitoring` — `needs: detect-changes`, `if: docs == 'true'`
- Added `docs=true` to `rebuild_all` override branch

**Immediate detection + resolution**:
- sprint-102.md:76, sprint-102.md:85 — user home `~/.claude/projects/.../memory/...` absolute path (outside repo, machine-dependent) → **exemption directive** applied
- sprint-72.md:37 — `file:///root/.claude/...` scheme → added `file:` scheme to `validateRef()` external URL exemption pattern for automatic handling

### Phase A Detail — Staging Checklist

**`docs/runbook/git-staging-checklist.md`** (142 lines, 7 sections):
- §1 Overview — Sprint 153 Phase A (self-discovered within single PR) / Phase E (main exposure → PR #241 hotfix) 2 incidents directly cited
- §2 Plan-stage checklist — 4 work type classifications (Edit/Write only / `git mv` only / sed multi-file / combined) × staging command matrix + pre-commit `git status --short` + `git diff --cached --stat` verification
- §3 Recovery procedures — 3 incident types (commit omission / main broken link / `git stash push -u` + `drop` untracked loss) all Sprint 153 incident 1:1 mapped
- §4 Plan template example — required items for `**staging procedure**:` section
- §5 Agent responsibility assignment — architect / scribe / conductor / critic
- §6 Operations procedure — local + CI automation future expansion candidate (pre-push hook / PR check)
- §7 History

**Persona cross-ref**:
- `architect.md`: Staging checklist mandatory item added alongside monitoring regex checklist (3 lines)
- `scribe.md`: When planning document moves/renames, cite §2 explicitly + mandatory post-fix broken ref lint (`node scripts/check-doc-refs.mjs`) — directly linked to Phase B deliverable

## Verification

- **Phase B PR #244 CI**: 29 success / 0 fail / 11 skipped, mergeStateStatus **CLEAN** ✅
- **Phase A PR #245 CI**: 28 success / 0 fail / 12 skipped, mergeStateStatus **CLEAN** ✅
- **Local lint**: `node scripts/check-doc-refs.mjs` run after each phase during sprint — 0 broken refs / fixture 5/5 consistently maintained
- **Automatic exemption verification**: `file:` scheme addition + 2 sprint-102.md directives processed all 3 detected cases correctly (0 false positives)
- **Self-verification of 2 new RUNBOOKs via doc-ref-lint**: `doc-ref-lint.md` / `git-staging-checklist.md` added during this sprint also passed lint

## Branch Discipline

- Both PRs use new branches + Squash merge — **20 consecutive sprints compliant** (since Sprint 134 violation)
- 0 direct commits to main

## New Patterns

1. **Post-detection + pre-blocking pair pattern** — Phase B (lint, post-detection) + Phase A (checklist, pre-blocking) matched as pair. Two-stage safety net simultaneously introduced for a single defect domain
2. **Direct 1:1 mapping of preceding sprint incidents to fixtures/cases** — Phase B self-test 5 slugs (= Phase G slugs 5 types) + Phase A recovery procedures 3 types (= Phase A/E + stash drop secondary incident). Fixing regression blocking essence as "concrete cases" rather than "qualitative rules"
3. **New RUNBOOK self-verification via lint** — Phase B introduced lint immediately verifies Phase A deliverables too. Meta-self-verification cycle completed
4. **SSOT 5-item simultaneous update obligation when adding new paths filter items** — (1) filters block (2) outputs (3) rebuild_all branch (4) job needs (5) job if. Phase B in Sprint 154 correctly updated all 5
5. **Single sprint 2 PR bundled response** — Sprint 152 (3 PR / blog) / Sprint 151 (2 PR / SQL) / Sprint 150 (3 PR / seed bundle) pattern inherited. Impact scope separated + sequential merge

## Lessons Learned

1. **Plan automation + code automation are separate safety nets** — Phase A (plan-stage specification) and Phase B (CI automated verification) block the same defect at different stages. Either alone is insufficient — plan can be missed + CI can be bypassed
2. **`file:` scheme is easily missed in external URL exemptions** — Only `http(s)://`, `mailto:`, `tel:`, `ftp:` are commonly considered. `file:///` belongs to the same category — immediately added upon Phase B 1st detection
3. **Automatic exemption vs. explicit exemption separation policy** — Decisive patterns like external URLs go into code rules / context-dependent exemptions like user home paths use explicit directives. Embedding user home patterns in code rules is fragile
4. **Obligation to simultaneously update 2 index types when adding new RUNBOOK (Sprint 153 Phase D pattern directly inherited)** — `docs/runbook/README.md` (runbook index) + `docs/README.md` (overall index category count). Both phases in this sprint updated both indexes simultaneously ✅
5. **Agent persona cross-refs must immediately reflect new work from authoring time** — Phase A updates to `architect.md` / `scribe.md` are valid not from the next sprint but during this sprint — Phase B staging checklist self-applied (Edit/Write only = §2.2 first case explicit whitelist)

## Sprint 155 Carryover

### Sprint 154 New Automation Candidate (1 item)

- Seed #22: **Plan-stage staging command auto-verification (pre-push hook)** — Future expansion candidate per `docs/runbook/git-staging-checklist.md` §6. Automate cross-check between plan body `**staging procedure**:` section and actual commit's `git diff origin/main --stat`

### UAT User Direct (11 sprints accumulated)

- Seed #5: Programmers resubmission scoring pass confirmation
- Seed #9: English environment + production Grafana CB dashboard ai-analysis visual consistency

### Sprint 152~153 New Automation Candidates (Carry Forward)

- Seed #18: Blog post pre-merge domain fact cross-check automation
- Seed #19: KR/EN dual simultaneous authoring plan obligation + CI rule

### Follow-up (Optional, Sprint 151 unchanged)

- create/edit page.tsx category UI addition
- Programmers URL automatic category inference
- Existing SQL problem data backfill
- Sprint 150 unresolved 3 candidates (`.claude-tools/` cleanup / CI paths filter bypass debt check automation / prom-client default metric stale check)

## Related Memory

- [sprint-window.md](../../../.claude/projects/-Users-leokim-Desktop-leo-kim-AlgoSu/memory/sprint-window.md) <!-- doc-ref-lint: ignore -->
