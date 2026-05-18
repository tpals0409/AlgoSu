---
sprint: 70
title: "Blog Visual Asset Enrichment + Sprint 69 Deferred Work"
date: "2026-04-09"
status: completed
agents: [Oracle, Architect, Palette]
related_adrs: []
---

# Sprint 70: Blog Visual Asset Enrichment + Sprint 69 Deferred Work

## Decisions

### D1: Unify cloudflared SSoT to aether-gitops (Sprint 69 carryover)
- **Context**: cloudflared was managed via direct `kubectl apply` with `AlgoSu/infra/k3s/cloudflared.yaml`, not under ArgoCD tracking (Sprint 69 G3). Simultaneously, an orphan manifest `algosu/base/monitoring/cloudflared.yaml` existed in aether-gitops but was unusable due to missing hotfix/probe/securityContext and different secret name.
- **Choice**: Copy AlgoSu source manifest (robust SSoT) to aether-gitops `algosu/base/cloudflared.yaml`, add to `kustomization.yaml resources`, delete orphan manifest, delete AlgoSu source manifest. ArgoCD in-place adopts with zero downtime, bringing cloudflared under GitOps management.
- **Alternatives**: (a) Promote orphan manifest to authoritative — risky due to required hotfix/probe/secret augmentation. (b) Maintain both manifests — permanent drift. Both rejected.
- **Code Paths**: `aether-gitops/algosu/base/cloudflared.yaml`, `aether-gitops/algosu/base/kustomization.yaml`

### D2: cloudflared image pinned tag — `2026.3.0`
- **Context**: Using `cloudflare/cloudflared:latest` violates CLAUDE.md Architect rules. The version actually fetched in production cluster is `2026.3.0`, verified with 28h+ no-restart.
- **Choice**: Pin `cloudflare/cloudflared:2026.3.0` fixed tag in aether-gitops base. Same binary, RollingUpdate is seamless (<3 seconds).
- **Alternatives**: Could go to latest stable (other than `2026.3.0`), but production-verified version is first priority.
- **Code Paths**: `aether-gitops/algosu/base/cloudflared.yaml`

### D3: Blog visualization design option — Option C (hybrid)
- **Context**: PM feedback on system-architecture-overview converted to Mermaid in Sprint 70-5 Phase 3: "Architecture and structural visualizations need more visuals — can't tell what it's saying". Mermaid's simple boxes+arrows couldn't convey meaning, hierarchy, or information density.
- **Choice**: **Option C Hybrid** — Repeated patterns (3-Tier matrix, hierarchy tree, Phase cards) as reusable React components; simple flows as existing Pipeline/ServiceGrid; sequences/complex branches (OAuth, Saga state) keep Mermaid. Balances design control, workload, and bundle size.
- **Alternatives**: (B) Full handcrafted SVG — high workload, difficult to express OAuth sequences. (A) Advanced Mermaid — token integration difficult, low PM satisfaction probability. (D/E) External tools/React Flow — poor static export compatibility, not recommended.
- **Code Paths**: `blog/src/components/blog/{architecture-map,tier-matrix,hierarchy-tree,phase-timeline,icons,pipeline}.tsx`

### D4: MDX icon references — string-based registry pattern
- **Context**: Direct lucide identifier references in MDX like `icon={Crown}` cause build failures (`Crown is not defined`). MDX JSX expressions require module scope imports; compileMDX only auto-injects React components via `components` option.
- **Choice**: Define string-keyed registry of 30 lucide icons in `src/components/blog/icons.ts`, each component looks up with `getIcon(name)`. Use `icon="Crown"` in MDX. No imports needed in any of the 6 MDX files.
- **Alternatives**: (a) Add lucide import statement per MDX file — needed in all 6, poor maintainability. (b) compileMDX `scope` option — unclear in v5.0, poor type safety.
- **Code Paths**: `blog/src/components/blog/icons.ts`, `blog/src/components/mdx-components.tsx`

### D5: Stable sort for 6 same-date posts — `order` auxiliary field
- **Context**: All 6 series posts have `date: "2026-04-09"`, leading to non-deterministic sort from `Array.sort` stable + `fs.readdirSync` alphabetical combination. Conflicts with user-intended series order.
- **Choice**: Add `order?: number` to `PostMeta`, enhance sort to `(date desc, order desc)` composite. Assign `order 1~6` to 6 posts (intro=1, sprint-journey=6). No change to display (date).
- **Alternatives**: (a) Use ISO datetime to separate times — `gray-matter` Date object risk. (b) Artificially assign timestamps for each new post — poor maintainability.
- **Code Paths**: `blog/src/lib/posts.ts`, `blog/content/adr/*.mdx`

## Patterns

### P1: ArgoCD in-place adopt — GitOps migration of directly-applied resources
- **Where**: aether-gitops `algosu/base/{kind}.yaml` + `kustomization.yaml resources`
- **When to Reuse**: When migrating a resource managed only with `kubectl apply` to ArgoCD tracking. Copying the same namespace/name/spec to GitOps causes ArgoCD to adopt in-place (only adds annotations/labels) without RollingUpdate. Zero downtime. Note: even one character difference in spec causes recreation → backup with `kubectl get -o yaml` beforehand is essential.

### P2: MDX component mapping + string-based icon registry
- **Where**: `blog/src/components/blog/icons.ts`, `blog/src/components/mdx-components.tsx`, `blog/src/lib/mdx.ts`
- **When to Reuse**: When MDX body needs to pass identifiers (icons/types) as props to React components in next-mdx-remote `compileMDX`. Instead of requiring import statements in MDX, receive as string key and do registry lookup inside the component. Only one place to modify when adding new icons.

### P3: Plain ASCII diagram visualization — pattern classification → component mapping
- **Where**: `blog/src/components/blog/{architecture-map,tier-matrix,hierarchy-tree,phase-timeline,pipeline}.tsx`
- **When to Reuse**: When multiple ASCII diagrams exist in blog/docs, classify by pattern (system topology/hierarchy tree/sequential pipeline/Phase milestone/sequence/state machine). Sequence and state machine fit Mermaid; the rest — handcrafted React components are superior for design control, dark mode, and accessibility. Component creation is worthwhile when the same pattern repeats across 3+ posts.

### P4: Phase split + sample review gate (common workflow for Sprint 70-5/70-6)
- **Where**: Design/UX change work in general
- **When to Reuse**: When visual satisfaction is key to the work (blog design, UI components). Prioritize infrastructure + 1~2 sample posts in Phase 1 → PM review in production environment → if satisfied, batch process remaining. Don't commit Phase 1+2 work together — gate on sample review to quickly validate design hypotheses and minimize toolchain abandonment costs.

## Gotchas

### G1: lucide-react 1.8.0 missing exports (`Github` icon)
- **Symptom**: After `npm install lucide-react`, `import { Github } from 'lucide-react'` → `Module '"lucide-react"' has no exported member 'Github'` build failure.
- **Root Cause**: Current npm registry's `lucide-react@1.8.0` has 5822 exports, but `Github` itself is deprecated. Git-related icons like `GitBranch`, `GitFork` exist, but `Github` brand mark is excluded. `LucideIcon` type export also missing.
- **Fix**: Remove `Github` import (replace GitHub Worker with `GitBranch`). Define `LucideIcon` type yourself (`ComponentType<{className?, size?, strokeWidth?}>`). Recommend pre-validating new lucide icons with `node -e "console.log('Foo' in require('lucide-react'))"`.

### G2: MDX JSX expression identifier scope limitation
- **Symptom**: After writing `<HierarchyNode icon={Crown}/>` in MDX, build fails with `ReferenceError: Crown is not defined at stringify`. compileMDX's `components` option only injects components for direct usage (`<Crown/>`), not identifier references inside JSX expressions.
- **Root Cause**: MDX is essentially a JS module and identifiers require module scope imports. compileMDX `components` is just JSX tag mapping sugar.
- **Fix**: Accept prop as string key, not React identifier, and do registry lookup (`getIcon(name)`) inside the component. Adopts D4 pattern of this sprint. No import statements needed anywhere in 6 MDX files.

### G3: nginx try_files pattern — 404 with trailing slash
- **Symptom**: `curl https://blog.algo-su.com/posts/system-architecture-overview/` → 404. Without trailing slash returns 200.
- **Root Cause**: `blog/nginx.conf`'s `try_files $uri $uri.html $uri/ =404` goes to folder matching logic with trailing slash and fails fallback. Next.js export generates both `out/posts/{slug}.html` (file) and `out/posts/{slug}/index.html` (folder), but nginx pattern prioritizes file, so no-trailing-slash form with `.html` extension matching works correctly.
- **Fix**: Use no-trailing-slash form when providing PM review URLs. Or future nginx try_files pattern can be enhanced to `$uri $uri.html $uri/index.html =404` (separate task).

### G4: PM review workflow — sample 1 post doesn't guarantee PM satisfaction
- **Symptom**: In Sprint 70-5 Phase 3, system-architecture-overview migrated to Mermaid → sample push → production review → "need more visualization — can't tell what it's saying" feedback → Sprint 70-6 required creating 4 new component types, redoing work.
- **Root Cause**: Design hypothesis (simple Mermaid flowchart) in Phase 1 infrastructure design stage didn't match PM's expectation of "rich visualization". Can't know in advance whether the design hypothesis strength matches PM expectations before sample review.
- **Fix**: If design hypothesis strength is weak, quickly push sample 1 post to validate in production environment (rollback cost < guessing cost). In Sprint 70-6, Plan agent presented 5 options → PM selected Option C → then sample → satisfied → Phase 2. Clarifying PM intent in the options stage was key.

## Metrics
- AlgoSu Commits: 11 (between 49b719a..bcd85ff)
- aether-gitops Commits: 3 (552c39e cloudflared migration, bb0f182 tag pin, multiple auto-deploy updates)
- Files changed: blog area ~25 files (8 new components + 6 MDX + 4 infra + lock, etc.)
- Blog plain ASCII fenced block: 36 → **0** (all 6 posts)
- New React components: 11 (Sprint 70-5 7 + Sprint 70-6 4)
- New dependencies: 2 (mermaid 11.14.0, lucide-react 1.8.0 — dynamic + tree-shaken)
- CI passes: 70-5 sample, 70-6 P1, 70-6 P2 — all 3 pushes all jobs success
- Production impact: blog.algo-su.com zero downtime (RollingUpdate seamless), cloudflared in-place adopt 0 seconds downtime
