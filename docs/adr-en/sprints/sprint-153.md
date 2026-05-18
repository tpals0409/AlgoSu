---
sprint: 153
title: "docs/ Folder Optimization + Bulk Resolution of Broken Ref Debt"
date: "2026-05-13"
status: completed
agents: [Oracle, Scribe]
related_adrs: ["sprint-150", "sprint-151", "sprint-152"]
related_memory: ["sprint-window"]
---
# Sprint 153 — docs/ Folder Optimization + Bulk Resolution of Broken Ref Debt

## Goals

- Reorganize 23 files scattered in the docs/ root into semantically grouped subdirectories, restoring single-level tree depth consistency
- Formalize the audit artifact retention policy + remove raw jsonl volume
- Bulk resolution of 5 unwritten documents (23 broken ref occurrences) discovered during verification

## Decisions

- **Phase A/D/E/F**: Relocate (`git mv`) + preserve body content + apply Phase D category (`conventions/` / `patterns/`) consistency
- **Phase B**: Permanently retain the consolidated `.md` only; do not retain raw `.jsonl` — SSOT formalized in `docs/audits/README.md`
- **Phase C**: Create `docs/README.md` + `docs/adr/README.md` index for new contributor navigation
- **Phase G**: Include broken ref debt for 5 slugs in this sprint scope — resolved by writing stubs that precisely match 13 `§section` references embedded in code comments (`monitoring-log-rules §section`)
- All phases: independent PR + Squash merge — separate change scope / risk level

## Implementation (8 PR squash merge, origin/main `3873f6d` → `661cd59`)

| PR | Phase | Changes |
|----|-------|---------|
| [#236](https://github.com/tpals0409/AlgoSu/pull/236) | A | Root one-off sprint notes 3 (`sprint-{40,48,51}-*.md`) → `adr/sprints/sprint-{NN}.md` + Sprint 62+ frontmatter convention correction |
| [#237](https://github.com/tpals0409/AlgoSu/pull/237) | B | Remove `docs/audits/sprint-118/_raw/*.jsonl` 7 files (593 lines, 260K) + new `docs/audits/README.md` retention policy |
| [#238](https://github.com/tpals0409/AlgoSu/pull/238) | C | New `docs/README.md` + `docs/adr/README.md` index (5 categories + ADR 3 types) |
| [#239](https://github.com/tpals0409/AlgoSu/pull/239) | D | 6 convention/pattern files → `conventions/` + `patterns/` (0 cross-refs — safe relocation) |
| [#240](https://github.com/tpals0409/AlgoSu/pull/240) | E | 14 runbooks → `docs/runbook/` + section-level index README. **However, sed-processed 19 cross-refs missing from staging and excluded from commit** |
| [#241](https://github.com/tpals0409/AlgoSu/pull/241) | E hotfix | Bulk restore Phase E missing 19 cross-refs (`git ls-files \| xargs sed`) |
| [#242](https://github.com/tpals0409/AlgoSu/pull/242) | F | `sprint-95-programmers-dataset.md` → `docs/adr/topics/` (5 cross-ref updates: sprint-95 ADR + gateway TS JSDoc + 2 READMEs) |
| [#243](https://github.com/tpals0409/AlgoSu/pull/243) | G | Bulk cleanup of 5-slug 23-occurrence broken refs — 3 new documents (`monitoring-logging.md` §1~§11 / `ci-cd.md` §1~§7 / `annotation-dictionary.md` 13 guard + 10 event + 16 domain) + 24 sed + 1 ref removal |

### 1 Incident + 1 Recovery

- **Incident**: In Phase E PR #240, `git mv` + new README were committed but sed-processed cross-ref updates for 19 files were missing from the staged area and excluded from the commit → 19 broken links exposed on main
- **Secondary incident**: To isolate working tree changes before merge, ran `git stash push -u` then dropped the stash with `git stash drop` immediately after hotfix → 4 untracked sprint-149/150/151/152.md ADR files that were stashed together were lost
- **Recovery**:
  1. PR #241: bulk-restored 19 cross-refs (CI green merge)
  2. 4 lost ADR files: `git fsck --no-reflogs --unreachable` → located stash commit `792f75bd`'s 3rd parent tree → all 4 blobs 100% recovered

### Phase G Debt Resolution Detail

| Slug (unwritten) | Resolution Method | Affected Files |
|-----------------|-------------------|----------------|
| `monitoring-log-rules.md` | New `conventions/monitoring-logging.md` — precisely matching 13 `§section` references from code comments §1~§11-2 (structured logging / sanitize / Saga / MQ / error codes / slow query / metrics / Prometheus alert) | 15 |
| `ci-cd-rules.md` | New `conventions/ci-cd.md` — Conventional Commits + branch/PR/CI/security/dependency/deploy (§7-2 Layer sequence) | 3 |
| `annotation-dictionary.md` | New `conventions/annotation-dictionary.md` — `@guard` 13 + `@event` 10 + `@domain` 16 catalog | 3 |
| `migration-rules.md` | Update ref to `conventions/migration-naming.md` (utilizing Phase D `conventions/`) | 1 |
| `work-progress-guide.md` | Remove ref from scribe.md (single reference + unwritten document) | 1 |
| **Total** | **3 new + 24 sed + 1 ref removal** | **23 broken links resolved** |

## Verification

- All 8 PRs: CI fail 0, mergeStateStatus CLEAN ✅
- 4-slug broken ref grep: 0 occurrences (`monitoring-log-rules` / `ci-cd-rules` / `migration-rules` / `work-progress-guide`)
- docs/ root file count: **23 → 1** (README.md only remaining)
- docs/ single-level tree depth consistency restored (`adr/` `audits/` `assets/` `conventions/` `patterns/` `runbook/` all in subdirectories)
- docs/ volume: 1.7M → 1.5M (260K audits raw removed)
- conventions expanded to 6 (3 new + 3 existing)

## Branch Discipline

✅ **19 consecutive sprints compliant** — All 8 PRs use new branches + Squash merge, 0 direct commits to main (since Sprint 134 violation)

## New Patterns

- **Breaking "out of scope" assessment through re-verification** — 6 convention/pattern files previously classified as out-of-scope due to "heavy cross-ref impact" were re-verified before Phase D entry → confirmed 0 cross-refs and processed immediately. Reveals possibility of discovering "safe but unresolved" debt that has accumulated
- **Debt discovery → expand this sprint's scope (Phase G)** — 23 broken refs discovered during verification → processed immediately rather than deferring to a separate sprint. "Cleanup + verification + additional debt resolution" cycle completed within a single sprint
- **Using §section numbers embedded in code as stub writing guide** — 13 `§section` numbers from `monitoring-log-rules §1~§11` embedded in code/infra comments allowed reverse-extraction of exact section numbers and meanings from code. "Code enforces the domain of documentation" pattern
- **`git fsck --no-reflogs --unreachable` for stash drop loss recovery** — Even after `git stash drop`, the stash commit remains as unreachable until GC. All untracked blobs recoverable 100% from 3rd parent tree
- **Single sprint 8 PR + 1 hotfix bundle** — Sprint 150 (3 PR) / 152 (3 PR) pattern extension. Each PR's impact scope isolated + CI green merge sequential progression gradually absorbs risk

## Lessons Learned

- **`git mv` + Edit/sed have separate staging — `git add -u` must be explicit** — Pattern discovered once in Phase A recurred identically in Phase E → broken links exposed on main. `git commit` processes only staged files, so sed results are not included in commit without explicit staging. Phase F/G used `git add docs/ services/` or `git add -u` for explicit staging
- **`git stash push -u` followed by `git stash drop` risks permanent loss of untracked files** — Untracked files stashed with `-u` may not appear in regular `stash list`/`reflog stash`. If stash contents need preservation before drop, use `git stash show -u stash@{0}` or isolate with a separate commit. If lost, immediately attempt recovery with `git fsck --unreachable`
- **paths filter is a double-edged sword (Sprint 150 lesson directly reconfirmed)** — All 8 PRs in this sprint are docs-only but Coverage Gate / Tests ran normally. paths filter only builds changed services, but main-baseline verification can be exposed
- **Decision criteria for expanding scope vs. deferring when debt is discovered** — Clear impact scope + same domain as current work + cycle time available → process immediately. 23 broken refs were same domain as docs/ cleanup so decided to process in this sprint. Seeds requiring external UAT confirmation like #5/#9 remain deferred
- **Even "simple cleanup" can cause incidents — accurate understanding of git command combination staging model is essential** — git mv (auto staged) / Edit (unstaged) / sed (unstaged) / git stash -u (includes untracked) / git stash drop (permanent removal). Must understand the exact staging/storage effect of each command to avoid incidents
- **User direct verification as debt discovery trigger** — After completing Phase A~F, user asked "confirm whether changes were applied to agent documents too" → discovered debt immediately absorbed as Phase G in this sprint. Recommend one more user verification cycle before sprint closure

## Sprint 154 Carryover Seeds

### UAT User Direct (Carry Forward)

- Seed #5: Programmers resubmission scoring pass confirmation (10 sprints accumulated — Sprint 145~153)
- Seed #9: English environment + production Grafana CB dashboard ai-analysis visual consistency (10 sprints accumulated)

### Sprint 152 New Automation Candidates (Carry Forward)

- Seed #18: Blog post pre-merge domain fact cross-check automation (ADR accumulation count / sprint numbers / GitHub URL validity)
- Seed #19: KR/EN dual simultaneous authoring plan obligation for new blog posts — plan template update + CI rule

### Sprint 153 New Seeds (2 items)

- Seed #20: **`git add` staging model specification at plan stage** — For work combining `git mv` + Edit/sed, add "mandatory `git add -u` after sed" checklist to plan template. Block the pattern that recurred twice in Phase A/E
- Seed #21: **Broken ref periodic check automation candidate** — `git ls-files | xargs grep -l "docs/.*\.md"` + file existence validation lint. Phase G found 23 occurrences → periodic automation would prevent debt accumulation

### Follow-up (Optional, Sprint 151 unchanged)

- create/edit page.tsx category UI addition
- Programmers URL automatic category inference
- Existing SQL problem data backfill
- Sprint 150 unresolved 3 candidates (`.claude-tools/` cleanup / CI paths filter bypass debt check automation / prom-client default metric stale check)

### Future docs Cleanup Follow-up

- When new categories need to be separated from runbook/conventions docs, **directly inherit this sprint's Phase D/G pattern (cross-ref re-verification + sed batch + explicit `git add -u`)**
- As topic ADRs accumulate, add under `docs/adr/topics/` (directory established in Phase F)

## Related Memory

- [sprint-window.md](../../../.claude/projects/-Users-leokim-Desktop-leo-kim-AlgoSu/memory/sprint-window.md) <!-- doc-ref-lint: ignore -->
- [feedback-blog-workflow](../../../.claude/projects/-Users-leokim-Desktop-leo-kim-AlgoSu/memory/feedback-blog-workflow.md) — User verification cycle pattern directly reconfirmed <!-- doc-ref-lint: ignore -->
