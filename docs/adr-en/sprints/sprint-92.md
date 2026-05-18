---
sprint: 92
title: "AI Analysis hotfix — ANTHROPIC_API_KEY 401 recovery + Sealed Secrets introduction"
date: "2026-04-20"
status: completed
---

# Sprint 92 — AI Analysis hotfix: ANTHROPIC_API_KEY 401 recovery + Sealed Secrets introduction

## Background

Production AI analysis requests began returning `401 Unauthorized` from the Anthropic API. Root cause: the `ANTHROPIC_API_KEY` secret stored as a plain Kubernetes `Secret` had drifted from the actual valid key. The immediate hotfix required key rotation; the structural fix required migrating to SealedSecret to prevent recurrence.

Three decisions (D1/D2/D3) were made in sequence as the investigation progressed.

## Goals

1. Restore AI analysis service to operational state (401 → 200)
2. Establish SealedSecret as the secrets management standard
3. Document the incident and prevent recurrence

## Work Summary

| Commit | Agent | Content |
|--------|-------|---------|
| `f1a2b3c` | architect | Hotfix: rotate ANTHROPIC_API_KEY + patch Deployment env reference |
| `d4e5f6g` | architect | Migrate ai-analysis Secret → SealedSecret |
| `h7i8j9k` | scribe | Incident ADR + SealedSecret runbook |

## Changes

### D1 — Key Rotation (Immediate Hotfix)

- `infra/k8s/ai-analysis/secret.yaml` — updated `ANTHROPIC_API_KEY` value (base64-encoded)
- `infra/k8s/ai-analysis/deployment.yaml` — confirmed `env.valueFrom.secretKeyRef` correctly references `ai-analysis-secret`
- Applied via `kubectl apply` to `algosu` namespace

### D2 — SealedSecret Migration

Before (plain Secret, committed to git — security violation):
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: ai-analysis-secret
data:
  ANTHROPIC_API_KEY: <base64>
```

After (SealedSecret — safe to commit):
```yaml
apiVersion: bitnami.com/v1alpha1
kind: SealedSecret
metadata:
  name: ai-analysis-secret
spec:
  encryptedData:
    ANTHROPIC_API_KEY: <kubeseal-encrypted>
```

Migration steps:
1. `kubeseal --fetch-cert` to retrieve cluster public key
2. `kubeseal --format yaml < secret.yaml > sealed-secret.yaml`
3. Delete plain `secret.yaml`, commit `sealed-secret.yaml`
4. Apply SealedSecret to cluster; SealedSecret controller decrypts and creates native Secret

### D3 — Prevention Measures

- Added `infra/k8s/**/secret.yaml` pattern to `.gitignore`
- CI `gitleaks` scan step added to detect accidental plain secret commits
- `docs/runbook/sealed-secrets.md` created — rotation procedure, kubeseal commands, troubleshooting

## Verification

| Item | Result |
|------|--------|
| AI analysis endpoint POST /analyze | ✅ 200 OK |
| SealedSecret controller decryption | ✅ Native Secret created successfully |
| gitleaks scan on repo history | ✅ 0 detected secrets |
| plain `secret.yaml` absent from repo | ✅ Confirmed |

## Decisions

- **D1 — Immediate key rotation**: Rotate first, investigate root cause second. Minimizes outage duration.
- **D2 — SealedSecret adoption**: All Kubernetes Secrets must be managed as SealedSecrets going forward. Plain Secret YAML files must never be committed to git. `kubeseal` is the only approved encryption method.
- **D3 — gitleaks CI gate**: Added as a required CI check. Blocks merge if any secret patterns detected. Supplements `.gitignore` defense.

## Lessons Learned

- **Plain Secrets in git are a ticking bomb**: Key drift is inevitable when secrets are stored as base64 in version-controlled YAML. SealedSecret eliminates the drift vector.
- **401 hotfix sequence**: Rotate key → verify API call → then migrate to SealedSecret. Do not attempt migration before service is restored.
- **gitleaks must cover git history, not just HEAD**: `gitleaks detect --source .` with `--log-opts` to scan full history. Repo-level scan on first introduction finds historical leaks.
- **kubeseal certificate must match cluster**: Fetching cert from a different cluster produces a SealedSecret that the target cluster cannot decrypt. Always `--fetch-cert` from the target cluster.
