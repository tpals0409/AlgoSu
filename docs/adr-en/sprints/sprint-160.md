---
sprint: 160
title: "Frontend deploy unblock forward-fix + per-service Trivy gate root-cause fix + alert hardening"
date: "2026-05-19"
status: completed
agents: [Oracle, Architect, Critic]
related_adrs: ["sprint-159"]
related_memory: ["sprint-window"]
---
# Sprint 160 — Frontend deploy unblock forward-fix + per-service Trivy gate root-cause fix

## Goals

- Immediate unblock of Sprint 159 PR #272 (frontend AI feedback parsing hotfix) that had been unreflected in production frontend for 4 hours (Phase A)
- Permanent root-cause fix of the regression — the `Update GitOps manifests` job guard (`needs.trivy-scan.result != 'failure'`) blocking GitOps update for every service when a single service fails Trivy (Phase B)
- Resolve the alert visibility gap where "git merge success" notifications did not surface the fact that some services were SKIPPED for 4 hours (Phase C, Sprint 159 seed #new4)
- Establish a formal cycle for handling production incidents: external read-only diagnosis → cross-check in this session → immediate unblock → root-cause fix → alert hardening → retrospective

## Decisions

- **Option B selected (precise 1-line manual PR)**: For Phase A unblock, chose **manual aether-gitops PR** over Option A (`workflow_dispatch + rebuild_all=true`, rebuilds all services) and Option C (trivial commit on `main`, history pollution). Minimal change scope (1 line in `kustomization.yaml`), reuses the already-built GHCR image (`main-505568a`), blast radius limited to frontend
- **Forward-fix policy inherited (Sprint 159 pattern)**: Advance GitOps tag with the exact SHA (`main-505568a`) instead of revert or trivial commit. The hotfix code is already safe (GHCR build complete + verified), so precise application is the normal flow
- **Artifact-based per-service Trivy gate (Phase B root-cause design)**: To work around the single-value limitation of matrix outputs, export `trivy-status/<service>.txt` as a per-service artifact (`trivy-status-<service>`). The deploy job downloads them via `pattern: trivy-status-* + merge-multiple: true` and performs per-service lookup. The matrix job's own result remains marked failed (preserving commit-level visibility)
- **Fail-closed security gate (Critic R1 P1 resolution)**: Combined with removing the `trivy-scan.result != 'failure'` guard, a defect could allow services with missing artifacts (infra fail / upload failure) to pass. Now any case where `STATUS != "pass"` (fail/missing/empty/other) is classified as SKIPPED. Only explicit `pass` proceeds
- **Deploy summary push-outcome branching (Critic R1 P2 resolution)**: The Phase C `Surface deploy summary` step's `always()` condition could output "✅ Deployed services" false-success messages even when GitOps push failed — direct contradiction of the sprint goal (accurate notifications). Branch on `steps.push_gitops.outcome`: anything other than `success` → "candidates only (NOT applied)". Reproduces the Sprint 155 pattern (self-contradiction detected after Critic R1 pass)
- **GitHub-native only**: Phase C alert hardening uses only `$GITHUB_STEP_SUMMARY` markdown + `::warning::` workflow command. Discord/Slack webhook integration requires secrets/channel decisions → deferred to a separate sprint

## Implementation (3 PRs squash merged + 1 aether-gitops PR, origin/main `2ec3747` → **`b385343`**)

| Repo | PR | Phase | Owner | Change | Lines |
|------|----|-------|-------|--------|-------|
| aether-gitops | [#6](https://github.com/tpals0409/aether-gitops/pull/6) | A·P0 | architect | `algosu-frontend` tag `main-4313561` → `main-505568a` 1-line advance | +1 −1 |
| AlgoSu | [#274](https://github.com/tpals0409/AlgoSu/pull/274) | B·P1 | architect + critic | Per-service Trivy gate + artifact communication + fail-closed | +73 −12 |
| AlgoSu | [#275](https://github.com/tpals0409/AlgoSu/pull/275) | C·P2 | architect + critic | STEP_SUMMARY + `::warning::` + push outcome branching | +58 |

### aether-gitops PR #6 — Phase A frontend deploy unblock

**Cross-check results (100% match with external read-only diagnosis)**:

| Fact | Verification |
|------|--------------|
| PR #272 CI run `26071766405` Trivy(ai-analysis) fail → `Update GitOps manifests` SKIPPED | `gh run view 26071766405 --json conclusion,status,jobs` |
| PR #272 touched `frontend/src/lib/feedback.ts` + tests + ai-analysis backend | `gh pr view 272 --json files` |
| PR #273 touched only `services/ai-analysis/Dockerfile` → frontend build inactive | same |
| `Update GitOps manifests` guard `needs.trivy-scan.result != 'failure'` (ci.yml:885) | direct code |
| PR #272 CI run `Build Frontend (Next.js)` job conclusion = `success` (GHCR image exists) | `gh run view 26071766405 --json jobs` |

**aether-gitops current state**: `kustomization.yaml` `algosu-frontend` newTag = `main-431356156f615c2e6b215baddaebf307d26c881b` (matches the 4313561 from external diagnosis). Other 7 service tags intact.

**Change applied**: python3 precise substitution — only the `algosu-frontend` entry advanced to `main-505568a229922bf2c77e9e425cfdc846c0eceb70`. Zero impact on other services.

**Merge**: `mergeStateStatus: CLEAN`, no CI (GitOps data repo), immediate squash merge → aether-gitops main HEAD `cb9f9a1` → `3f50eb7` → ArgoCD reconcile auto-sync → frontend pod rollout.

### AlgoSu PR #274 — Phase B per-service Trivy gate root-cause fix

**Regression scenario reconfirmed**: PR #272 CI run 26071766405 → `Build Frontend (Next.js)` ✅ + `Build AI Analysis (FastAPI)` ✅ + `Trivy Scan — ai-analysis` ❌ → `Update GitOps manifests` SKIPPED (frontend blocked too). After PR #273 (ai-analysis CVE patch) merge, only ai-analysis was updated in GitOps; frontend ran on the pre-hotfix image (`main-4313561`) for 4 hours.

**4-step design**:

1. **Record per-service results as artifacts in the trivy-scan matrix**:
   - Add `id: trivy_table` to the `Trivy scan (table)` step
   - New step `Record Trivy result for deploy gate` — write `pass`/`fail` line to `trivy-status/<service>.txt` (`always()` + `skip == 'false'`)
   - New step `Upload Trivy status artifact` — `trivy-status-<service>` artifact (always, retention 1 day)

2. **Remove aggregated `trivy-scan.result != 'failure'` guard from deploy job**:
   ```diff
   if: |
     github.ref == 'refs/heads/main' && !cancelled() &&
     needs.secret-scan.result == 'success' &&
   - needs.trivy-scan.result != 'failure' &&
     (needs.build-services.result == 'success' || ...)
   ```

3. **Two new deploy job steps**:
   - `Download Trivy status artifacts` — `pattern: trivy-status-* + merge-multiple: true` flattening
   - `Probe Trivy status artifacts (Sprint 157 seed #29)` — directory listing + per-service result echo

4. **Update image tags logic redesigned**:
   - Collect `CANDIDATES` (build success + detect-changes active service)
   - Per-service lookup of `trivy-status/<svc>.txt` → fail services moved to `SKIPPED_TRIVY`
   - Only passing services have their `kustomization.yaml` tag updated
   - Outputs `updated` / `skipped_trivy` exposed (Phase C input)

**Critic R1 P1 resolution cycle**:

> "When a candidate service has no `${SVC}.txt` status file, this loop treats it as passing and updates its GitOps tag. ... Treat missing or non-`pass` status as skipped/failed for the service."

→ Previous logic (`if [ -f "$STATUS_FILE" ] && [ "$(cat ...)" = "fail" ]`) only classified explicit fails, missing files passed → security gate bypass. Fixed: any case where `STATUS != "pass"` (fail/missing/empty/other) is SKIPPED. **Fail-closed security gate**.

```bash
STATUS=$(cat "$STATUS_FILE" 2>/dev/null || echo "missing")
if [ "$STATUS" != "pass" ]; then
  SKIPPED_TRIVY="${SKIPPED_TRIVY} ${SVC}"
  echo "  ⚠ algosu-${SVC} SKIPPED (Trivy status: ${STATUS} — ...)"
  continue
fi
```

**Critic R2 Clean** ✅: "The change makes the deploy gate require an explicit per-service Trivy pass status and treats missing/empty/failed statuses as skipped, which is consistent with the fail-closed intent. I did not identify a discrete regression introduced by this commit."

### AlgoSu PR #275 — Phase C deploy alert hardening

**Sprint 159 seed #new4 fulfilled**: Two layers of explicit visibility using `deploy.outputs.skipped_trivy` exposed by Phase B.

1. **deploy job `outputs:` declaration**:
   ```yaml
   outputs:
     updated: ${{ steps.update_tags.outputs.updated }}
     skipped_trivy: ${{ steps.update_tags.outputs.skipped_trivy }}
   ```

2. **`Surface deploy summary` step (`always()`)** — markdown to `$GITHUB_STEP_SUMMARY`:
   - `### ✅ Deployed services` section + each service tag
   - `### 🚫 SKIPPED (Trivy fail or status missing)` section + remediation guidance
   - When SKIPPED is non-empty: `> ⚠️ "git merge success" ≠ "deploy success"` blockquote warning

3. **`notify` job `Warn on Trivy-skipped services` step** — `if: needs.deploy.outputs.skipped_trivy != ''`:
   - 3 `::warning::` lines — service list + production image not advanced + recurrence prevention guidance

**Critic R1 P2 resolution cycle** (sprint-goal self-contradiction detection):

> "When `git commit` or `git push` fails after `update_tags` has populated `UPDATED`, this `always()` summary still runs and labels those services as deployed even though the GitOps repo was not updated. ... gate the 'Deployed services' section on the commit/push result or phrase these as candidates when the deploy job has failed."

→ Phase C's purpose is "accurate visibility of deploy results" but false-success messages on push fail = direct contradiction with the sprint goal. Fix:
- Add `id: push_gitops` to the `Commit and push to aether-gitops` step
- Branch in the summary step on `steps.push_gitops.outcome`:
  - `success` → "✅ Deployed services"
  - otherwise → "🚫 GitOps push failed" + "candidates only — production is unchanged" + intended tag with `(NOT applied)` suffix

**Critic R2 Clean** ✅: "does not introduce an obvious workflow-breaking issue".

## New Patterns

1. **Single-sprint 6-phase cycle: external read-only diagnosis → this-session cross-check → immediate hotfix → root-cause fix → alert hardening → ADR** — Full cycle from production incident to retrospective within a single sprint. One evolution beyond Sprint 159 (simple hotfix + ADR)

2. **Production hotfix option comparison table + single user selection followed by immediate execution** — Options A (workflow_dispatch rebuild_all) / B (manual aether-gitops PR) / C (main trivial commit) compared across change-scope/risk/duration/evaluation axes → user selects Option B → plan executed as-is. Direct inheritance of Sprint 156 option-selection pattern

3. **Artifact-based per-service gate communication pattern** — Workaround for the GitHub Actions matrix output single-value limitation. `<key>-<dim>` artifact names + `pattern + merge-multiple` flattening → deploy job performs per-service lookup. Matrix job result remains marked failed (commit-level visibility). Standard workaround pattern for matrix output limitations

4. **Fail-closed security gate principle** — Critic R1 P1 institutionalization. All cases of `STATUS != "pass"` (fail/missing/empty/other) blocked. Only explicit `pass` proceeds. Infra fail / artifact upload failure auto-blocked. Phase B's essential safety principle

5. **Critic R1 P2 sprint-goal self-contradiction detection reproduced (Sprint 155/159 pattern reinforced)** — Phase C's `always()` summary false-success messages directly contradict Phase C's essence (accurate notifications). R1 passes → self-contradiction detected just before R2. Second self-contradiction detected in this sprint (Phase B P1 + Phase C P2)

6. **Forward-fix policy inheritance** — Sprint 159 base image patch pattern reproduced as Phase A. Avoid revert, advance GitOps tag with the exact SHA. Code is already safe (GHCR build complete + verified), so precise application is normal

7. **Alert hardening using only GitHub-native** — `$GITHUB_STEP_SUMMARY` + `::warning::` workflow command. No additional secrets / webhooks needed. Discord/Slack integration requires secrets/channel decisions → split into a separate sprint. Incremental hardening policy

8. **Critic R1 messages cite precise locations** — Critic cites the form `line:973-979` / `line:1033-1036` with the exact location + regression scenario + fix direction. Architect-side fix cycle wraps up in 1 iteration in this sprint. Effect of Codex cross-review's location-citation precision

9. **PR-stage CI green itself acts as the first regression gate** — After Phase B/C changes, the PR's CI 27 jobs SUCCESS itself serves as the first regression gate. Empirical validation of the Trivy fail scenario is deferred to a separate sprint

## Lessons

1. **External read-only diagnosis sessions must be cross-checked** — The external analysis was 100% accurate, but 4 cross-checks on our side (`gh run view` / `gh pr view --json files` for both PRs / ci.yml deploy job guard + matrix outputs limitation) crystallized the actionable plan. Two-stage verification (external diagnosis + this-session cross-check) is the safe pattern

2. **`Update GitOps manifests` guard's matrix-aggregated limitation** — `needs.<matrix-job>.result` exposes only a single value (one service fail = aggregate result=failure). Using matrix per-service results requires artifact / job-output / separate-job patterns. The crux of the root-cause regression

3. **The trap of fail-open security gates** — A "file exists and is fail → block" pattern lets missing files pass = fail-open. Security gates must always be fail-closed (only explicit pass proceeds). Core lesson of Critic R1 P1

4. **Sprint-goal self-contradictions remain detectable after Critic R1 passes** — Phase B R1 P1 (sprint goal = "one service fail does not block all services" yet missing passes = another security regression) / Phase C R1 P2 (sprint goal = "accurate deploy alert" yet push fail produces false-success message). The Auto-Critic's sprint-consistency guard effect reconfirmed twice in this sprint. Sprint 155 → 159 → 160 pattern reinforced

5. **Production hotfix option comparison tables are the critical user-decision tool** — Options A/B/C compared across change-scope/risk/duration/evaluation 4 axes → single user selection → plan executed immediately. Without recommendation marks the user bears the decision burden. The 3-stage separation: comparison + recommendation marks + user selection

6. **PR-stage Trivy SKIP + only-post-merge actual execution = regression undetectable** (Sprint 159 lesson reconfirmed) → seed #new1 (enable PR-stage Trivy) priority raised. Phase B change is the root-cause fix, but PR-stage SKIP needs a separate sprint

7. **Conjunction of base-image regression + matrix-gate regression** — Sprint 159's ai-analysis Trivy fail itself is the conjunction of (a) absence of regular base-image refresh automation (seed #new2) and (b) matrix-gate limitation (this sprint's Phase B). Both must be blocked for complete safety

8. **GitOps data repos have no CI → manual review is the only safety net** — aether-gitops PR #6's `mergeStateStatus: CLEAN` is due to CI absence. No auto-verification. This sprint's change is precise 1-line low-risk, but more complex GitOps changes will need stronger manual review (separate sprint)

9. **"git merge success" message ambiguity partially resolvable with GitHub-native alerts** — Sufficient visibility achieved with STEP_SUMMARY + `::warning::` even without Discord/Slack integration. Phase C's core finding. Stronger integration is incremental

## Sprint 161 Carry-Over Seeds

### Sprint 159 carry-over (3 maintained, 1 fulfilled this sprint)

- Seed #new1: Enable PR-stage Trivy scan (matrix conditional change) — priority raised per this-sprint lesson #6
- Seed #new2: Base image refresh automation (Dependabot Dockerfile updater or weekly cron) — one axis of this-sprint lesson #7 conjunction
- Seed #new3: Apply the same envelope to `_parse_group_response` raw_text fallback
- Seed #new4: ✅ **Fulfilled by this sprint's Phase C**

### Sprint 160 new seeds

- Seed #new5: PR-stage deploy gate simulation (dry-run mode) — strengthen root-cause-change regression blocking
- Seed #new6: Automatic PR template for aether-gitops `kustomization.yaml` changes — consistency on Phase A pattern reproduction
- Seed #new7: `$GITHUB_STEP_SUMMARY` standardization — unify summary markdown across other jobs (build/test/quality)

### Sprint 158 carry-over

- Seed #30: Auto-detect Korean residue in build artifacts via CI step (allowlist-based)
- Seed #31: Auto-template i18n match checklist with 3 layers (meta/UI/body)

### Sprint 157 carry-over

- Seed #24: Auto plan-template checklist for i18n bilingual obligation
- Seed #26: docs/adr/README.md paths filter negation
- Seed #27: CI build-blog `ls out/` artifact existence-verification step
- Seed #28: check-adr-links.mjs auto-ROOT detection
- Seed #29: ✅ **Fulfilled by this sprint's Phase B** (probe step accompaniment)

### UAT user-direct (17-sprint accumulation)

- Seed #5: Programmers resubmission grading-pass confirmation
- Seed #9: English environment + production Grafana CB dashboard ai-analysis visual alignment

### Carry-over maintained

- Seed #18: Pre-merge domain-fact cross-check automation for blog posts
- Seed #23: Plan-template "post-rebase cumulative-count fix" checklist

### Optional follow-ups

- create/edit page.tsx category UI / Programmers URL auto-category inference / SQL problem data backfill / coverage-gate `skipped` removal / post-merge pre-deploy gate / prom-client Case B~D auto-check / `.claude-tools/` Phase 2 actual deletion / `(adr)` layout split

## Verification

| Item | Result |
|------|--------|
| aether-gitops PR #6 | MERGED (`3f50eb7`) — ArgoCD reconcile started |
| Phase A frontend rollout + hotfix visual verification | Pending user external read-only session cooperation |
| AlgoSu PR #274 (Phase B) CI | 27/27 SUCCESS, mergeStateStatus CLEAN, Critic R1 P1 → R2 clean |
| AlgoSu PR #275 (Phase C) CI | 27/27 SUCCESS, mergeStateStatus CLEAN, Critic R1 P2 → R2 clean |
| YAML syntax (`python3 yaml.safe_load`) | Both PRs OK |
| This PR ADR (Phase D) CI | To be verified by this PR itself |

## Branch Discipline ✅ 28 sprints of consecutive compliance

- All 3 PRs (AlgoSu 2 + aether-gitops 1) on new branches + Squash merge
- 0 direct commits to main
- 0 `--no-verify` uses
- 2 Critic R1/R2 cycles (Phase B/C each)

## Changed Files

- `.github/workflows/ci.yml` — trivy-scan matrix artifact export + deploy job per-service gate + STEP_SUMMARY + notify warning (Phase B/C combined, +131 −15)
- `aether-gitops:algosu/overlays/prod/kustomization.yaml` — frontend tag advance (Phase A, +1 −1)
- `docs/adr/sprints/sprint-159.md` — backfill (Sprint 159 KR body)
- `docs/adr-en/sprints/sprint-159.md` — backfill (Sprint 159 EN body)
- `docs/adr/sprints/sprint-160.md` — this ADR
- `docs/adr-en/sprints/sprint-160.md` — this ADR EN
