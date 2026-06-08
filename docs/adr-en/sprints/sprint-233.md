---
sprint: 233
title: "CI Scanner Install Hardening (retry + auth + direct download) + ADR-028 read-only kubeconfig Groundwork"
date: "2026-06-08"
status: completed
agents: [Oracle, Postman, Librarian, Critic]
related_adrs: ["sprint-232", "sprint-225"]
related_memory: ["sprint-window"]
topics: ["ci", "infra", "security"]
tldr: "After the Sprint 232 merge, main CI repeatedly went red on the #401/#402/#403 post-merge runs. Root cause: CI scanner install steps download from GitHub releases unauthenticated and without retry. (1) Trivy's install.sh resolves the tag via the GitHub release page → during intermittent releases outages (504) it fails with 'unable to find v0.69.2' → trivy not installed → scan exit 127. (2) gitleaks CDN 504. (3) promtool same risk. Round 1 (#403): 3-attempt retry on all three + Trivy env GITHUB_TOKEN + set -o pipefail (so curl failures aren't masked by sh/tar exit 0, Critic R1 P2). Round 2 (#404): with GITHUB_TOKEN the tag lookup succeeded, but the release-page lookup remained dependent on GitHub stability (intermittent 'unable to find') → removed install.sh's tag lookup and switched to a direct download of the fixed asset trivy_0.69.2_Linux-64bit.tar.gz (same as gitleaks/promtool), and bumped retries 3→5 with backoff i*5→i*10s. Live verification: post-merge main run 35 success / 0 failure (gitleaks + all 8 Trivy scans green). Add-on (#403): new docs/runbook/prod-readonly-kubeconfig.md (ADR-028 first implementation — prod-diag-readonly SA + short-lived token kubeconfig procedure; Critic R2 P1 narrowed namespaced perms to a Role+RoleBinding) + ADR-028 status updated to implementation-in-progress. Critic #403 R1 P2→R2 P1→R3 CLEAN, #404 R1 CLEAN."
---
# Sprint 233 — CI Scanner Install Hardening + ADR-028 read-only kubeconfig Groundwork

## Goal

- Eliminate the root cause of the repeated main CI post-merge reds (#401/#402/#403) after the Sprint 232 merge.
- As an add-on, produce the groundwork (procedure + manifests) for the read-only kubeconfig implementation of ADR-028 (block direct production changes).

## Background

- The #401/#402/#403 post-merge runs repeatedly failed in `Secret & Env Scan` (gitleaks) / `Trivy Scan`. PR checks passed (so the PRs merged), but main CI was left red and Trivy is a deploy-gate input.

## Root Cause

- **CI scanner install steps download from GitHub releases unauthenticated and without retry**:
  - **Trivy** (`ci.yml`): `curl install.sh | sh -s -- v0.69.2` — install.sh resolves the tag via the GitHub release page. During intermittent releases outages (504) it fails with `unable to find 'v0.69.2'` (exit 1) → trivy not installed → scan exit 127. (Sprint 225 had a similar Trivy blog pattern — that was apk_bust cache; this is the install download.)
  - **gitleaks** (`ci.yml`): downloads the GitHub releases asset via `curl | tar` without retry → CDN 504.
  - **promtool**: same pattern (not yet failed but same risk).

## Key Decisions

1. **Round 1 (#403)**: add a 3-attempt retry wrapper to all three install steps + Trivy `env GITHUB_TOKEN` (authenticated install.sh) + `set -o pipefail`. → without pipefail, `curl | sh` masks curl failure via sh's exit 0, so the loop breaks without retrying (Critic R1 P2).
2. **Round 2 (#404, the structural fix)**: with GITHUB_TOKEN the tag lookup succeeded (`found version`), but **the release-page lookup itself remained dependent on GitHub stability** (intermittent `unable to find`). → **remove install.sh's tag-lookup step and download the fixed binary asset (`trivy_0.69.2_Linux-64bit.tar.gz`) directly** (the same verified method as gitleaks/promtool). Bump retries 3→5, backoff i*5→i*10s (absorb multi-minute GitHub outages).
3. **The read-only kubeconfig is produced as a procedure** (server-executed). Aligned to the ADR-028 read-only profile (allow get/describe/logs/exec, block mutation). Namespaced permissions go in an algosu Role+RoleBinding; only cluster-scoped reads use a ClusterRole (Critic R2 P1).

## Work Summary (start `aba594f`, PR #403/#404)

- `1657308` (#403): `fix(ci)` retry on all three install steps + Trivy GITHUB_TOKEN + pipefail / `docs(runbook)` new prod-readonly-kubeconfig.md + ADR-028 status update / Critic R1 P2 (pipefail) and R2 P1 (namespace scoping) fixes.
- `cf9b4ae` (#404): `fix(ci)` remove Trivy install.sh tag lookup → direct asset download + retries bumped to 5.

## Verification

- ci.yml valid YAML (23 jobs), `install.sh` dependency removed, asset directly reachable HTTP 200 (external check).
- Runbook manifest multi-doc valid (ServiceAccount+Role+RoleBinding+ClusterRole+ClusterRoleBinding) · ADR gates (index 171, adr-en, links 0, doc-refs 0) + conversion OK.
- **Critic** (Codex gpt-5.5): #403 R1 [P2] pipefail → R2 [P1] namespace scoping → R3 CLEAN / #404 R1 CLEAN.
- **Live verification**: post-merge main run (`cf9b4ae`) **35 success / 13 skipped / 0 failure** — `Secret & Env Scan` (gitleaks) + `Trivy Scan — {8 services}` all green. Recurring red resolved.

## Lessons

1. **CI external dependencies (scanner binaries) require retry + auth + a stable download path** — GitHub releases frequently has intermittent 504/rate-limits. "It passed once" is not enough; recurring red is a structural-defect signal (reconfirming the Sprint 225 lesson).
2. **`curl | sh` / `curl | tar` pipes swallow curl failures without `set -o pipefail`** — `sh` in particular exits 0 on empty stdin (Critic R1 P2). A retry wrapper only works together with pipefail.
3. **"resolve tag then install" scripts (install.sh) are fragile at the release-page/API lookup** — if the version is known, downloading the fixed asset directly is more robust against GitHub instability (auth does not rescue the release-page lookup).
4. **A read-only SA bound via ClusterRoleBinding grants all-namespace permissions** — namespaced permissions (including exec/logs) belong in a Role+RoleBinding; only genuine cluster-scoped resources (nodes/namespaces/PV) belong in a ClusterRole, for least privilege (Critic R2 P1).

New pattern: **CI scanner install hardening pattern** (direct fixed-asset download + pipefail + N-attempt retry/backoff).

## Carryover

- **(server) ADR-028 SA apply + token issuance**: follow `docs/runbook/prod-readonly-kubeconfig.md` to apply `prod-diag-readonly` to aether-gitops + `kubectl create token` → read-only kubeconfig.
- **(server) B+ loki prod hardening gap**: use the runbook §6 prompt to verify live loki probe/securityContext presence → if absent, add to aether-gitops.
- (existing carryover) Sprint 230 rollout check · live /quiz verification · SP217 cutover · GA4 · problem_db · harness cron.
