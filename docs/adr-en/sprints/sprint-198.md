---
sprint: 198
title: "Blog Post — Markdown for Agents, HTML for Humans (KR+EN)"
date: "2026-05-22"
status: completed
agents: [Oracle, Scribe, Critic]
related_adrs: []
related_memory: ["sprint-window", "feedback-blog-workflow", "blog-reframing-decisions"]
topics: ["blog", "documentation", "adr"]
tldr: "Prompted by Andrej Karpathy's remark that 'for LLM output, HTML may serve people better than Markdown,' wrote one technical blog post (KR+EN) framing AlgoSu's dual-surface ADR structure (Markdown ADR = agent memory / blog's HTML ADR view = human review surface) as a retrospective essay. Verified up front that the core claim is real in code (blog/src/lib/adr/loader.ts parses docs/adr/sprints/*.md and adr-detail-view.tsx renders the HTML view). Settled the user-provided finished draft into the blog schema (excerpt/category/tags/tldr) and 경어체 tone, with an accompanying EN translation. Confirmed decisions (4 user AskUserQuestion): polite-form tone / category=retrospective / Callout only at 1-2 key points / slug=markdown-for-agents-html-for-humans. Review caught and fixed a name typo (안드레아→안드레이 카파시 / Andrej Karpathy) and 2 duplicated Callout titles. blog-crosscheck --strict 0 violations (KR 11/EN 11), 0 Korean residue in EN, blog SSG build generated both routes, Critic (codex review --base main) 0 Critical/High, CI SUCCESS 38/FAIL 0 (CLEAN). PR #349 squash → e5a8dac."
---
# Sprint 198 — Blog Post: Markdown for Agents, HTML for Humans (KR+EN)

## Goal

- Settle the user-provided finished blog draft into the `blog/` schema and tone, with an accompanying EN translation.
- Topic: prompted by Andrej Karpathy's remark that "for LLM output, HTML may serve people better than Markdown," frame AlgoSu's **dual-surface ADR structure** (Markdown ADR = agent memory / blog's HTML ADR view = human review surface) as a retrospective essay.

## Background

- Verified before starting that the post's core claim is real in code: `blog/src/lib/adr/loader.ts` parses `docs/adr/sprints/*.md` (Markdown, for agents) and `blog/src/components/adr/adr-detail-view.tsx` renders the HTML view (`/adr/sprints/<num>` etc., human review surface) with a 3-column layout + Callout isolation. So "Markdown for agents, HTML for humans" is not a post-hoc framing but an actually implemented structure.
- Blog post structure: KR `blog/content/posts/`, EN `blog/content/posts-en/` directory split (.mdx, shared slug). Required frontmatter fields = title/date/excerpt/tags/category. `check-blog-crosscheck.mjs --strict` enforces KR↔EN slug pairing + shared structural-field match (date/category/order/tags/series/seriesOrder) + category enum + link integrity (CI hard gate).
- Workflow rule: posts whose body narrative changes are reviewed by the user one post at a time ([[feedback-blog-workflow]]).

## Decisions

### D1. Body tone — polite form (user, AskUserQuestion)

- The draft was in plain form ("~했다"), but all 10 existing blog posts use the polite, experiential tone ("~했습니다"). For consistency, convert only the sentence endings to polite form while preserving the draft's content, paragraph structure, and argument. First person rendered as "저".

### D2. Category — `retrospective` (user, AskUserQuestion)

- Among the 7 blog category enum values (ai-agent/cicd/architecture/backend/platform/frontend/retrospective), picked `retrospective` to match the decision-reflection essay character.

### D3. MDX components — Callout only at 1-2 key points (user, AskUserQuestion)

- To preserve the essay flow, only 2 Callouts: ① "The two faces of a token" (`type="warn"`, "some tokens are waste, some are the cost of reducing operational risk"), ② the closing line ("When a document's purpose differs, its surface should differ too", `type="success"`). The draft's blockquotes are kept as-is.

### D4. slug + frontmatter settlement (user AskUserQuestion + technical decision)

- slug = `markdown-for-agents-html-for-humans` (shared KR/EN). Draft frontmatter conversion: `description→excerpt`, quoted `date`, added `category`, kebab-case lowercase `tags`. `relatedAdrs` omitted (no directly corresponding permanent/topic ADR; an optional field not checked by crosscheck), `order` omitted (date 2026-05-22 is the latest).

## Implementation

### Implementation commit (1 commit, PR #349 squash → `e5a8dac`)

- `chore(blog)` — 2 new post files (198 lines each):
  - KR `blog/content/posts/markdown-for-agents-html-for-humans.mdx`
  - EN `blog/content/posts-en/markdown-for-agents-html-for-humans.mdx`
  - Writing delegated to Scribe (draft → polite-form conversion + frontmatter settlement + 2 Callouts + EN translation). Oracle review fixed 2 items.

### Review fixes (Oracle)

- **Name typo**: draft's "안드레아 카파시" → "안드레이 카파시" (Andrej Karpathy). EN was written as "Andrej Karpathy".
- **Duplicated Callout titles**: #1 title nearly identical to the section heading/body → replaced with a summary phrase ("The two faces of a token"); #2 title identical to the body → title removed (one-line aphorism emphasized by the box alone). Matches the existing pattern (sprint-journey).

## Verification

- **blog-crosscheck `--strict`**: exit 0, KR 11 / EN 11, 0 violations (slug pairing · shared structural fields · category enum · link integrity).
- **EN Korean residue**: 0 (perl `\p{Hangul}`).
- **blog SSG build**: both routes `/posts/markdown-for-agents-html-for-humans` and `/en/posts/markdown-for-agents-html-for-humans` statically generated; MDX (Callout) parsing OK.
- **Critic**: `codex review --base main` (Codex) — 0 Critical/High ("valid frontmatter fields and existing MDX components. I did not identify any build-breaking syntax or functional regressions"). ✅ Mergeable.
- **CI #349**: SUCCESS 38 / SKIPPED 11 / NEUTRAL 1 / Failed **0** / `MERGEABLE`·`CLEAN` → Squash merge.

## Lessons / Patterns

- ① **Verify an essay's narrative claim against code before writing** — confirmed via Explore up front that the "split the ADRs into two surfaces" retrospective framing matches the actual implementation (loader.ts + adr-detail-view.tsx). Even a blog post loses credibility if it diverges from codebase facts, so verify claim-implementation alignment beforehand.
- ② **Don't preserve factual errors in the user's draft — fix them** — the name typo (안드레아→안드레이 카파시) is an exception to the "preserve the draft as-is" rule. Preserve tone and structure, but correct clear factual errors.
- ③ **Callout titles should be summary phrases, not repeats of the body/section heading** — a title duplicating the body or repeating the section heading is visual noise. Use a summary phrase (like sprint-journey's "해봐야만 생기는 것들"), or for a one-line aphorism, drop the title and let the box alone emphasize it.

## New Patterns

- **New blog post checklist** — 2 `.mdx` files with the same slug under KR `posts/` + EN `posts-en/`, matching shared structural frontmatter fields (date/category/tags), `check-blog-crosscheck.mjs --strict` 0 violations + 0 Korean in EN + blog SSG build generating both routes. Directory auto-scan, so no manifest/index update needed.

## Carryover

- **Sprint 199 (confirmed)**: extend the app.module smoke test to `.init()` — verify lifecycle hooks (onModuleInit) + amqplib mock to cover the RabbitMQ connection step at bootstrap-equivalent level.
- **Operational Sprint 196 migration run + server redeploy** (user/ops): `npm run migration:run` on problem_db (jsonb conversion + GIN, runbook `SET statement_timeout=0`).
- (Optional) **CI PYTHON_VERSION 3.12 → 3.13** bump (separate sprint).
- Cumulative UAT (user direct): Programmers re-submission grading / English production Grafana CB dashboard.
