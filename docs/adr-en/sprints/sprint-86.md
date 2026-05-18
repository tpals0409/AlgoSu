---
sprint: 86
title: "Blog Content Reframing — Experience Narrative Tone Transition"
date: "2026-04-14"
status: completed
agents: [Oracle, Scribe, Herald]
related_adrs: []
---

# Sprint 86: Blog Content Reframing

## Context

The existing 7 blog posts were informational, ADR (Architecture Decision Record) tone articles. Referencing the Channeltalk technical blog as a model, decided to reframe to an "experience narrative" tone (problem → experiment → outcome → reflection).

Also renamed the directory from `content/adr/` → `content/posts/` to reflect the change in content character.

## Decisions

### D1: Content Directory Rename
- `content/adr/` → `content/posts/`, `content/adr-en/` → `content/posts-en/`
- Updated `posts.ts` LOCALE_SUBDIR mapping.
- Reason: "ADR" has internal record characteristics; "posts" is more appropriate for blog content.

### D2: meet-the-agents (Former Post 5) Deleted → Integrated into Post 1
- Post 1 already covers the 8→12 member evolution story, TierMatrix, and real-world episodes — duplicate content.
- Unique content (12-member detailed specs) exists separately in `docs/agents/commands/`.
- sprint-journey order adjusted 6→5, session-policy-sync order adjusted 7→6.

### D3: Common Reframing Rules
- Complete removal of series footer (all posts).
- Tone: formal informational "~합니다" → personal narrative "~했습니다/~이었죠" experience-style.
- Structure: problem → experiment → outcome → reflection.
- Full removal of MDX custom components (HierarchyTree, PhaseTimeline, etc.) → simplified to standard Markdown.

### D4: nginx absolute_redirect off
- Fixed bug where nginx 301 redirect exposed internal ports in k3d port-forward environment.
- Resolved with a single line addition of `absolute_redirect off;`.

### D5: blog NetworkPolicy Added
- Discovered that blog service was missing a NetworkPolicy during Post 3 work.
- Added `blog-ingress` policy to `service-network-policies.yaml`.

## Outcome

- Post 1 "AI Agent Orchestration in Practice" — Completed
- Post 2 "MSA Design: Humans Decide, AI Executes" — Completed
- Post 3 "How to Control 12 AIs" — Completed (400 lines → 90 lines compressed)
- Post 5 "Looking Back on 67 Sprints" — Completed (264 lines → 105 lines compressed)
- Overall: 7 posts → 6 posts, total -2,227 lines reduced

### Carryover Items
- Post 4 (cicd-ai-guardrails) title/conclusion adjustment
- Post 6 (session-policy-sync) series removal + AI context added
- English post synchronization + final build verification
- Sprint 87 category system plan file written (`sprint-87-plan.md`)

## Lessons Learned

- Running a **(plan → supplement → write) cycle per post** was effective for both quality and consistency.
- MDX custom components had low readability contribution relative to maintenance cost. Standard Markdown is sufficient.
- Content reframing takes longer than expected — 4 of 7 posts completed, rest carried over.
