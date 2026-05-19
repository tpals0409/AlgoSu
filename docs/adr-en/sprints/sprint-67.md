---
sprint: 67
title: "Tech Blog Post Addition + GitOps Synchronization"
date: "2026-04-09"
status: completed
agents: [Scribe, Conductor]
related_adrs: []
---

# Sprint 67: Tech Blog Post Addition + GitOps Synchronization

## Decisions
### D1: Remove sprint code pages and replace with ADR posts
- **Context**: Sprint-specific pages (`/sprint/[num]`, `/sprints`) existed in the blog but had low utilization, and ADR-based tech posts are more valuable.
- **Choice**: Remove sprint pages and related code, replace with ADR-004/005 tech posts
- **Alternatives**: Keep sprint pages while adding ADR posts — rejected due to duplicate content
- **Code Paths**: `blog/src/app/sprint/[num]/page.tsx`, `blog/src/app/sprints/page.tsx`, `blog/src/lib/posts.ts`, `blog/content/adr/adr-004-system-architecture.mdx`, `blog/content/adr/adr-005-ai-orchestration.mdx`

### D2: blog.yaml GitOps manifest synchronization
- **Context**: Blog deployment manifest was missing imagePullPolicy and strategy settings.
- **Choice**: Reflect imagePullPolicy + GHCR registry + strategy settings in blog.yaml
- **Alternatives**: None
- **Code Paths**: `infra/k3s/blog.yaml`

## Patterns
Not applicable

## Gotchas
Not applicable

## Metrics
- Commits: 2, Files changed: 8 (+475/-100)
