---
sprint: 76
title: "Blog UI Carryover"
date: "2026-04-10"
status: completed
agents: [Oracle, Palette, Scout, Curator]
related_adrs: []
---

# Sprint 76: Blog UI Carryover

## Decisions

### D1: Pipeline → PhaseTimeline Full Transition
- **Context**: Pipeline component with 8 stages in horizontal layout at `max-w-3xl` (768px) caused text overcrowding. Only sprint-journey.mdx used PhaseTimeline (vertical timeline), creating visual inconsistency.
- **Choice**: Convert all Pipeline instances across all posts to PhaseTimeline (3 files, 7 Pipeline → 0)
- **Alternatives**: Pipeline split 4+4 (tried, then changed to PhaseTimeline consolidation based on user feedback)
- **Code Paths**: `blog/content/adr/cicd-ai-guardrails.mdx`, `blog/content/adr/orchestration-structure.mdx`, `blog/content/adr/system-architecture-overview.mdx`

### D2: Code Block Client Component Creation
- **Context**: rehype-highlight provided only syntax highlighting without language label or copy functionality. Inability to copy code in a technical blog was a major pain point.
- **Choice**: New `code-block.tsx` Client Component — language label (className parsing) + clipboard copy button + "Copied" feedback
- **Alternatives**: Replace rehype plugin (avoided adding unnecessary dependencies)
- **Code Paths**: `blog/src/components/blog/code-block.tsx`, `blog/src/components/mdx-components.tsx`

### D3: Post Navigation "← Past Post | New Post →" Left-Right Layout
- **Context**: Existing "← Previous Post / Next Post →" caused confusion between temporal axis and list position semantics (Scout Major judgment)
- **Choice**: Left=older (← Past Post), Right=newer (New Post →) — temporal axis left→right (past→future) direction
- **Alternatives**: "← New Post / Past Post →" (tried once, then swapped based on user feedback)
- **Code Paths**: `blog/src/app/posts/[slug]/page.tsx`

### D4: Blog Post Metrics Restored to Sprint 67 Baseline
- **Context**: Sprint 74-2 fact verification updated 4 posts' metrics to 73, but they originally recorded Sprint 67 milestone values. Subsequent sprints planned to be added as separate posts.
- **Choice**: Restore 4 posts' metrics to Sprint 67 baseline (67 sprints, 2,432 tests)
- **Alternatives**: Keep current 73 (user confirmed separate post policy, decided to restore)
- **Code Paths**: `blog/content/adr/sprint-journey.mdx`, `blog/content/adr/orchestration-structure.mdx`, `blog/content/adr/meet-the-agents.mdx`, `blog/content/adr/agent-orchestration-solo-dev.mdx`

### D5: Hero MetricGrid Inserted on Main Page
- **Context**: Blog main page had only h1 + 1-line description, no sense of project scale conveyed (Scout Critical judgment)
- **Choice**: Reuse existing MetricGrid component, 6 metric cards (Sprints/Tests/Agents/Services/CI/ADR)
- **Alternatives**: Create separate Hero component (reusing existing component was more efficient)
- **Code Paths**: `blog/src/app/page.tsx`

## Patterns

### P1: Palette+Scout Parallel Evaluation → Oracle Decision
- **Where**: Pre-design work phase
- **When to Reuse**: During blog/frontend visual design work — collect Palette (design proposal) + Scout (UX severity) in parallel, then Oracle makes the final integrated decision

### P2: MDX pre Handler → Client Component Delegation
- **Where**: `blog/src/components/mdx-components.tsx` → `code-block.tsx`
- **When to Reuse**: When interactive features (copy, toggle, etc.) are needed in MDX rendering — delegate to Client Component in RSC environment

## Gotchas

### G1: ArgoCD Auto-Sync Delay
- **Symptom**: Blog Pod still running previous image even after CI GitOps job succeeded
- **Root Cause**: Manual check within ArgoCD polling interval before sync occurred
- **Fix**: `kubectl patch app algosu -n argocd --type merge -p '{"operation":{"sync":{"revision":"HEAD"}}}'` to trigger manual sync

### G2: Post Navigation Left-Right Layout Repeated Twice
- **Symptom**: After first attempt (left=newer, right=older), user requested re-swap
- **Root Cause**: The judgment that temporal axis direction (left→right = past→future) is intuitive was omitted in the first attempt
- **Fix**: Confirmed "← Past Post (left) | New Post → (right)". Apply temporal axis left→right convention for future navigation direction decisions

## Metrics
- Commits: 2, Files changed: 11
