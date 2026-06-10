---
sprint: 244
title: "Model selection strategy blog post (KR+EN) + Critic model attribution fix"
date: "2026-06-10"
status: completed
agents: [Oracle, Scribe, Critic]
related_adrs: ["sprint-238", "sprint-241", "sprint-242", "sprint-237"]
related_memory: ["sprint-window", "project-model-selection-strategy", "feedback-blog-workflow"]
topics: ["blog", "ai-agent", "model-selection"]
tldr: "Adopted the user's retrospective to write the blog post 'Which Model, When, Where — A Strategy for Targeted Premium Deployment' in KR+EN (model-selection-strategy.mdx, order 11, category ai-agent, relatedAdrs sprint-238/241/242). Thesis: after switching to Fable 5 (mythos) on launch day and running the S238 security audit + ADR-030 5-sprint roadmap (S239~243), results were good but token shortage hit → 'keep daily sprints on Opus/Sonnet, inject a premium model as a targeted deployment for periodic large refactoring = paying down technical-debt principal.' A follow-up to toward-model-agnostic-harness (order 9). Scribe self-review fixed 3 P1 facts (session limit S241→S243 · merge-gate round attribution · S239 events API vs DLQ) + Critic (Codex gpt-5.5) CLEAN. Verification: crosscheck --strict 0 · SSG 423 pages · CI 38 pass/0 fail · post-merge green, PR #435 squash 32f24fa. After merge, the user caught L48 mis-attributing Fable 5's token consumption to the Codex-based Critic → corrected to 'the model holds a wider context in a single pass' (KR+EN), PR #436 squash c1d70cc. Lesson: model-attribution errors need domain-knowledge verification — neither scribe nor Codex Critic caught it."
---
# Sprint 244 — Model selection strategy blog post (KR+EN) + Critic model attribution fix

## Goal

- Instead of a deferred blog topic, **adopt the user's real-time retrospective** to write a "model selection strategy" blog post in KR+EN.
- Thesis: after switching to Fable 5 (mythos-based) on launch day and running all of S238~243 on Fable 5, results were good but a token shortage was felt → "keep daily sprints on Opus/Sonnet, and over the mid/long term inject a top-performance premium model as a targeted deployment for periodic large refactoring, which is better for long-term maintenance cost" (paying down technical-debt principal).
- Apply the blog pattern established in Sprint 237 (tone register alignment + crosscheck --strict + blog Critic).

## Background

- At the /start stage, one of three deferred topics (CS quiz S215~229 / things-built-then-deleted S185~189·193·201 / zstd) was to be chosen, but the user paused the plan and **shared their Fable 5 experience directly**: "I used the newly-released Fable 5 (mythos-based) today for security and refactoring; results were good but I ran into token shortage. I'll keep using Opus/Sonnet for now, but over the mid/long term, occasionally doing a big refactor with the top-performance model might be better for long-term maintenance cost."
- This retrospective was judged to be a strong blog topic in itself — timeliness (Fable 5 launch day), real ADR grounding (S238~243 were all the Fable 5 experiment), and continuity with the existing post toward-model-agnostic-harness (order 9).
- Confirmed direction via AskUserQuestion → "replace with the model strategy retrospective." The deferred topic "things-built-then-deleted" is postponed to the next sprint.

## Decision

### D1. Topic swap — model selection strategy retrospective (user)
- Adopted the user's retrospective over the deferred topic. Rationale: solid ADR grounding (the S238 "switched to fable model" transition record is real) + timeliness.

### D2. category·meta — ai-agent / order 11 / 3 relatedAdrs
- category `ai-agent` (same as toward-model-agnostic-harness, a model/agent topic).
- order 11 (prior max 10 = sliding-window). relatedAdrs ["sprint-238","sprint-241","sprint-242"] — Fable transition+audit, BE decomposition, FE decomposition respectively.

### D3. Strategy insight memory SSOT separation
- The model operations strategy is recorded as SSOT in `memory/project-model-selection-strategy.md` separately from the blog post (by Oracle directly). A reusable reference asset.

### D4. (Post-merge) Critic model attribution fix — Critic is Codex (user-caught)
- After merge, the user caught that body L48 "the wider context Critic sees at once" **mis-attributes Fable 5's token consumption to the Codex-based Critic**. Per CLAUDE.md, Critic is a Codex(gpt-5)-based secondary review, a separate model from Fable 5. The subject that hit the session limit was the main agent (Gatekeeper) running on Fable 5.
- Fix: replaced with "the model holds a wider context in a single pass" (EN) / "모델이 한 번에 안고 추론하는 컨텍스트" (KR). The other 4 Critic mentions (L66 redis.keys discovery · L71 cumulative rounds · L121/125 harness seat) are all accurate (the actual role of the Codex Critic) — unchanged.

## Implementation

### First draft (Scribe, PR #435 squash → `32f24fa`)
- New: `blog/content/posts/model-selection-strategy.mdx` (KR, 11.3K) + `blog/content/posts-en/model-selection-strategy.mdx` (EN, 10.3K), 2 files +258.
- Title "Which Model, When, Where — A Strategy for Targeted Premium Deployment." Narrative: intro (S243 session-limit scene) → ADR-030 audit (High Risk 0 · Medium 3 · Low 5 · improvements 7) → 5-sprint roadmap PhaseTimeline → "regressions cluster at extraction boundaries" (S241/242) → 3 ROI conditions → balancing caveats (full refactoring's diminishing returns · cost is real) → toward-model-agnostic-harness connection.
- MDX components: PhaseTimeline/PhaseMilestone, MetricGrid/MetricCard, Callout×2, Problem/Decision/Result.
- **Scribe self-review fixed 3 P1 facts**: ① session-limit incident S241→S243 ② merge-gate round attribution (translation key=auto-critic · setError=R1 · derived state=R2 · R3 CLEAN) ③ S239 timeline DLQ→events API DTO.

### Second fix (Oracle directly, PR #436 squash → `c1d70cc`)
- D4 model-attribution fix, 2 lines (KR+EN L48). Being a 2-line precise correction, Oracle handled it directly as a simple file edit (re-enacting the post's own thesis that "simple work goes on the cheap path").

## Verification

- **First (#435)**: crosscheck --strict 0 violations · blog SSG build EXIT=0 (both routes generated) · doc-refs 463 no broken · Critic (Codex gpt-5.5 --base 4c8693e) **CLEAN** (full fact cross-check · KR↔EN 1:1 · tone alignment) · CI 38 pass/0 fail · post-merge main run success.
- **Second (#436)**: crosscheck --strict 0 · SSG 423 pages success · CI fail 0 · post-merge green.
- Oracle direct memory cross-check: all core facts consistent (session limit S243 · Fable transition S238 · ADR-030 numbers · S241/242 decomposition scale · cumulative rounds BE 7+FE 8=15).

## Lessons

1. **Model-attribution errors need domain-knowledge verification.** The L48 claim "Critic sees a deep context" had accurate numbers (15 cumulative rounds) but contradicted *model identity* (Critic=Codex≠Fable 5). Neither scribe self-review nor the Codex Critic caught it — both verified numbers, structure, and tone, but the domain fact "which model is what" was caught only by the user. Consider adding a **model/agent attribution check** to the fact-consistency gate.
2. **A user's real-time retrospective is a first-class blog topic.** It had stronger timeliness and ADR grounding than the planned deferred topic. A plan-pause signal is an opportunity to pivot.
3. **Scribe self-review's fact-correction value proven.** It caught 3 P1 facts itself (session limit · round attribution · events API) via memory cross-check — raising accuracy before the Codex Critic even ran.
4. **This work itself demonstrated the post's thesis.** Daily work (blog writing) was sufficient on the Sonnet-based scribe, while deep verification like fact-consistency was handled by the Codex Critic in a cross check — exactly the "targeted deployment" structure. The 2-line fix went to Oracle directly (cheapest path).

## Deferred

- Blog topic "things-built-then-deleted" (S185~189 ADR graph & search built → S193 graph deleted · S201 search deleted retrospective) → next sprint.
- Consider adding a model/agent attribution check to the fact-consistency gate.
- Existing backlog: (harness slot) pane guard permanence + window decoration root fix (--full FAIL 1) + Codex model pin + status misrecord 3-in-a-row · `Quality — docs` required promotion · sync logging singleton context · i18n · ConfirmStep tErrors · inline style (S242 carryover) · Q-4 libs/ spike (backlog) · CI helper unit test policy · (user console) GA4 3 items · live SEO redeploy · harness cron · webhook regenerate · cumulative UAT.
