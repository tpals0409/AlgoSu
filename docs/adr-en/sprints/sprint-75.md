---
sprint: 75
title: "Credential Rotation — R1 'AlgoSu Token' PAT → gh CLI OAuth Transition + Runbook SSoT Establishment"
date: "2026-04-10"
status: completed
agents: [Oracle, Gatekeeper, Architect, Scribe, Explore]
related_adrs: [sprint-73.md, sprint-74.md]
---

# Sprint 75: Credential Rotation

## Context

Sprint 73-1 converted the plaintext PAT in `/root/aether-gitops/.git/config` to a credential helper, reducing exposure paths — but Gatekeeper V1-1 verification **confirmed only 1 of the 5 axes (.git/config)** and missed the remaining 4 axes (hosts.yml, GitHub Actions Secret, K8s Secret, filesystem full grep). As a result, the same PAT (`ghp_oHuu...`, scope: `admin:org, repo, workflow`) continued to be used in 3 places (CI `GITOPS_TOKEN`, K8s `argocd-repo-aether-gitops` password, gh CLI `hosts.yml`) — discovered only during Sprint 74 investigation and carried over as Sprint 73 G5 (retrofit needed).

Sprint 75 performed **(1) creation of a new runbook establishing a comprehensive usage checklist as SSoT**, **(2) Gatekeeper independent review for runbook quality assurance**, and **(3) credential rotation execution + verification** to finally resolve this carryover.

Additional finding during Gatekeeper independent review: the same PAT also remained in plaintext in the AlgoSu main repo's `.git/config`. Sprint 73-1 having applied the credential helper only to aether-gitops and missing AlgoSu was the most critical case in Sprint 73 G5.

During rotation execution, `gh auth login --web` device flow issued a **gh CLI OAuth user-to-server token (`gho_`)** instead of a classic PAT (`ghp_`). Functional equivalence was verified across 3 axes (API / credential helper / CI GitOps), and PM decided to "proceed as-is," confirming the transition from classic PAT → OAuth token.

## Decisions

### D1: New PAT Rotation Runbook + Comprehensive Usage Checklist SSoT (75-1)

- **Context**: The key to preventing Sprint 73 G5 recurrence is "a checklist that structurally prevents missing usage locations." The 2 existing runbooks (`runbook-github-token-relink.md`: user OAuth tokens, `runbook-key-rotation.md`: GitHub App Private Key) have different scopes.
- **Choice**: New `docs/runbook/pat-rotation.md` at 414 lines. 6-axis comprehensive usage checklist:
  - (a) `.git/config` — **dynamic enumeration with find required** (no hardcoding, root cause of Sprint 73 G5)
  - (b) `~/.config/gh/hosts.yml` — explicitly covers 2-entry coexistence case within 1 file
  - (c) `.github/workflows/*.yml` `secrets.*_TOKEN` grep
  - (d) `kubectl get secret -A` password/token field jq query
  - (e) Filesystem `grep -r` (`.claude/`, `.npm/_cacache/` filter)
  - (f) Confirming absence of secondary usage (`.docker/`, `.netrc`, `.git-credentials`, systemd, K8s ConfigMap/SA)
- **Code Paths**: `docs/runbook/pat-rotation.md` (new, completed across 3 commits)

### D2: Credential Rotation Execution — ghp_ Classic PAT → gho_ gh CLI OAuth (75-2/75-3)

- **Context**: Goal was to revoke old `ghp_oHuu...` + update 3 locations. `gh auth login --web` device flow issued an OAuth user-to-server token (`gho_`) instead of a classic PAT.
- **Choice**: PM decision to retain `gho_`. Rationale:
  - Consistent with Sprint 73-1 "no token string exposure" spirit — new token never exposed in server stdout/shell/history
  - §3.1 Positive verification across 3 axes (API / git ls-remote x2) + CI GitOps job success + ArgoCD Synced/Healthy all PASS
  - Runbook §2.5 stdin pipeline pattern for K8s secret injection — no shell variable intermediary
- **Execution sequence**: hosts.yml backup → logout → device flow login (PM browser device code `CD13-96F7` approved) → `gh secret set GITOPS_TOKEN` → kubectl patch stdin pipeline → argocd-repo-server rollout restart → PM revokes "AlgoSu Token" → Positive verification → CI push → ArgoCD refresh → closure proof → backup shred
- **Code Paths**: Server configuration changes (no tracked files), CI run `24225713081` success

### D3: Gatekeeper Independent Review Applied — Extending Sprint 73 P2 to Documentation Work (75-1b)

- **Context**: If the runbook draft targeting Sprint 73 G5 recurrence prevention was committed without Gatekeeper independent review, it would be a self-contradiction repeating Sprint 73's mistake.
- **Choice**: Extended Sprint 73 P2 "implementation + independent verification" pattern to documentation work. Gatekeeper dry-ran checklist items (a)~(e) on the server, **discovering gaps between runbook expected values and actual state**. Result: 8 patches derived (dynamic enumeration, filter expansion, zsh branching, stdin pipeline, Positive verification conversion, new closure proof, hosts.yml backup, rollback matrix expansion).
- **Alternatives**: (A) PM direct runbook review — requires PM involvement in security operations details, high cost. (B) Immediate rotation without runbook review — risk of Sprint 73 G5 recurrence.

## Patterns

### P1: Comprehensive Usage Checklist — find Dynamic Enumeration + Closure Proof (75-1)

- **Where**: `docs/runbook/pat-rotation.md` §1 + §3.4
- **When to Reuse**: All credential rotations (PAT, SSH key, API key, encryption key). Reusable by replacing only the specific grep patterns in the 6-axis checklist. 3 core principles: (1) **Dynamic enumeration** — don't use hardcoded path lists (use `find`-based approach). Sprint 73 G5's root cause was hardcoding 2 repos. (2) **Run twice — before + after rotation** — running the full survey only before rotation misses "plaintext newly created during the rotation process." (3) **Absence confirmation is also verification** — confirming "something does not exist" is the core of the checklist. An absent/clean judgment contains more information than "not checked."

## Gotchas

### G1: Plaintext PAT Remaining in AlgoSu `.git/config` — Sprint 73-1 Application Missed (75-0)

- **Symptom**: Gatekeeper independent review using `find /root -maxdepth 3 -name .git -type d` dynamic enumeration found `ghp_oHuu...` plaintext remaining in `/root/AlgoSu/.git/config`. Sprint 73-1's credential helper transition had only been applied to `aether-gitops`.
- **Root Cause**: Sprint 73-1 work manually enumerated only `aether-gitops` as the target, assuming "AlgoSu itself already has credential helper configured, so it's fine." However, when a plaintext PAT is embedded in `remote.origin.url` of `.git/config`, **the URL takes precedence over the global credential helper**, causing the helper to be ignored.
- **Fix**: `git remote set-url origin https://github.com/tpals0409/AlgoSu.git` (token removal) → confirmed `git push --dry-run` success via credential helper.
- **Lesson**: Inline PAT in `.git/config` URL takes precedence over credential helper settings. When transitioning to a credential helper, **all repo remote URLs must be checked** using `find` dynamic enumeration.

### G2: `gh auth login` Interactive Prompt — Headless Environment Requires Prior Logout (75-2)

- **Symptom**: Running `gh auth login --web` on OCI ARM headless server when an account is already logged in presents an interactive `"already logged in, re-authenticate?"` prompt that gets stuck in a non-interactive environment (Claude Code Bash tool).
- **Fix**: Prior `gh auth logout --hostname github.com` (inject stdin `printf 'y\n'`) → subsequent `gh auth login --web` proceeds to device flow without prompt.
- **Lesson**: In headless environments, gh CLI re-authentication must always follow **logout → login** 2 steps. Explicitly documented in runbook.

### G3: Classic PAT (ghp_) → OAuth Token (gho_) Transition — Awareness of Operational Model Change (75-2/75-3)

- **Symptom**: `gh auth login --web` issued a `gho_` token through the gh CLI OAuth app instead of `Settings > Personal access tokens (classic)`. PM noticed the mismatch with "Do we not need to issue a new token?"
- **Root Cause**: Runbook used the term "PAT rotation" while the actual execution method is OAuth device flow — term-reality mismatch.
- **Fix**: PM decision to retain `gho_` + generalized in runbook/ADR as "credential rotation." Documented operational differences for `gho_` (GitHub UI location, revoke method, expiration control).
- **Lesson**: When writing runbooks, **what type of credential is issued** must be specified. GitHub token prefixes like `ghp_` / `gho_` / `ghs_` / `github_pat_` each have different issuance paths and lifetime policies.

### G4: MEMORY.md "root + users.tpals0409" Expression Misreading — 1 File 2 Entries (75-1b)

- **Symptom**: MEMORY.md described "server gh CLI `~/.config/gh/hosts.yml` `oauth_token` in 2 places (root + users.tpals0409)." This could be misread as "2 files." Actual is: `/root/.config/gh/hosts.yml` 1 file with `users.tpals0409.oauth_token` + top-level `oauth_token` 2 entries coexisting.
- **Fix**: Explicitly stated in runbook §1(b): "2 entries coexist in one file, rewritten atomically with 1 `gh auth login --web` call." Recorded as Sprint 75 G4.
- **Lesson**: Shorthand notation in MEMORY.md can directly affect execution procedures. When describing credential locations, **both levels — file path + key path within the file — must be specified**.

## Metrics

- **Task count**: 6 (Sprint 74 ADR prior commit, 75-0 cleanup, 75-1 runbook draft, 75-1b Gatekeeper review incorporated, 75-1c headless environment patch, 75-2/75-3 rotation + verification) + 1 this ADR
- **Commits (AlgoSu)**: 3 (`5416168..ccab584`) + this ADR planned
  - `490270e` docs(adr): Sprint 74 ADR (prior hygiene cleanup)
  - `80fb99d` docs(runbook): Sprint 75-1 PAT rotation runbook (Gatekeeper review incorporated)
  - `ccab584` docs(runbook): Sprint 75-1c runbook §2.3 headless environment + prior logout specified
- **Commits (aether-gitops)**: 1 automatic (CI GitOps job blog image tag bump)
- **Files changed (AlgoSu)**: 2
  - `docs/adr/sprints/sprint-74.md` (new, Sprint 74 ADR prior commit)
  - `docs/runbook/pat-rotation.md` (new 440 lines, completed across 3 commits)
- **Server configuration changes (not tracked)**:
  - `/root/AlgoSu/.git/config`: remote.origin.url plaintext PAT removed
  - `/root/.config/gh/hosts.yml`: `ghp_` → `gho_` 2 entry transition
  - GitHub Actions Secret `GITOPS_TOKEN`: updated (`2026-04-10T03:58:10Z`)
  - K8s Secret `argocd/argocd-repo-aether-gitops` password: `ghp_` → `gho_`
  - ArgoCD `argocd-repo-server` Pod: credential cache invalidation rollout
- **CI consecutive success**: 1 (`24225713081`, GitOps job 4 seconds — aether-gitops clone+push with `gho_` token)
- **ArgoCD**: `Synced / Healthy`, no authentication errors after hard refresh
- **Sprint 73 carryover resolved**: 1 (R1 "AlgoSu Token" PAT rotation → credential rotation)
- **Sprint 73 G5 retrofit**: Complete (runbook §1 comprehensive checklist SSoT established + §3.4 closure proof)

## Related

- **Sprint 73 ADR** — Direct resolution of G5 (retrofit needed: Gatekeeper comprehensive usage location survey missing). Sprint 73-1 credential helper transition having been applied only to aether-gitops was finally confirmed + cleaned up in 75-0.
- **Sprint 74 ADR** — Sprint 74 ADR (`490270e`) that was untracked at Sprint 75 start was cleaned up as a prior commit for hygiene.
- **`docs/runbook/pat-rotation.md`** — The primary output of this sprint and SSoT for all future PAT/credential rotations. Incorporates 8 patches from Gatekeeper independent review.
