---
sprint: 166
title: "tarball Size $GITHUB_STEP_SUMMARY Output — Sprint 165 Option C Operational Visibility (Seed #165-1)"
date: "2026-05-19"
status: completed
agents: [Oracle, Architect, Critic, Scribe]
related_adrs: ["sprint-165", "sprint-160"]
related_memory: ["sprint-window"]
---
# Sprint 166 — tarball Size `$GITHUB_STEP_SUMMARY` Output: Sprint 165 Option C Operational Visibility (Seed #165-1)

## Goal

- Recover from zero operational visibility after Sprint 165 Option C (buildx tarball + `trivy --input`) was established
- Unable to quantify cost of 8 image tarball upload/download per PR → resolved by adding `$GITHUB_STEP_SUMMARY` output step to 3 build jobs
- Establish baseline data for future seed #165-2 zstd compression comparison
- User selection A: seed #165-1 standalone recovery (safe incremental improvement), #165-2 deferred to Sprint 167+ after baseline established

## Decisions

### D0. Seed #165-1 Standalone Recovery — User Selection A (Safe Incremental Improvement)

- **A adopted** among Sprint 166 scope candidates A~D (user decision):
  - A (seed #165-1 standalone) / B (#165-1 + Sprint 164 #new-6 integrated) / C (#165-1 + #165-2 zstd measurement) / D (UAT visual verification first)
- Rationale: zstd comparison (#165-2) is meaningless without baseline data — measuring first then comparing next sprint is the correct order
- Sprint 165 Option C established (security gate) → Sprint 166 (visibility) → Sprint 167 (optimization comparison): step 2 of 3-sprint cycle

### D1. tarball Size Only for First Introduction — cache hit/miss Info Deferred to Sprint 167+

- `docker/build-push-action@v7` metadata output (`containerimage.buildinfo`) does not directly expose cache hit/miss
- Separate step using `buildx du` or `imagetools inspect` is needed — out of scope for this sprint
- `stat -c %s` byte size alone is sufficient to establish PR artifact upload/download cost baseline

### D2. `awk -v b="$SIZE_BYTES"` Variable Passing Pattern — Shell Injection Prevention

- Adopted explicit `awk -v key="$VAR"` passing instead of relying on double-quote expand `awk "BEGIN {... $SIZE_BYTES ...}"`
- Double-quote pattern is only safe when SIZE_BYTES is an integer — awk syntax error possible if value format changes later
- `awk -v` is the standard safe pattern that clearly separates shell/awk boundaries

### D3. `stat -c %s` GNU coreutils — `ubuntu-latest` Environment Guaranteed

- `stat -c %s` is GNU coreutils-specific (macOS uses `stat -f %z`)
- GitHub Actions `ubuntu-latest` guarantees GNU coreutils → platform difference irrelevant
- CI-only step, so macOS local execution mismatch has no cost

### D4. Same Pattern for 3 Build Jobs (matrix vs hardcoding only difference) — DRY Naturally Applied

- build-services: uses `${{ matrix.service }}` variable + `if: steps.check.outputs.skip == 'false'` guard
- build-frontend: `/tmp/image-frontend.tar` hardcoded (no skip guard — job itself has no skip guard)
- build-blog: `/tmp/image-blog.tar` hardcoded (no skip guard)

## Implementation (1 PR, 34-Sprint Consecutive Branch Discipline)

Branch: `feat/sprint-166-tarball-size-summary` (new branch from main `c0c48aa`)

### Phase A — ci.yml 3 Step Addition (`d172eea`)

Insert "Report tarball size" step immediately after `Upload image tarball for Trivy scan` in each of 3 build jobs (+41 lines):
- line 690 (build-services, matrix + skip guard), line 746 (build-frontend, hardcoded), line 824 (build-blog, hardcoded)

```yaml
- name: Report tarball size
  run: |
    TARBALL=/tmp/image-frontend.tar   # build-services uses ${{ matrix.service }}, others hardcoded
    SIZE_BYTES=$(stat -c %s "$TARBALL")
    SIZE_MB=$(awk -v b="$SIZE_BYTES" 'BEGIN {printf "%.1f", b/1024/1024}')
    {
      echo "### 📦 frontend build artifact"
      echo "- tarball size: **${SIZE_MB} MB** (${SIZE_BYTES} bytes)"
      echo "- path: \`$TARBALL\`"
      echo "- retention: 1 day"
    } >> "$GITHUB_STEP_SUMMARY"
```

### Phase B — ADR Record (This Commit)

- `docs/adr/sprints/sprint-166.md` (KR) + `docs/adr-en/sprints/sprint-166.md` (EN 1:1 mapping)
- `docs/adr/README.md` count 105→106, range 62~165→62~166 (lines 18/52/54)

## Risk/Regression Blocking

### Prediction 1: `stat` Platform Difference

`stat -c %s` (GNU) vs `stat -f %z` (macOS) difference → `ubuntu-latest` guarantees GNU coreutils. CI-only step, so local mismatch has no cost.

### Prediction 2: `$GITHUB_STEP_SUMMARY` Size Limit 1 MiB/job

This step adds ~200 bytes per job → irrelevant to limit (1 MiB). CI standard env var, automatically injected in all steps.

### Prediction 3: Step Execution Without tarball Generated

build-services: `if: steps.check.outputs.skip == 'false'` guard activates step only after build-push-action runs. frontend/blog: tarball only exists when build-push-action succeeds → always safe at step arrival point.

## Verification

- **Local**: `python3 yaml.safe_load` PASS (`YAML OK`), `node scripts/check-adr-en-coverage.mjs --strict` 115/115 PASS, `node scripts/check-doc-refs.mjs` 0 broken refs
- **CI (PR stage)**: build-services 6 matrix + build-frontend + build-blog job Summaries display `### 📦 {service} build artifact` H3 + size MB (new UAT item 1)
- trivy-scan 8 matrix no regression (`--input` tarball matching unchanged)

## Results

4 changed files:
- 1 modified: `.github/workflows/ci.yml` +41 lines (3 steps added: build-services/frontend/blog)
- 2 new: `docs/adr/sprints/sprint-166.md` (KR) + `docs/adr-en/sprints/sprint-166.md` (EN 1:1 mapping)
- 1 modified: `docs/adr/README.md` (lines 18/52/54 — count 105→106, range 62~165→62~166)

## New Patterns

- **Build job Summary visibility pattern** — standard monitoring pattern: add `$GITHUB_STEP_SUMMARY` output step immediately after build artifact creation → upload. Applies uniformly to both matrix and hardcoded jobs. Sprint 165 Option C established → immediate visibility follow-up step → step 1 of operations-observation-based optimization cycle (seed #165-2)
- **`awk -v` variable passing = shell safety standard pattern** — explicit `awk -v key="$VAR"` passing instead of double-quote expand dependency. Clarifies shell/awk boundary in yaml run scripts. Established as standard pattern for future CI yaml script writing
- **Baseline data acquisition first + comparison forward-fix split** — seed #165-2 zstd comparison is meaningless without baseline. This sprint collects data → next sprint compares. Regression isolation via split + measurement value first pattern

## Lessons

- **Immediate follow-up monitoring after Sprint 165 Option C establishment preserves operational value** — zero visibility state after security gate establishment (Sprint 165) recovered in 1 sprint via seed #165-1. Reconfirmed value of the pattern where an establishment sprint immediately generates follow-up seeds. "Security gate → visibility → optimization" 3-sprint cycle begins
- **`awk` shell expansion dependency is future regression risk** — double-quote pattern `awk "... $VAR ..."` is only safe when SIZE_BYTES is an integer. awk syntax error possible if value format changes (e.g., includes path). `awk -v` established as standard safe pattern
- **buildx metadata cache info absence = separate tool needed in next sprint** — `docker/build-push-action@v7` metadata output does not directly expose cache hit/miss. Separate step using `buildx du` or `imagetools inspect` needed → separate seed for Sprint 167+
- **Essence simplification first — D2/D3 are implementation details but ADR documentation has value** — even in small sprints, documenting decision rationale blocks future regression/misunderstanding. Without ADR, D2(awk -v)/D3(stat -c) rationale would be unknown 6 months later

## Carry-Over (Sprint 167+)

- **Sprint 166 new carry-over seeds**:
  - Seed #165-2 zstd compression measurement comparison (after baseline data acquired: `type=oci,compression=zstd` vs `type=docker` size/time measurement)
  - cache hit/miss visibility (`buildx du` or `imagetools inspect` separate step — Sprint 167+ seed)
- **Sprint 165 carry-over continued**:
  - Sprint 164 seeds #new-4/5/6/7 CI visibility (deploy gate simulation / aether-gitops kustomization auto-PR / `$GITHUB_STEP_SUMMARY` standardization / `_parse_group_response` envelope extension)
  - Seeds #30/#31 (Sprint 158 i18n/lint): build output Korean residue CI step + i18n 3-layer checklist
  - Seeds #24/#18 (Sprint 157): plan template i18n bilateral obligation auto / blog pre-merge cross-check automation
  - Seeds #26/27/28 (Sprint 157 ADR/blog): README paths filter / build-blog `ls out/` / check-adr-links ROOT auto-detect
  - UAT 22-sprint cumulative user direct verification (#5/#9 + Sprint 160~165 cumulative + Sprint 166 new 1: tarball size Summary visual confirmation)
  - Carry-over retained — seed #23 (rebase cumulative count fix checklist)
  - Follow-up (optional) 9 items (Sprint 165 carry-over unchanged)
