---
sprint: 237
title: "ADR review → monitoring drift blog post (KR+EN)"
date: "2026-06-09"
status: completed
agents: [Oracle]
related_adrs: ["sprint-231", "sprint-232", "sprint-234", "sprint-235", "sprint-236"]
related_memory: ["sprint-window", "blog-reframing-decisions", "feedback-blog-workflow"]
topics: ["blog", "documentation", "observability"]
tldr: "Cross-checked 174 sprint ADRs against the 11 existing blog posts to surface unwritten topic clusters (monitoring drift, CS quiz, over-engineering retrospective, the zstd experiment, etc.) and presented them by narrative strength. By user choice (#1), wrote the Sprint 231~236 monitoring saga as a blog post: outage-that-never-happened.mdx KR+EN (category platform, relatedAdrs sprint-231~236+ADR-029). It frames as 'problem→experiment→result→reflection' the six-sprint journey of declaring a runtime defect from a static manifest (a non-deployed mirror), correcting it with an ERRATA, then finding the real causes live (missing cAdvisor scrape, promtail label mismatch, Loki OOM) and applying an alert channel split. On user request, the voice was quantitatively checked: the draft's formal register (습니다97/어요11) clashed with the confessional-journey genre → harmonized to a warm colloquial register (습니다47/어요61), matching the closest analog sliding-window-agent-context (45/64), plus 2 blockquotes for the pivotal realizations. Verification: cross-check --strict 0 violations, blog SSG build EXIT=0, Critic (Codex gpt-5.5) R1 [P2 logical contradiction in principle (iii): reintroducing a retracted misjudgment] → corrected → R2 CLEAN. PR #424 squash merge."
---
# Sprint 237 — ADR review → monitoring drift blog post (KR+EN)

## Goal

- Review recent ADR/sprint records to surface candidate topics not yet written as blog posts, and present them.
- Write a technical blog post (KR+EN) on the user-chosen topic, confirm voice alignment with existing posts, and merge.

## Background

- Started with the `/start` argument "check the ADRs and tell me if there's new blog material."
- The blog has 11 posts as `blog/content/posts/` (KR) + `posts-en/` (EN) pairs, covering up to the latest post `markdown-for-agents-html-for-humans` (2026-05-22, written in Sprint 198). Sprints 199~236 (~38 sprints) are an unwritten window.
- Blog consistency is enforced by a CI hard gate (`check-blog-crosscheck.mjs --strict`): KR↔EN slug pairing + structural fields (date/category/order/tags/series) fully matching + category enum of 7 (ai-agent/cicd/architecture/backend/platform/frontend/retrospective) + internal link integrity.

## Topic discovery (174 ADRs ↔ 11 blog posts)

Unwritten topics presented by narrative strength:

1. **The great monitoring drift incident (S231~236)** — a complete arc of static-analysis misjudgment → ERRATA → live diagnosis & resolution, with [[feedback-source-vs-live-drift]] as its spine. **Top recommendation.**
2. **CS quiz minigame (S215~229)** — a new feature from zero (core → question bank → record integration → a11y → bundle optimization).
3. **Things built then deleted (S185~189·S193·S201)** — built then removed the blog graph/search; an over-engineering retrospective.
4. (lower priority) zstd compression experiment rollback (S165~171) · GitOps SSOT consolidation (ADR-029) · GA4/SEO (S210~213) · harness polymorphism (S202·S214).

→ User chose **#1**.

## Work summary (start `73b4a11`, 4 commits → squash `95c9f92`, PR #424)

- `48ba138` `docs(blog)`: new `outage-that-never-happened.mdx` KR+EN. category `platform`, relatedAdrs sprint-231~236+ADR-029. Narrative: static-manifest misjudgment (S231) → ERRATA·mirror demotion·Loki OOM (S232) → live-first diagnosis (cAdvisor/promtail/S234) → alert gap closure (CB unification·DLQ placeholder swap/S235) → channel split live (S236). Four reflection principles.
- `7a315ee` `style(blog)`: harmonized the KR voice to the journey register (습니다 97/어요 11 → 47/61), blockquotes 1→2. Aligned with sliding-window (45/64).
- `fix(blog)`: corrected the logical contradiction in principle (iii) (Critic R1 P2) — reframed the null receiver as the "that's why I was fooled (non-deployed mirror)" concept, and the actually-deployed case as the DLQ (unemitted metric). KR+EN simultaneously.

## Key decisions

1. **Topic priority = narrative completeness**: recommended the monitoring drift as #1, being the most recent and with a complete failure→correction→resolution arc. Best fit for the retrospective tone (problem→experiment→result→reflection).
2. **Verify voice quantitatively**: in response to "check if the voice matches existing posts," measured the sentence-ending distribution. Confirmed the blog splits into two registers — formal (ci-refactoring 147/0·markdown-for-agents 64/2) and warm colloquial (sliding-window 45/64·toward-model-agnostic 27/34) → this confessional/journey-genre post fits the latter → harmonized KR to 47/61.
3. **Critic as the merge gate**: blog content goes through Codex cross-review too. Critic caught a logical contradiction in the principles section (an assertion at odds with the article's core correction) → corrected, then R2 CLEAN.
4. **EN keeps its English voice**: the English edition has no sentence-ending issue and is not a harmonization target; it follows the first-person retrospective tone of the existing EN posts.

## Verification

- **cross-check `check-blog-crosscheck.mjs --strict`**: KR 12 / EN 12, 0 violations (all 3 axes: parity·schema·link).
- **blog SSG build `npm run build`**: EXIT=0, `/posts/outage-that-never-happened` + `/en/posts/...` statically prerendered.
- **voice quantitative (after harmonization)**: 습니다 47 / 어요-family 61 / blockquotes 2 — aligned with sliding-window (45/64/2).
- **Critic** (Codex gpt-5.5, `codex review --base 73b4a11`): **R1 [P2]** principle (iii) asserted "the null receiver swallowed alerts (first incident)," contradicting the article's core correction (non-deployed mirror·live healthy) and reintroducing the retracted misjudgment for readers who skim only the principles → corrected → **R2 CLEAN** ("no actionable correctness issues were found in the diff"). (Default models gpt-5.3/5.5-codex are unsupported on a ChatGPT account → ran with `-c model=gpt-5.5`.)
- **CI PR #424**: `Quality — docs` (blog cross-check)·`Secret & Env Scan` and all checks green, auto-merge SQUASH.

## Lessons

1. **Topic discovery starts with a coverage cross-check** — cross-referencing the blog (11 posts) and ADRs (174 sprints) by date and topic reveals the unwritten window (S199~236) and narrative clusters. "Is there anything to write?" is a question an index cross-check can answer.
2. **Voice alignment is measured, not felt** — "does the voice match" is quantifiable via sentence-ending distribution (습니다 vs 어요-family). Since the blog hosts two registers, picking the one **that fits the post's genre** is the answer (confessional/journey → colloquial).
3. **Critic adds value even for blog content** — even without code, Codex caught an internal logical contradiction (a principles section at odds with the body's correction). In a retrospective, "lessons/principles" that conflict with the body's facts break trust.
4. **The recursion of the meta-lesson** — writing about the monitoring post's core ("static ≠ runtime," "the source repo drifts from live") is itself a propagation of [[feedback-source-vs-live-drift]]. One instance of the ADR (agent memory) → blog (human review surface) conversion.

New pattern: **coverage-cross-check topic discovery + quantitative voice alignment** (cross-reference blog↔ADR indices to surface unwritten clusters, verify register alignment via sentence-ending distribution).

## Carryover

- (user console) GA4 remaining 3 (Enhanced Measurement page_view dedupe OFF · production UAT · stream URL `algo-su.com` alignment).
- (user/ops) live SEO verification (after redeploy, sitemap/robots `algo-su.com` domain alignment).
- Review periodic monthly cron automation for harness checkup `--full` in CI.
- (optional) webhook regenerate · accumulated UAT (Programmers resubmission grading / English Grafana CB dashboard).
- (blog follow-up topics) CS quiz minigame (S215~229) · things built then deleted (S185~189·193·201) · zstd experiment rollback (S165~171).
