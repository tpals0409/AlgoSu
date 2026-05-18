---
sprint: 77
title: "New Blog Post — Session Policy 4-Layer Sync Journey"
date: "2026-04-10"
status: completed
agents: [Oracle, Scribe, Palette]
related_adrs: []
---

# Sprint 77: New Blog Post — Session Policy 4-Layer Sync Journey

## Context

Among technical experiences accumulated across 10 sprints (68~76) since Sprint 67, selected a topic for a blog post. PM chose "Session Policy 4-Layer Sync Journey" from 5 candidates (session sync, security runbook, MDX visualization, AI fact-check, cloudflared saga). Wrote Sprint 71's SessionPolicyModule introduction process as the 7th blog post.

## Decisions

### D1: Selected Sprint 71 Session Policy Journey as Blog Topic
- **Context**: 5 blog content candidates derived from Sprint 68~76 work. Real-world debugging + design improvement story has the broadest reader resonance and differentiates from the existing 6 posts (architecture/agent introduction).
- **Choice**: "Session Policy 4-Layer Sync Journey" — records the JWT TTL · Cookie maxAge · sliding threshold · frontend timer 4-layer mismatch bug → SessionPolicyModule SSoT resolution process.
- **Alternatives**: next-mdx-remote 6.0 migration, CI deprecation response, cloudflared saga, AI fact-check — all valid but ranked lower in terms of story completeness and reader resonance.
- **Code Paths**: `blog/content/adr/session-policy-sync.mdx`

### D2: Sprint 76 ADR Bundled Commit
- **Context**: Sprint 76 ADR (`docs/adr/sprints/sprint-76.md`) had been left in untracked state.
- **Choice**: Include in the blog post commit to handle as a single commit.
- **Alternatives**: Separate commit — content is documentation-only, so a single commit is more efficient.
- **Code Paths**: `docs/adr/sprints/sprint-76.md`

## Patterns

### P1: Blog Post Composition Using Existing Visual Component Combinations
- **Where**: `blog/content/adr/session-policy-sync.mdx`
- **When to Reuse**: When writing new blog posts. The combination of MetricGrid (numeric comparison), Mermaid (flowchart), PhaseTimeline (step-by-step progress), and Callout (checklist/warning) is well-suited for the technical journey post format.

## Gotchas

### G1: Callout Component type Value Mismatch
- **Symptom**: Using `type="warning"` caused build error (`Cannot read properties of undefined (reading 'wrap')`)
- **Root Cause**: Callout component only supports 4 types: `'info' | 'warn' | 'success' | 'danger'`. `"warning"` is not a valid type.
- **Fix**: Changed to `type="warn"`. When writing future blog posts, check `callout.tsx`'s `CalloutType` definition first.

## Metrics
- **Commits**: 1 (`3133cb4`)
- **Files changed**: 2 (+359 lines)
  - New: `blog/content/adr/session-policy-sync.mdx` (295 lines)
  - New: `docs/adr/sprints/sprint-76.md` (64 lines)
- **Build verification**: Next.js static build success, 7 posts exported normally
