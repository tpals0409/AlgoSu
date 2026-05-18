---
sprint: 73
title: "Security Hotfix + Blog Visual Carryover Closure (Sprint 70~72 Carryover 7 Items Parallel Processing)"
date: "2026-04-10"
status: completed
agents: [Oracle, Herald, Librarian, Palette, Gatekeeper, Scout, Scribe]
related_adrs: [sprint-72.md, sprint-71.md]
---

# Sprint 73: Security Hotfix + Blog Visual Carryover Closure

## Context

Across Sprints 70 through 72, each sprint achieved its primary objective (visual enrichment, session lifetime bug fix, blog design polishing), but every sprint accumulated out-of-scope observations in the MEMORY.md "Needs Follow-up (Non-blocking)" section, causing that section to balloon. In particular, the **GitHub PAT (`ghp_*`) plaintext exposure in `/root/aether-gitops/.git/config`** discovered during Sprint 70 work had been left unaddressed for nearly 30 days, and it was time to escalate it as a security blocker.

Oracle conducted a MEMORY.md re-investigation before starting and discovered that four items in the "Needs Follow-up" section were **stale — already resolved**:

1. `nginx try_files pattern enhancement` — already reflected in `blog/nginx.conf` after Sprint 70 G3
2. `Sealed Secret JWT_EXPIRES_IN legacy value (7d) cleanup` — resolved in Sprint 71 D1 via Deployment env override
3. `Existing user GitHub token re-linking` runbook — already implemented, yet remained as a pending item
4. Swagger/OpenAPI documentation — already applied across all services, yet persisted as a deferred item

PM confirmed direction as "hybrid — security hotfix + blog carryover closure." Oracle adopted a **parallel delegation strategy** based on the observation that all 7 tasks were independent at the file level: Phase A delegated Herald (73-1~3 security/infra) and Librarian (73-4 MEMORY cleanup) simultaneously; Phase B delegated Palette (73-5~7 blog visual carryover) as a single session. Immediately after each phase, a verification session **separate** from the implementation session (Gatekeeper for Phase A, Scout for Phase B) was run in parallel to offset the limitations of self-reported verification.

As a result, this sprint extended the "Oracle → Palette + Scout joint evaluation" pattern validated in Sprint 72 to the security domain and was the **first case of separating implementation and verification at the session level**.

## Decisions

### D1: Parallel Delegation Strategy — Separating Implementation Agents and Verification Agents

- **Context**: Sprint 72 proceeded sequentially in a single Palette session, but at step 72-3 a pre-investigation gap was discovered causing rework. Additionally, the implementation session itself covered "self-verification," leaving a persistent risk of confirmation bias. This sprint had 7 tasks that were file-level independent, making parallelization feasible.
- **Choice**: **3 implementation sessions — Herald (73-1~3), Librarian (73-4), Palette (73-5~7) — delegated simultaneously**. Once each session completes its own check (commit + brief grep + one build), immediately after the phase ends, **2 verification sessions — Gatekeeper (Phase A security verification) and Scout (Phase B user-perspective verification) — are delegated in parallel**. Verification sessions independently re-grep/re-build/re-secret-scan/re-query-ArgoCD the same work, cross-validating report reliability. Oracle handles orchestration only.
- **Alternatives**: (A) Single-session sequential processing — slow + self-verification limitation within the same context / (B) Instruct implementation agents to "strengthen self-verification" — does not fundamentally resolve confirmation bias
- **Code Paths**: N/A (orchestration pattern)
- **Note**: Extended form of `memory/feedback_design_workflow.md` D1's "Palette + Scout joint evaluation" to the security domain. Recorded as a generalized pattern in P2.

### D2: git credential helper = gh CLI integration (73-1)

- **Context**: GitHub PAT (`ghp_*`) was embedded in plaintext as `https://<token>@github.com/...` in `/root/aether-gitops/.git/config`. Discovered during Sprint 70 work but left unaddressed for 30 days. Same token may also remain in server backups, shell history, and logs.
- **Choice**: `git config --global credential.helper '!gh auth git-credential'` — reuses the gh CLI authentication already configured on the server (scope: repo, workflow, admin:org) to **leave no token in plaintext on the filesystem**. Then `git remote set-url origin https://github.com/tpals0409/aether-gitops.git` removes the token segment from the existing URL. All fetch/push/pull operations go through the gh CLI credential helper.
- **Alternatives**:
  - (A) `git config credential.helper store` + `~/.git-credentials` — still creates a plaintext file, not a fundamental fix
  - (B) Separate installation of git-credential-manager — additional dependency, maintenance cost
  - (C) Switch to SSH — reconstruction cost for existing HTTPS clone path + loss of consistency with gh CLI
- **Code Paths**: `/root/aether-gitops/.git/config`, server-level `~/.gitconfig`
- **Note**: `--global` scope means **all git repos** on the server share the same helper. No existing local overrides, so no conflicts (Gatekeeper confirmed). AlgoSu source repo also uses the same helper. See G2.

### D3: sealed-gateway-secrets SSoT = `sealed-secrets/` subdirectory (73-3)

- **Context**: Two files coexisted in the aether-gitops repo: `algosu/base/sealed-gateway-secrets.yaml` (33 keys, **orphan**) and `algosu/base/sealed-secrets/sealed-gateway-secrets.yaml` (35 keys, referenced in kustomization). Discovered during Sprint 71 Herald 71-3 and registered as a deferred item.
- **Choice**: Confirmed via diff that the referenced file is a superset of the orphan (35 keys ⊇ 33 keys; the 2 additional keys are `GITHUB_TOKEN_ENCRYPTION_KEY` and `INTERNAL_API_KEY`). After verifying no content loss, the orphan file was removed with `git rm`. The **`sealed-secrets/` subdirectory** is confirmed as the single SSoT for AlgoSu sealed secrets.
- **Alternatives**:
  - (A) Keep both files and reference both in kustomization — management confusion + duplicate work when re-sealing with kubeseal
  - (B) Consolidate to parent directory (`algosu/base/`) — existing references are under `sealed-secrets/`, so reversing the move is riskier
- **Code Paths**: `aether-gitops/algosu/base/kustomization.yaml` (L49 reference retained), `aether-gitops/algosu/base/sealed-secrets/sealed-gateway-secrets.yaml` (SSoT)
- **Note**: All future Sealed Secret additions should be placed under `sealed-secrets/`. Enters Herald/Librarian guidelines.

### D4: cloudflared management boundary = aether-gitops only (73-2)

- **Context**: `/root/AlgoSu/infra/k3s/kustomization.yaml` referenced a non-existent `cloudflared.yaml`, causing `kubectl kustomize` warnings. The actual runtime cloudflared Pod is managed by `aether-gitops/algosu/base/cloudflared.yaml` (confirmed via ArgoCD tracking-id label). Additionally, a `cloudflare-tunnel-token` Secret that was not referenced anywhere remained in the cluster (the actual Secret in use is `cloudflared-token`).
- **Choice**: Comment out the `cloudflared.yaml` reference line in the AlgoSu source repo kustomization and explicitly note via comment that **"cloudflared is managed only in aether-gitops"**. Also clean up the orphan Secret `cloudflare-tunnel-token` with `kubectl delete secret -n algosu cloudflare-tunnel-token`.
- **Alternatives**: Restore cloudflared manifest in source repo — risk of GitOps dual-source confusion. Principle: "infrastructure runtime = aether-gitops, source = AlgoSu"
- **Code Paths**: `infra/k3s/kustomization.yaml` L32 (commented out), `aether-gitops/algosu/base/cloudflared.yaml` (SSoT)
- **Note**: When migrating cloudflared to aether-gitops for GitOps management in Sprint 70, the reference in the source repo kustomization was not cleaned up simultaneously, leaving the orphan reference for 4 weeks. See G4 lesson.

### D5: Blog dark mode entry point — next-themes + hydration guard (73-6)

- **Context**: Sprint 72 completed full `:root`/`.dark` CSS variable coverage, but **there was no toggle entry point** so users could not activate dark mode. Sprint 72 assets were not reaching users.
- **Choice**: Introduced `next-themes@0.4.6`. Created `theme-provider.tsx` Client Wrapper (`attribute="class"`, `defaultTheme="system"`, `enableSystem`, `disableTransitionOnChange`). Created `theme-toggle.tsx` — `useEffect` mounted guard + same-size placeholder for SSR hydration CLS 0. Added `<html lang="ko" suppressHydrationWarning>` attribute to suppress server/client `class` mismatch warning. Toggle button automatically inherits Sprint 72 G4 (global `button:focus-visible` ring).
- **Alternatives**: Custom toggle — cost of resolving flash/hydration issues when directly implementing `localStorage` + `matchMedia` exceeds cost of next-themes dependency
- **Code Paths**: `blog/src/components/theme-provider.tsx`, `blog/src/components/theme-toggle.tsx`, `blog/src/app/layout.tsx`, `blog/package.json`
- **Note**: **Scout Suggestion** — currently only supports light↔dark 2-way. No path to return to "system." If a user using OS dark mode fixes blog to light and wants to return to "system tracking," they must manually delete localStorage. Register 3-way toggle (system→light→dark) as a future carryover.

### D6: Post navigation temporal semantics — older/newer (73-7)

- **Context**: When introducing "previous/next post" navigation at the bottom of post details, needed to decide which temporal semantics to map to labels and array indices.
- **Choice**: Since `getAllPosts()` returns date desc, array index `posts[i-1]` is **newer** and `posts[i+1]` is **older**. Palette implemented "← Previous Post = older, Next Post → = newer." Layout is `sm:grid-cols-2` responsive. First/last posts use `aria-hidden` placeholder to maintain grid. Card tokens are identical to PostCard (`bg-surface`, `border-border`, `shadow-sm`, `hover:-translate-y-0.5`, `hover:border-brand`), inheriting Sprint 72 P3 (multi-axis hover).
- **Alternatives**: Visual position basis (top=latest=previous in list date desc) — matches reader scroll momentum but opposite to temporal order → terminology confusion
- **Code Paths**: `blog/src/app/posts/[slug]/page.tsx` L57-106
- **Note**: **Scout Suggestion** — switching to "New Post → / ← Past Post" vocabulary or swapping left/right to align "list position" with "temporal axis" is a UX decision awaiting PM judgment (future carryover).

## Patterns

### P1: Shadow Consistency Completion — Sprint 72 D7 Continuation (73-5)

- **Where**: `blog/src/components/blog/{pipeline,tier-stack,tier-matrix,mermaid,kv}.tsx`
- **When to Reuse**: Sprint 72 applied `shadow-sm` to 4 types (Callout/MetricCard/ServiceCard/ArchService) + 2 types (PhaseTimeline/HierarchyTree) already had it, totaling 6 types. Sprint 73 added `shadow-sm` to the remaining 5 types (Pipeline/TierStack/TierMatrix/Mermaid/KV), achieving **100% coverage for all 11 visual component types**. Measured `shadow-sm` total in `blog/src/`: **15 instances** (components 12 + post-card 1 + 73-7 post navigation cards 2), `shadow-md` 5 instances (hover transition 3 + phase-timeline/architecture-map static icons 2), `shadow-lg`+ 0 instances. When applying this pattern: (a) treat light mode depth as a standalone effect and use border brightness difference for dark mode separation (Sprint 72 G2), (b) combine with existing `border-border` token, (c) limit hover `shadow-md` transition to interactive cards only — static visuals use `shadow-sm` fixed.
- **Note**: Palette's self-report cited shadow-sm 13 instances/shadow-md 3 instances, but that was a simple counting error omitting the 2 new 73-7 navigation cards added after the 73-5 measurement. Corrected by Scout verification (V2-1) to actual 15/5 — demonstrating the value of D1 independent verification.

### P2: Implementation Agent + Independent Verification Agent 2-Stage Pattern

- **Where**: Full orchestration of this sprint
- **When to Reuse**: For multi-item parallel work (3+ items) where file-level independence between tasks is established. Implementation sessions perform only up to "self-check" level (commit + brief grep + 1 build), while verification sessions **independently** re-investigate the same files (re-verify grep counts, re-run builds, re-grep secrets, re-query ArgoCD status). Offsets the limitations of self-reported verification. In this sprint, Scout discovered Palette's count discrepancy (P1 Note) and Gatekeeper issued a security ruling on Sprint 71 residual commits pushed along (G1) — both points would have been missed without separated verification. Generalization of the 2-track evaluation pattern that started in the design domain (Sprint 72 D1) to the security/infrastructure domain.

## Gotchas

### G1: Rebase Carries Along Locally Unpushed Commits

- **Symptom**: During 73-3 work, an aether-gitops push was rejected as `non-fast-forward` (remote was 3 ArgoCD auto-deploy commits ahead). After resolving with `git pull --rebase` + `git push`, **Sprint 71 commits 2** that were waiting locally were inadvertently pushed along:
  - `0ed90ec` — `JWT_EXPIRES_IN` 7d → 2h (Sprint 71 D1)
  - `41ed986` — SessionPolicy env 4 entries added (Sprint 71 D6)
- **Root Cause**: At Sprint 71 completion, these 2 commits existed only locally in aether-gitops without being pushed, and went undetected for 4 weeks. Sprint 71 release hygiene lacked a "remote sync confirmation" step.
- **Fix**: Gatekeeper performed a security ruling immediately after the inadvertent push → **ACCEPT**. Rationale:
  - (a) Both commits had zero plaintext token/secret exposure
  - (b) JWT lifetime shortening (7d → 2h) is a security improvement direction consistent with planned values
  - (c) SessionPolicy env additions conform to Sprint 71 D6 design as intended policy values
  - (d) Gateway Pod rolling update occurred and stabilized at `2/2 Running`
- **Lesson**: Sprint completion checklist must include `git -C /root/aether-gitops log @{upstream}..HEAD` verification step. If there are locally unpushed commits, address them on the spot or explicitly include them in the next Sprint scope. Consider enhancing `/stop` command checklist.

### G2: Scope of `git config --global` Credential Helper Change

- **Symptom**: Changing `credential.helper` to global scope in 73-1 caused all git repos on the server (`/root/AlgoSu`, `/root/aether-gitops`, etc.) to share the same helper. No issues at the time of the change since there were no local overrides, but if a repo requiring separate credentials is added in the future, conflicts are possible.
- **Root Cause**: "PAT hygiene work for this server" could be misunderstood in scope as "changing the authentication path for all git repos on this server."
- **Fix**: Before the change, Gatekeeper confirmed absence of existing settings with `git config --get-all credential.helper`, and verified that AlgoSu source repo fetch/push was uninterrupted after the actual change. As long as gh CLI authentication is maintained, all repos work automatically.
- **Lesson**: `--global` credential helper change should be declared and documented as a "server-level security policy." If a repo requiring a separate helper arises in the future, respond with `git config --local credential.helper` override. This change is an intentional security improvement and will not be reverted.

### G3: `next-mdx-remote` High-Severity Vulnerability Has No Practical Exploitability

- **Symptom**: Running `npm audit` during 73-6 work resulted in a `next-mdx-remote@4.x-5.x` CWE-94 **arbitrary code execution** (CVSS 8.8) high-severity alert. At this score, it should immediately block builds if used as a gate.
- **Root Cause**: CVE states that `next-mdx-remote`'s runtime MDX compilation path allows arbitrary code execution against malicious MDX input.
- **Fix**: Scout analysis — AlgoSu blog uses **build-time static export** (`next build` → `out/`) and `getAllPosts()` only reads repo-internal `content/adr/*.mdx`. **No user-input MDX path** → no practical exploitable scenario. Attack surface = "person who can commit malicious MDX files to the repo" → already equivalent to write access == code execution capability, so the CVE grants no new permissions. Deferred for this sprint.
- **Lesson**: Do not judge by CVSS score alone. Evaluate actual exploitability based on the application's **actual attack surface** (user input paths, runtime vs build time). However, for dependency hygiene, `next-mdx-remote@6.0.0` major upgrade is deferred to a separate sprint (possible import API changes + `renderMdx` wrapper migration verification needed).

### G4: Infrastructure Boundary Cleanup Requires Handling Both Repos Simultaneously

- **Symptom**: In 73-2, cleaned up the state where `/root/AlgoSu/infra/k3s/kustomization.yaml` referenced a non-existent `cloudflared.yaml`, causing `kubectl kustomize` warnings. The cause was that during the Sprint 70 cloudflared GitOps migration, the manifest was added to aether-gitops but **the existing reference in the AlgoSu source repo kustomization was not removed** → orphan reference persisted for 4 weeks.
- **Root Cause**: The infrastructure manifest migration work was conscious of "where it's going" (adding to aether-gitops) but didn't include "where it's leaving" (cleaning up AlgoSu source repo) in the checklist. If two repos aren't operated simultaneously, one is likely to remain with stale references.
- **Fix**: In 73-2, finally commented out the source repo kustomization reference + deleted the orphan Secret `cloudflare-tunnel-token`.
- **Lesson**: When migrating infrastructure manifests to aether-gitops, handle source repo kustomization cleanup in **the same PR/commit unit**. Recommend adding a "simultaneous both-repo cleanup checklist" to Herald/Scout GitOps migration runbooks. Register runbook enhancement item in MEMORY.md follow-up.

## Metrics

- **Task count**: 7 implementation + 2 verification + 1 ADR = 10 tasks
- **Commits (AlgoSu)**: 4
  - `0194d79` chore(infra): kustomization cloudflared reference commented out + orphan Secret cleanup (73-2)
  - `6657034` style(blog): 5 visual components shadow-sm applied — 11-type coverage complete (73-5)
  - `0c250bf` feat(blog): next-themes based dark mode toggle introduced (73-6)
  - `84ec85b` feat(blog): post detail bottom previous/next post navigation (73-7)
  - (+ this ADR commit 1 planned)
- **Commits (aether-gitops)**: 1 (`c041fe7` — 73-3 sealed-gateway-secrets orphan deletion) + Sprint 71 residual 2 carried along (`0ed90ec`, `41ed986` — G1)
- **Files changed (AlgoSu)**: ~10 blog files + `infra/k3s/kustomization.yaml` 1 file
  - Blog components (5): `blog/src/components/blog/{pipeline,tier-stack,tier-matrix,mermaid,kv}.tsx`
  - Blog new (2): `blog/src/components/theme-provider.tsx`, `blog/src/components/theme-toggle.tsx`
  - Blog modified (3): `blog/src/app/layout.tsx`, `blog/src/app/posts/[slug]/page.tsx`, `blog/package.json` (+`package-lock.json`)
  - Infrastructure (1): `infra/k3s/kustomization.yaml`
- **Files changed (aether-gitops)**: 1 deleted (`algosu/base/sealed-gateway-secrets.yaml`)
- **MEMORY.md**: 81 lines → 77 lines (4 stale items deleted + 5 follow-ups added + PAT bullet replaced)
- **Shadow coverage**: Blog visual components **11/11 (100%)** — Sprint 72 4/11 → Sprint 73 complete
- **shadow-sm measured**: 15 instances (components 12 + post-card 1 + post nav cards 2)
- **shadow-md measured**: 5 instances (hover transition 3 + static icons 2), **shadow-lg+ 0**
- **Baseline maintained (grep 0)**: `text-gray-` / `border-gray-` / `bg-[#` / `text-[#` / `border-[#` / `style={{`
- **Build**: `cd blog && npm run build` success (10 static pages, First Load JS 103KB maintained)
- **ArgoCD**: algosu app `Synced` + `Healthy`, revision `c041fe7...`
- **Parallel execution**: 3 implementation sessions + 2 verification sessions simultaneously (Phase A: Herald+Librarian+Gatekeeper, Phase B: Palette+Scout)
- **New external dependencies**: 1 (`next-themes@0.4.6`)
- **New token definitions**: 0 (100% reuse of existing tokens)

## Related

- **Sprint 72 ADR** — Continuation of D1 (Palette+Scout joint evaluation), D6 (prose customization), D7 (shadow consistency 4/11), G1 (inline style bypass), G2 (dark shadow weakening), G4 (content vs design boundary). This sprint's D1 (P2) extends Sprint 72 D1 to security/infrastructure; 73-5 completes Sprint 72 D7 to 11/11.
- **Sprint 71 ADR** — G1's residual commits 2 (`0ed90ec` JWT_EXPIRES_IN, `41ed986` SessionPolicy env) originate from 71-3/71-3R. The aether-gitops unpushed items missed in Sprint 71 release hygiene were attributed during 73-3 rebase.
- **Sprint 70 ADR** — G4's cloudflared GitOps migration point (origin of 73-2's orphan reference), 73-1's PAT plaintext exposure first discovery point.
- `memory/feedback_design_workflow.md` — D1 pattern extension basis. This sprint's P2 is the security/infrastructure generalization of the same pattern.
