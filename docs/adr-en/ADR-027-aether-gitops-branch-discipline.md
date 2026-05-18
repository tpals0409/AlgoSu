# ADR-027: aether-gitops Branch Discipline — Enforce Work Branch + PR

- **Status**: Proposed
- **Date**: 2026-04-25
- **Sprint**: Sprint 130 (Wave C-2)
- **Decision maker**: Oracle
- **Related**: CLAUDE.md "Agent branch discipline (Sprint 126 D enforcement)", ADR-026 (incident summary)

---

## Context

### Current Flow
- **AlgoSu repo**: Since Sprint 126 D, all changes require a work branch + PR + Squash merge (Critic or user manual review guard)
- **aether-gitops repo (production GitOps)**: Direct push to main is permitted. The CI auto-deploy workflow (`gitops-update`) directly commits image tag bumps to main
- Result: No PR verification guard for aether-gitops changes

### Exposed Incidents (Sprint 130)
- **SealedSecret controller key rotation not synchronized** (23 days ago): 8 SealedSecrets accumulated without re-sealing. If PR verification had existed, the impact could likely have been analyzed at the controller cert change point
- **submission-service-secrets `INTERNAL_KEY_AI_ANALYSIS` missing from manifest**: Exists in cluster but absent from manifest → someone directly patched the cluster then failed to update the manifest. Not caught due to lack of PR verification
- **identity-service-secrets `GITHUB_TOKEN_ENCRYPTION_KEY` missing** (commit `f5f391d`): Added for gateway/github-worker but omitted for identity. Human error passed through due to absence of a single reviewer

### Constraints
- **Automated deploy commit**: CI (`gitops-update` job) directly pushes to main on every image tag update. Switching to work branch + PR requires workflow redesign (auto-merge or fast-forward)
- **GitOps immediate propagation**: Introducing a PR flow adds ~1 minute merge delay. Since selfHeal=true, operational impact is minimal

---

## Decision

Introduce the following discipline in the aether-gitops repo:

1. **Branch protection rule** (block direct push to main)
   - Require pull request before merging
   - Require linear history (squash or rebase)
   - Allow GitHub Actions bot bypass (for auto-deploy)

2. **Auto-deploy workflow redesign**
   - When CI updates an image tag, create a work branch (`auto-deploy/<sha>`) + auto-create PR + attach auto-merge label
   - Trigger auto-merge with a GitHub App token that has merge permissions (reuse Dependabot auto-merge App token pattern from Sprint 92 memory)

3. **Manual manifest change flow**
   - Work branch (`fix/sprint-NNN-<scope>`) + PR + Squash merge
   - PR description must specify change intent + verification plan
   - User manual review + merge (Critic not installed in aether-gitops)

---

## Consequences

### Positive
- Review guard on all manifest changes → blocks incidents like SealedSecret/Secret omissions
- Change intent traceable via PR description → easier incident debugging (would have caught partial omission like `f5f391d` in PR review)
- Single-step PR revert for recovery when incidents occur

### Negative
- Auto-deploy workflow redesign required (~medium-scale effort)
- Merge delay ~1 minute (including auto-merge). Minimal operational impact with selfHeal=true
- Additional GitHub App token permissions required (auto-create PR/merge)

### Neutral
- Consistency with AlgoSu repo flow → lower learning curve

---

## Implementation Tasks

- **Sprint 131 or later** as a separate track (excluded from Sprint 130 close scope)
- Steps:
  1. Add branch protection rule
  2. Redesign CI auto-deploy workflow + issue PR/auto-merge token
  3. Verify: compare incident pattern changes after 1 week of operation
- Owner: Architect + Postman

---

## References
- ADR-026 (Sprint 130 incident summary)
- CLAUDE.md "Agent branch discipline (Sprint 126 D enforcement)"
- Memory: `feedback_avoid_prod_direct_edit.md`
