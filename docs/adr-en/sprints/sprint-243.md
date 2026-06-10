---
sprint: 243
title: "Supply chain, CSP spike, CI cleanup (ADR-030 roadmap item 5 — closure)"
date: "2026-06-10"
status: completed
agents: [Oracle, Gatekeeper, Conductor, Critic, Scribe]
related_adrs: ["ADR-030", "sprint-242", "sprint-238"]
related_memory: ["sprint-window"]
topics: ["security", "ci", "supply-chain"]
tldr: "ADR-030 remediation roadmap item 5 — final sprint closing the roadmap. [A] S-7: SHA-pinned 8 third-party actions across 16 references (f8e1d22) + new check-action-pins.mjs drift guard + secret-scan job connection (3ae946d) + download-artifact 4 locations unified to @v6. Oracle verified SHA↔tag consistency and major-tag targets via gh api (behavior unchanged). [B] Q-6: extracted inline python3 -c to scripts/ci/update-image-tags.py (6523ddd), argparse + zero-match stderr warning, 3-case fixture + byte-identical output verification. [C] S-3: nonce spike decision = deferred (Monaco unsafe-eval not resolvable with nonce / marginal real gain / force-dynamic cache loss / ADR-029 SSOT multi-repo cost). Critic auto-critic R1 gatekeeper P2 (actions recursive search) → eedb3c2 fix → CLEAN. Conductor R1 CLEAN (Low 1: helper unit tests missing → deferred). Two incidents: gatekeeper session-limit interruption; harness status misrecord recurrence (2nd time). ADR-030 roadmap fully closed."
---
# Sprint 243 — Supply chain, CSP spike, CI cleanup (ADR-030 roadmap item 5 — closure)

## Goal

- ADR-030 remediation roadmap item 5 (final) — close the roadmap by handling the 3 remaining items: S-7 supply-chain hardening, S-3 CSP nonce spike (decision only), Q-6 CI helper extraction.
- Code changes are behavior-preserving (CI validation flow unchanged, service coverage unaffected).
- Critic merge gate required.

## Context

- `/start` argument: process ADR-030 §Decision roadmap item 5.
- **S-7**: GitHub Actions third-party actions pinned to major tags (mutable) — upgrading to SHA pins (immutable) eliminates the supply-chain attack surface. Registered as "optional" in the Sprint 238 audit due to Dependabot mitigation.
- **S-3**: Spike to determine whether `unsafe-inline` CSP can be removed — verify Next.js App Router nonce support + AdSense/Monaco dependency, then decide apply or defer. A decision-only spike sprint.
- **Q-6**: `ci.yml` deploy job contains an inline `python3 -c` script (kustomization.yaml image tag update) that is untestable — extract to a `scripts/ci/` helper (compute-deploy-gate.sh precedent).

## Work summary (Gatekeeper + Conductor, 4 commits total)

### A — S-7 GitHub Actions SHA pinning (Gatekeeper, commit `f8e1d22`)

**8 third-party actions pinned across 16 references**

| Action | Version | Occurrences |
|--------|---------|-------------|
| `dorny/paths-filter` | v4.0.1 | 1 |
| `wagoid/commitlint-github-action` | v6.2.1 | 1 |
| `marocchino/sticky-pull-request-comment` | v2.9.4 | 1 |
| `docker/setup-qemu-action` | v4.1.0 | 3 |
| `docker/setup-buildx-action` | v4.1.0 | 3 |
| `nick-fields/retry` | v3.0.2 | 3 |
| `docker/build-push-action` | v7.2.0 | 3 |
| `dependabot/fetch-metadata` | v2.5.0 | 1 |

- Migration: `owner/repo@vX.Y.Z` → `owner/repo@<40-hex-sha> # vX.Y.Z` (version comment retained for Dependabot tracking).
- **Additional**: `actions/download-artifact` was at @v4 in one ci.yml location — unified to @v6 to match all upload references (4 locations aligned).
- **Oracle gh api full verification**: confirmed SHA↔tag match via `gh api repos/<owner>/<repo>/git/ref/tags/<tag>` for each action + confirmed major tag targets (refs/tags/v2, refs/tags/v3, etc.) point to the same SHA → **behavior unchanged**.
- **Note**: marocchino/sticky-pull-request-comment `@v2` is a branch ref (tracking v2 branch head) — snapshotting to a fixed SHA is the correct approach.

---

### A — S-7 drift guard + secret-scan connection (Gatekeeper, commit `3ae946d`)

**New `scripts/check-action-pins.mjs`**

- Scans all `uses:` lines under `.github/workflows` and `.github/actions`.
- Exempts first-party owners (`actions/`, `github/`) and local paths (`./`).
- Exits with code 1 if any third-party action is not pinned to a 40-hex commit SHA.
- Validated: all 16 current references pass (EXIT=0); injecting an unpinned reference triggers EXIT=1.

**Added execution step to `ci.yml` secret-scan job** — automatically blocks pin omissions when new workflows or actions are added.

---

### B — Q-6 CI helper extraction (Conductor, commit `6523ddd`)

Extracted inline `python3 -c` from the `ci.yml` deploy job `update_tags` step to `scripts/ci/update-image-tags.py`.

**Design decision (compute-deploy-gate.sh precedent)**:
- GHA-context-dependent logic (candidate collection, Trivy gate) remains inline in ci.yml.
- Only the pure transformation logic (kustomization.yaml `images[]` tag update) is extracted — enabling standalone testing.

**Improvements at extraction (behavior unchanged)**:
- `argparse`: `--sha` (required), `--file` (default: kustomization.yaml), variadic service names.
- Zero-match service emits a `stderr` warning (the former inline was silent — improved visibility).

**Verified**: 3-case fixture (update target / non-target / no match) tested against live script + byte-identical output diff confirmed before vs. after extraction.

---

### Critic auto-critic R1 fix (commit `eedb3c2`)

Cross-review of Gatekeeper output (`f8e1d22`, `3ae946d`): **1 P2 finding**.

**P2 (`eedb3c2`)**: `check-action-pins.mjs` `collectFiles()` only scanned direct children of `.github/actions` (one level deep) — nested composite actions (`.github/actions/a/b/action.yml`) could bypass the SHA pin guard. Replaced with a recursive `collectActionManifests()` function that collects all `action.yml`/`action.yaml` files. The `existsSync(ACTIONS_DIR)` guard is preserved.

Re-review: **✅ CLEAN**.

---

### S-3 CSP nonce spike decision

Spike investigation result: **deferred**.

| Constraint | Detail |
|------------|--------|
| Monaco Editor `unsafe-eval` | Next.js nonce addresses `script-src` nonce injection — Monaco uses `eval()` internally; removing `unsafe-eval` cannot be resolved by nonce alone. Real security gain is marginal |
| force-dynamic conversion cost | Generating and injecting a per-request nonce requires converting all routes to SSR/force-dynamic → loss of ISR and CDN caching |
| ADR-029 SSOT migration cost | CSP SSOT is the aether-gitops Traefik middleware — changes must be coordinated across the multi-repo setup |
| AdSense dependency | AdSense is not connected to `frontend` (not yet integrated) — not a constraint |
| Next.js 15 nonce support | `proxy.ts` nonce injection is technically supported (confirmed) — but the above costs outweigh the benefit |

**Re-evaluate triggers**: ① Monaco replacement completed ② Decision to convert all routes to SSR ③ ADR-029 Traefik SSOT re-discussion.

---

## Critic

### Auto-critic (Gatekeeper S-7 + drift guard)

- **R1 [P2]**: `.github/actions` recursive traversal missing → `eedb3c2` fix → **R2 CLEAN**.

### Auto-critic (Conductor Q-6)

- **R1**: **✅ CLEAN** (Low 1: `update-image-tags.py` unit tests absent — deferred for review).

---

## Incidents

1. **Gatekeeper first run interrupted by session limit**: Claude session limit exceeded mid-way through SHA pin editing. Modified working tree preserved — Oracle verified partial edits directly and re-dispatched with a "continue from verified state" note. `f8e1d22` committed successfully.

2. **Harness status misrecord recurrence (same Sprint 242 bug, 2nd occurrence)**: Gatekeeper inbox result file was `status: success` and present on disk, but oracle-runner recorded `completed_no_result` → Oracle marked conductor task as `cancelled` → Oracle verified inbox file directly, corrected state, and re-dispatched conductor. inbox file = SSOT principle re-confirmed. Additionally, the watcher emitted a false positive on a stale `.out` file (resolved by mtime guard, normal after watcher restart). Root-fix deferred.

---

## Key decisions

1. **SHA pins require a version comment for Dependabot compatibility**: `@<sha> # vX.Y.Z` — without the comment tag, Dependabot cannot track the version. The comment is the Dependabot parsing anchor.
2. **Drift guards must recurse**: composite actions can be nested, so single-level traversal leaves a guard gap. Critic P2 caught this.
3. **CI helper extraction boundary — GHA-context logic stays inline**: Same principle as compute-deploy-gate.sh. Only pure transformation logic is extracted so the helper can be tested independently.
4. **CSP unsafe-inline removal prerequisite = Monaco unsafe-eval removal**: Even when nonce is technically feasible, if Monaco still uses eval(), the security gain is negligible. Cost-benefit analysis codified in ADR.

---

## Verification

- **ADR gates**:
  - `node scripts/check-adr-index-count.mjs --strict` — EXIT=0 (index **181**)
  - `node scripts/check-adr-en-coverage.mjs --strict` — EXIT=0 (EN coverage)
  - `node scripts/check-adr-links.mjs` — EXIT=0
  - `node scripts/check-i18n-residue.mjs --strict` — EXIT=0
  - `node scripts/check-doc-refs.mjs` — EXIT=0
  - `node scripts/check-adr-conversion.mjs` — EXIT=0
- **CI behavior verification**:
  - `node scripts/check-action-pins.mjs` — EXIT=0 (all 16 references SHA-pinned)
  - SHA↔tag consistency verified via gh api — Oracle direct validation
  - 3-case fixture + byte-identical diff — Q-6 helper output matches pre-extraction inline
- **Branch**: `chore/sprint-243-supply-chain-csp-ci` (4 commits: `f8e1d22`·`3ae946d`·`6523ddd`·`eedb3c2`)

---

## Lessons

1. **Supply-chain guards must recurse**: Composite actions can be nested; single-level traversal is an incomplete guard. Never assume a flat `.github/actions` structure when writing path scanners (Critic P2 catch).
2. **Spike decisions must codify cost-benefit**: Like S-3 — "technically feasible" is insufficient if costs exceed benefits. Writing the rationale into the ADR blocks re-running the same analysis in future discussions.
3. **Harness misrecord: inbox file is the SSOT recovery path**: Same bug 2nd occurrence with Sprint 242. `status: success` in inbox overrides the state file. The recurring pattern signals that the harness bug priority should be raised.
4. **Session-limit interruptions are recoverable via working tree preservation**: Even if a Claude session terminates, the git staging area and modified working tree persist. Oracle verification + re-dispatch with a resume note is the recovery path.

---

## Carry-over seeds for next sprint

**ADR-030 roadmap fully closed** — remaining backlog: Q-4 libs spike (user-confirmed deferred), S-3 re-evaluation triggers (Monaco replacement first).

**Technical debt seeds (priority order)**:
- Critic task JSON status misrecord harness bug (oracle-reap/runner — **2nd recurrence, priority raised**)
- CI helper (`update-image-tags.py`) unit tests — Low (Conductor Critic R1) deferred
- Synchronous log singleton context limit (transient scope migration review)
- `errors` / `problems` i18n namespace text mismatches
- ConfirmStep `tErrors` pre-existing defect
- Inline style tokenization (Tailwind token class migration)

**Ongoing carry-overs**:
- `Quality — docs` required gate promotion review
- Harness checkup slot (pane guard permanent fix + window decoration root fix + Codex model pin)
- GA4 3 items · live SEO · harness cron · webhook regenerate · accumulated UAT · 3 blog post candidates
