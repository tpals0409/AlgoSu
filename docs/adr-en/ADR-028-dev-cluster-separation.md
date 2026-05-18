# ADR-028: Dev Server (k3d / Separate Dev Cluster) Separation — Structural Block on Direct Production Modification

- **Status**: Accepted-Partial — Option A (local k3d) Kustomize overlay separation complete; kubeconfig read-only separation + Claude Code execution environment migration not yet confirmed
- **Date**: 2026-04-25 (proposed), 2026-04-27 (applied state confirmed)
- **Sprint**: Sprint 130 (proposed), Sprint 133 (applied state confirmed by user)
- **Decision maker**: Oracle
- **User request**: 2026-04-25 "direct modification on the server is not a good direction"
- **User confirmation**: 2026-04-27 "the dev server is already separated"
- **Related**: ADR-027 (aether-gitops branch discipline), ADR-026 (incident summary)

---

## Context

### Current Work Environment
- **Production cluster**: OCI ARM (Ubuntu 24.04, k3s v1.34.4)
- **Claude Code execution location**: Same OCI ARM instance as production cluster (kubeconfig permission = cluster-admin)
- **Development environment**: k3d (specified for local machine use, but actual usage frequency unknown; not synchronized in memory)
- Result: All diagnosis and work happens in an environment where direct `kubectl patch / edit / apply / rollout restart` on the production cluster is possible

### Anti-patterns Exposed (Sprint 130)

**Wave A-2 Track 1**: `GITHUB_TOKEN_ENCRYPTION_KEY` missing from identity-service-secrets → SealedSecret manifest PR merged but controller unseal fails → **temporary recovery via direct `kubectl patch` on cluster Secret**

**Root problem**:
- GitOps consistency broken (cluster ≠ manifest, temporary state)
- Changes not traceable (kubectl commands don't appear in git history)
- Same work cannot be validated in another environment (production = only environment)
- **Blast radius 100% production on incident**

### User Priority (Directly Stated)
- "Since direct modification on the server is not a good direction, we will quickly resolve the issue within this sprint and then proceed to work on the dev server going forward."

---

## Decision

Separate a **development environment (dev)** from the production cluster. All changes are validated in dev before being reflected in production via GitOps.

### Option Comparison

| Option | Cost | Production similarity | dev↔prod sync | Pros/Cons |
|---|---|---|---|---|
| **A. Local k3d** | Free | Medium (ARM difference) | Manual (matrix manifests) | Lightest. ARM/x86 difference regression possible |
| **B. Separate OCI ARM instance (dev)** | Additional cost | High (same ARM/k3s) | Semi-auto (sync script) | Closest to production. Cost/resource burden |
| **C. dev namespace inside production cluster** | Free | Very high | None (same cluster) | Insufficient isolation from production. Blast radius remains |
| **D. GitHub Codespaces / external dev** | Free~paid | Medium | Git-driven | External dependency, network latency |

**Recommendation**: In Sprint 131, **A + B combination** — daily development on k3d, incident verification on dev OCI instance. Or **B alone** after reviewing OCI Free Tier constraints.

### Production Cluster kubeconfig Restriction
- Production cluster kubeconfig restricted to **read-only permissions** (get/describe/logs/exec allowed; patch/apply/edit/delete blocked)
- Modification permissions limited to ArgoCD service account
- If production hotfix is unavoidable: Separate ADR record required + GitOps post-hoc consistency recovery PR mandatory (consistent with memory `feedback_avoid_prod_direct_edit.md`)

### Claude Code Execution Environment Migration
- Current: Production OCI ARM instance
- After migration: Dev environment (k3d or separate instance)
- When production data diagnosis is needed: Use production read-only kubeconfig as a separate context

---

## Consequences

### Positive
- Direct production modification anti-pattern **structurally blocked** (kubeconfig permissions)
- Pre-validation in dev before production deployment → reduced incident risk
- Eliminates the "direct production cluster patch + post-hoc GitOps consistency recovery" flow seen in Sprint 130
- Provides incident reproduction environment (debug without production impact)

### Negative
- Additional dev infrastructure cost (if Option B/D is chosen)
- Manifest sync complexity (dev/prod overlay management)
- Initial setup cost (~1 week)
- Additional steps when diagnosing production issues (kubeconfig switch)

### Neutral
- ArgoCD selfHeal=true remains unchanged on production cluster — automatic recovery on incident is unchanged

---

## Implementation Tasks (Sprint 131 Starting Point)

1. **Decide dev environment option** — user/PM review then choose A/B/C/D
2. **Set up dev cluster** (according to chosen option)
3. **Production kubeconfig read-only separation** (everyone except sealed-secrets-controller / ArgoCD service account gets read-only)
4. **Migrate Claude Code execution environment** (to dev environment)
5. **Verify** — 1 week of operation + evaluate change flow stability

Owner: Architect (infra design) + Gatekeeper (kubeconfig permission separation)

---

## Applied State (Confirmed 2026-04-27)

### Applied — Option A (Local k3d)
- **Kustomize overlay separation structure**: `infra/overlays/{dev,staging,prod}/kustomization.yaml`
  - `dev`: `:dev` image tag, k3s single node / k3d local, minimal resources (1 replica)
  - `staging`: staging overlay
  - `prod`: production overlay
- **Base manifests**: `infra/k3s/` (gateway, frontend, postgres, postgres-problem, redis, rabbitmq, minio, identity-service, problem-service, submission-service, github-worker, ai-analysis-service and others: 8 Deployments + infra)
- **DEPLOYMENT.md L115 stated**: `revisionHistoryLimit: 3` policy (however, actual application to base manifests is pending — Sprint 134 C-1 remaining work)
- **User confirmation**: 2026-04-27 "the dev server is already separated"

### Not Yet Confirmed / Needs Further Review
- **Production cluster kubeconfig read-only separation** — need to confirm whether applied
- **Claude Code execution environment migration** — need to confirm whether migrated from production OCI ARM instance to dev environment
- If these 2 items are not applied, the "direct production cluster patch" anti-pattern from Sprint 130 Wave A-2 Track 1 remains structurally un-blocked

### Sprint 134+ Remaining Tasks
- Confirm whether production kubeconfig read-only is applied + apply if needed
- Confirm Claude Code execution environment separation policy + migrate if needed
- C-1: Apply `revisionHistoryLimit: 3` to 8 Deployment manifests in `infra/k3s/` (restore DEPLOYMENT.md policy consistency)

---

## References
- ADR-026 (Sprint 130 incident summary — direct production patch anti-pattern incident case)
- ADR-027 (aether-gitops branch discipline — combined with this ADR for dual GitOps consistency guards)
- Memory: `feedback_avoid_prod_direct_edit.md`
- CLAUDE.md "k3d (dev) / k3s (production, OCI ARM)" separation principle — Kustomize overlay level applied; kubeconfig level application status not yet confirmed
