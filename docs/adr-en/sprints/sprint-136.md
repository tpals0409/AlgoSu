---
sprint: 136
title: "Critic Introduction Retrospective Blog Post — Toward a Model-Agnostic Harness"
date: "2026-04-27"
status: completed
agents: [Oracle, Scribe]
related_adrs: ["ADR-026"]
---

# Sprint 136: Critic Introduction Retrospective Blog Post

## Sprint Goal

Summarize the experience from Sprint 114 Critic (Codex gpt-5 based cross code review) introduction through Sprint 135's 17-round verification into a retrospective blog post. Focus on **"why we made the decisions we made"** rather than technical details — bundling into one post: the additional decision (not full replacement), the merge-gate positioning, the value of a different perspective, Critic's limits, the harness's own biases, dependency meta-learning, and the harness abstraction vision.

## Final Result Summary

| Item | Result |
|------|--------|
| **Merged PRs** | 1 (#173) |
| **Changes** | 2 files +196 insertions (KR/EN mdx) |
| **New blog posts** | `toward-model-agnostic-harness.mdx` (KR + EN) |
| **MDX components** | 2 minimal (`<MetricGrid>` + `<Callout>`) |
| **Critic invocation** | Not invoked (consistent policy — mdx content change) |
| **Category / Order** | challenge / 9 |
| **CI** | All checks SUCCESS, mergeStateStatus CLEAN |

## Decisions

### D1: Post Center of Gravity — "Why" Focused (Technical Detail Removed)

- **Context**: v1 draft had many technical details — codex CLI commands (`/codex:*` slash not parsed, 0.122.0 parser change), opossum v8 details, `@Global()`/WeakSet code details.
- **User feedback**: "Writing centered on why rather than the technical perspective"
- **Choice**: Removed or abstracted most technical details. Retained details: 17 rounds / P1 8 / P2 9 / Sprint numbers (114/134/135).
- **Result**: Post's depth shifted to "decision motivation" and "learned insights" — confirmed retrospective tone for v2.

### D2: Thesis — Model Dependency Meta-Learning

- **Context**: User insight — "The current harness is Claude-biased. A true service being dependent on another service is not good (learned from — when Baekjoon disappeared)."
- **Choice**: thesis = "The cost of dependency learned from the Baekjoon experience. The same pattern repeated with AI models this time. Critic introduction is the first step, and the real answer is liberating the harness itself from model and environment dependency."
- **Result**: Post elevated from simple "Codex introduction story" to "system design retrospective about liberation from dependency." Applied self-referential citation structure in the body — own blog post [Baekjoon disappeared](/posts/baekjoon-gone).

### D3: Opening = Workflow Violation Self-Confession (a + b + D)

- **Context**: When starting the post trigger as "feeling Claude performance degradation," it felt vague. Needed a specific anecdote.
- **User anecdote**: "The frequency of ignoring the workflow increased"
- **Choice**: a (Sprint 134 ADR follow-up main direct push self-confession) + b (same mistake twice — Sprint 133/134 shell globbing) + D (external Codex stimulus)
- **Result**: Main a + supplement b + external stimulus D triple-stream structure — naturally connects decision motivation.

### D4: Conclusion = Two-Layer Vision (Swap Switch → Harness Abstraction)

- **Context**: User insight — "Structure where agent roles remain the same but only the model changes + a harness structure not dependent on models that can immediately adopt the most productive model"
- **Choice**: Conclusion = (1) Agent model swap switch + (2) Liberate the harness itself from model/environment dependency.
- **Result**: Conclusion not a simple wrap-up but presents the vision "Critic introduction is the starting point, the real destination is liberation from dependency."

### D5: Title = "Toward a Model-Agnostic Harness — Critic Introduction"

- **Context**: Chose vision-emphasis type (pattern 5) among 5 candidates, user made the final decision.
- **Choice**: Main = vision ("Toward a model-agnostic harness"), subtitle = introduction label ("Critic Introduction")
- **Result**: Precisely resonates with the post conclusion (title = vision → body = introduction → conclusion = vision return)

### D6: MDX Component Minimal Application (2 types only)

- **Context**: In retrospective posts, the more visual boxes, the more the flow breaks. sprint-journey.mdx is a precedent where components were intentionally deleted when compressed from 264 → 105 lines.
- **Choice**: Only 2 types — `<MetricGrid cols={3}>` × 5 `<MetricCard>` (17 round distribution) + `<Callout type="info">` (Baekjoon reminiscence box)
- **Excluded**: `<PhaseTimeline>`, `<DecisionBridge>`, `<HierarchyTree>`, `<Callout type="quote">` etc.
- **Result**: Maintains prose flow while visually emphasizing only the two key spots.

### D7: Critic Not Invoked (Policy Consistency)

- **Context**: PR #173 changes = 2 mdx files. Not applicable to Critic definition's (`.claude/commands/agents/critic.md`) review items (security, concurrency, data integrity, rollback possibility).
- **User judgment**: "This is a tech blog with no code-related content, so Critic involvement seems wrong."
- **Choice**: Critic not invoked + stated non-invocation reason in PR body (merge-gate preset Scope policy consistency)
- **Result**: Since the post body directly defines Critic's scope of application, **the Critic non-invocation itself operates as the post's self-consistency**.

## Patterns / Lessons

### P1: User Step-by-Step Consensus Cycle (One Post per Unit Policy Compliance)

- Decided in decision order 1 by 1: thesis → opening category → specific examples → conclusion vision → title → excerpt → MDX application → writing → push → PR → merge
- Each time user replies and throws new insights (model switch → harness abstraction → Baekjoon reminiscence dependency meta), absorb them into the post's vision/thesis
- v1 draft → v2 ("why" focused) → v3 (MDX applied) evolution
- `feedback-blog-workflow.md` policy (one post per unit cycle, batch execution prohibited) fully complied with

### P2: Self-Blog Back-Reference Structure

- References own blog post [Baekjoon disappeared](/posts/baekjoon-gone) in the body (Sprint 95~97 BOJ→Programmers migration retrospective)
- Meta-learning that applies the experience of bearing the cost of dependency once to the model layer again
- Strengthens the structure where the blog itself reads as one person's trajectory of thought

### P3: Value of Critic Non-Invocation Policy Consistency

- Critic invocation for mdx content PR is nominal and only incurs token cost
- Meta-consistency of "post body defines Critic's scope of application (code correctness/concurrency/rollback), and this PR's changes (mdx) are outside that scope"
- Stating non-invocation reason in PR body → self-consistency signal

### P4: Trust Recovery Through Workflow Violation Self-Confession

- Sprint 134 main direct push violation (`a528a66`) directly cited in post opening (including self-memory records)
- Same mistake twice (Sprint 133/134 shell globbing) added as supplement → proves it's a pattern, not a one-time incident
- Self-confession naturally connects as justification for the Critic introduction decision

## Outputs

- Blog post (KR): `blog/content/posts/toward-model-agnostic-harness.mdx`
- Blog post (EN): `blog/content/posts-en/toward-model-agnostic-harness.mdx`
- ADR: This document (`docs/adr/sprints/sprint-136.md`)

## Merge Information

- PR: [#173](https://github.com/tpals0409/AlgoSu/pull/173) — MERGED 2026-04-27 05:52:07Z
- Squash commit: `f580ce8`
- start_commit: `180efa5` (Sprint 135 end)
- end_commit: `f580ce8` (origin/main, 2026-04-27)
- Branch: `feat/sprint-136-critic-blog-post` (auto-deleted)

## Sprint 137+ Carryover

4 seeds carried over from Sprint 135 remain as-is for Sprint 137+:

- github-worker errorFilter wrapper + WeakSet synchronization (Wave A consistency recovery)
- ai-analysis Python CB schema unification (state 0/0.5/1 → 0/1/2 + name label)
- CLAUDE.md "ai-feedback" → actual "ai-analysis" naming correction
- E2E auto PR CI integration (Sprint 134 carryover maintained)
