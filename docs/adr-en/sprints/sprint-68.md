---
sprint: 68
title: "Blog Content Review and Corrections"
date: "2026-04-09"
status: completed
agents: [Oracle, Scribe, Architect]
related_adrs: []
---

# Sprint 68: Blog Content Review and Corrections

## Decisions

### D1: Tier classification SSoT = `agents/commands/*.md`
- **Context**: `meet-the-agents.mdx` and `orchestration-structure.mdx` had inconsistencies in Palette's Tier and Tier 3 label ("Support" vs "Enhancement"). A reference point was needed to resolve conflicts between blog posts.
- **Choice**: Adopt the `[Tier N — Label]` declaration on the first line of `agents/commands/{name}.md` as the SSoT. Blogs, documentation, and planning materials follow this value.
- **Alternatives**: Adopt orchestration-structure.mdx as authoritative (blog-first) / Declare separately in MEMORY.md (memory is a snapshot, not suitable) — both rejected.
- **Code Paths**: `agents/commands/palette.md`, `agents/commands/*.md`, `blog/content/adr/meet-the-agents.mdx`, `blog/content/adr/orchestration-structure.mdx`

### D2: Blog series reorganization — ADR number-based → topic-based 6 posts
- **Context**: Existing `adr-001~005.mdx` had weak narrative flow from a reader perspective due to ADR number listing. Reorganization was already underway in Sprint 67 but cross-references/Tier consistency had not been verified and were left in the working tree.
- **Choice**: Finalize as 6 topic-based series and complete consistency in Sprint 68.
  1. agent-orchestration-solo-dev (intro)
  2. system-architecture-overview
  3. orchestration-structure
  4. cicd-ai-guardrails
  5. meet-the-agents
  6. sprint-journey (retrospective)
- **Alternatives**: Maintain ADR number system — rejected due to poor reader navigation.
- **Code Paths**: `blog/content/adr/*.mdx`

## Patterns

### P1: Document Tier/naming consistency validation is grep-based from `agents/commands/`
- **Where**: `[Tier \d` declarations in `agents/commands/*.md`
- **When to Reuse**: When writing/modifying documents describing the agent system (blog, README, ADR), first grep `agents/commands/*.md` to confirm the SSoT. If conflicts arise between documents, correct according to the SSoT.

### P2: Blog series link text matches each post's frontmatter `title`
- **Where**: "Previous post/Next post" links in `blog/content/adr/*.mdx`
- **When to Reuse**: When link text differs significantly from the actual post title, readers can misunderstand the next post's content. Always verify frontmatter `title` and link text consistency when adding/modifying series posts.

## Gotchas

### G1: Subagent reports are supplementary; direct grep is the final authority
- **Symptom**: Explore subagent reported "Palette inconsistency in Tier 2/3, three agents → four agents correction needed" in meet-the-agents.mdx. However, Oracle's direct grep found meet-the-agents.mdx consistently described Palette as Tier 2 with "three agents". The actual error was in the overall Tier 2/3 classification.
- **Root Cause**: Subagent's summary mixed observation and judgment, and Oracle nearly passed incorrect correction instructions without critical review.
- **Fix**: After receiving subagent reports, Oracle directly re-verifies critical judgments with Read/Grep. Judgments like "which file is authoritative" must be confirmed directly from the SSoT.

### G2: Cloudflare Tunnel routing is not visible in Ingress
- **Symptom**: No blog route in `kubectl get ingress` during CD verification, momentarily misunderstood as "blog not exposed externally". Actually `https://blog.algo-su.com` was responding normally.
- **Root Cause**: Blog service is delivered directly by `algosu/cloudflared` pod via Cloudflare Tunnel to `blog` Service (ClusterIP). This structure bypasses Ingress, leaving no trace in `kubectl get ingress`.
- **Fix**: When verifying external domain routing, don't only check Ingress — also check for `cloudflared` pod presence + verify with actual HTTP request. Record blog domain and routing mechanism in reference_domain.md to prevent recurrence.

## Metrics
- Commits: 2 (cb86dec, 37ccf38)
- Files changed: 16 (+2446/-571)
- Blog post reorganization: 5 deleted + 6 new + 3 content corrections
- Sprint ADR archive augmentation: Sprint 63~67
