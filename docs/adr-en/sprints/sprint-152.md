# Sprint 152 — Blog [Technical Challenge] — Sliding Window for Agent Context Optimization

- **Status**: Completed ✅
- **Period**: 2026-05-13 (single day)
- **Trigger**: User request (blog post authoring)
- **start_commit**: `4313561` (Sprint 151 hotfix end)
- **end_commit**: `3873f6d` (Sprint 152 English version end)
- **Merged PRs**: 3 (squash merge)

## 1. Background / User Request

Operational experience accumulated in AlgoSu's agent collaboration workflow — particularly the **need for maintenance-perspective documentation** + **context optimization via sliding window system introduction** — was compiled into a [Technical Challenge] category blog post. Sprint 145~151 accumulated zero-regression operational results were used as empirical evidence.

## 2. Decisions

### 2.1 Post Concept
- **Category**: `challenge` (same as the 3 existing posts: `toward-model-agnostic-harness` / `baekjoon-gone` / `session-policy-sync`, order: 10 — previous max=9)
- **3-step core logic** (presented directly by user):
  1. Memory is volatile → documentation is essential (especially in agent collaboration)
  2. Referencing all documents every session = "pouring water into an already-full bucket" (paradox)
  3. Drawing on the sliding window algorithm → introduced as a solution
- **Title**: "Memory Fades, Documents Pile Up — Optimizing Agent Context with a Sliding Window"

### 2.2 i18n Policy
- All existing 9 posts have both KR (`blog/content/posts/`) + EN (`blog/content/posts-en/`) versions
- New posts are also obligated to have both versions — missed in this sprint and immediately corrected after user prompt (PR #235)
- English version tone reference: `toward-model-agnostic-harness.mdx` (1st person, dash emphasis, **bold** pattern)

### 2.3 Body Format
- mdx components: `MetricGrid`/`MetricCard` × 2, `Callout` × 1
- mermaid × 2 (state machine + 4-layer storage structure)
- ASCII diagrams × 2 (context accumulation + sliding window principle)
- 7 GitHub URLs embedded directly in body (no footnotes) — ADR directory / sprint-145·151 ADR / CLAUDE.md / `.claude/commands/agents/`

### 2.4 Immediate Re-routing on Broken Plan Assumption (Sprint 147 Lesson Directly Applied)
- User's plan specified "librarian dispatch" but persona cross-check revealed librarian = DB persistence/migration specialist (outside document curation domain)
- Immediately re-routed to Scribe solo handling — Scribe's exact domain: "exclusively responsible for accuracy and currency of all project memory, documents, and prompts"
- Blog work has a fast user review cycle → Oracle proceeded directly in Scribe persona instead of tmux dispatch

## 3. Implementation Flow

### 3.1 PR #233 — Korean Version New (`9034a66`)
**1 commit, 1 file, +297**

- `blog/content/posts/sliding-window-agent-context.mdx` newly created
- frontmatter: title / date(2026-05-13) / category(challenge) / order(10) / tags 5 types (`agent`, `documentation`, `sliding-window`, `context-optimization`, `claude-code`)
- Body 10 sections:
  1. The 152nd Sprint, and Accumulated ADRs (introduction)
  2. Memory Is Volatile — Both Humans and Agents Forget
  3. Documentation Really Worked — Empirical Evidence: 8 Regression Blocking Dimensions Accumulated from Sprint 145~151
  4. But — The Documents Themselves Started Becoming the Enemy
  5. The Full Bucket Analogy — lost-in-the-middle, attention dispersion
  6. The Sliding Window Algorithm — Returning to Algorithm Time
  7. sprint-window.md size 2 + idle/active status state machine
  8. 4-Layer Storage Structure — Separating "Where We Forget" from "Where We Remember"
  9. Operational Results — 7 Sprints Zero Regressions + Auto-Critic One-Set Philosophy
  10. Learning to Forget Was Learning to Remember (closing)

### 3.2 PR #234 — Fact Correction Hotfix (`9c8caa3`)
**1 commit, 1 file, +4 -4**

- Immediately after merge, user fact-check pointed out: sprint-by-sprint ADRs were introduced starting Sprint 62 and have accumulated to nearly 90, but the draft had 4 inaccurate expressions
- 4 corrections:
  - H2: "The 152nd Sprint, and 152 ADRs" → "Accumulated ADRs"
  - Introduction: "from sprint-001 to sprint-151" → Sprint 62 introduction background + "from sprint-62 to sprint-151, nearly 90"
  - Body mid-section: "When the ADR count exceeded 100" → "When sprint-by-sprint ADRs had accumulated to nearly 40"
  - Closing: "ADRs will grow from 152 to 200, 300" → "Sprint-by-sprint ADRs will grow from 90 to 100, 200"
- Factual basis: `git ls-tree -r main --name-only | grep "docs/adr/sprints/"` → sprint-62.md ~ sprint-148.md, **85 tracked** (sprint-149/150/151 untracked separately)

### 3.3 PR #235 — English Version Added (`3873f6d`)
**1 commit, 1 file, +297**

- Immediately after merge, user pointed out i18n omission
- `blog/content/posts-en/sliding-window-agent-context.mdx` newly created
- English title: "Memory Fades, Documents Pile Up — A Sliding Window for Agent Context"
- All PR #234 fact corrections simultaneously applied (Sprint 62 introduction / nearly 90 / ~40 accumulated point / 90~200 outlook)
- Tone match: `toward-model-agnostic-harness.mdx` reference — 1st person + dash emphasis + **bold** pattern
- mdx components / mermaid / ASCII / 7 GitHub URLs all 1:1 identical to Korean version

## 4. Verification

| PR | CI | mergeStateStatus | Notes |
|----|----|------------------|-------|
| #233 | 28 SUCCESS / 0 FAIL / 11 SKIPPED | BEHIND → CLEAN | update-branch then merge |
| #234 | 28 SUCCESS / 0 FAIL / 11 SKIPPED | CLEAN | hotfix passed immediately |
| #235 | 28 SUCCESS / 0 FAIL / 11 SKIPPED | CLEAN | English version passed immediately |

- **i18n verification**: KR (`blog/content/posts/`) **10 posts** = EN (`blog/content/posts-en/`) **10 posts** ✅
- **mdx component existence verification**: `MetricGrid`/`MetricCard` (`blog/src/components/blog/metric-grid.tsx`), `Callout` (`blog/src/components/blog/callout.tsx`)
- **Branch discipline ✅**: All 3 PRs use new branches + Squash merge — **18 consecutive sprints compliant** (since Sprint 134 violation), 0 direct commits to main

## 5. New Patterns

- **Immediate re-routing on broken plan assumption (Sprint 147 lesson directly re-applied)**: User's plan specified "librarian dispatch" but persona cross-check revealed domain mismatch → immediately re-routed to Scribe solo handling, 0 cycle impact. Same pattern recurred after 5 sprints
- **Blog work dispatch bypass pattern**: 0 code changes + fast user review cycle → Oracle directly adopts persona instead of tmux dispatch. Suitable for single-post unit (plan→supplement→write) cycle (feedback-blog-workflow)
- **User direct fact-check as the last safety net for posts**: Auto-Critic and CI cannot catch factual accuracy. Domain facts (ADR start sprint / accumulation count, etc.) require grep cross-check procedure before merge — automation candidate
- **i18n omission immediate hotfix pattern**: New blog posts are obligated to have both KR + EN versions, but omitted in this sprint → immediately corrected PR after user prompt. Plan stage i18n obligation specification procedure needed — automation candidate
- **Single-day 3 PR bundled response pattern (Sprint 150/151 hotfix pattern directly inherited)**: User prompt → new PR → CI green → Squash merge average ~5 minute cycle. Fact correction / i18n omission both responded to rapidly with separate hotfix PRs (no waiting/deferral)

## 6. Lessons Learned

- **Plan agent mappings require domain cross-check (Sprint 147 lesson reconfirmed)**: librarian = DB persistence, scribe = documentation — must verify `## Role & Core Responsibilities` + `## Prohibited Actions` in persona files (`.claude/commands/agents/{name}.md`). Skipping domain verification at plan stage impacts cycle
- **User direct fact-check is the last safety net that cannot be automated**: CI/Critic are code consistency verification tools, not domain fact verification tools. Blog post domain facts (sprint numbers / ADR introduction point / accumulation count, etc.) need grep cross-check explicitly specified in plan stage checklist
- **i18n omission is the most frequent debt in new content creation**: Dual-version policy is documented but easily missed at plan stage. Plan template needs to include "EN English version" work item as default
- **Post-merge prompt → immediate hotfix is the standard (Sprint 150/151 verified → Sprint 152 reconfirmed)**: Fact corrections / i18n omissions / Trivy CVEs all responded to rapidly with separate hotfix PRs. Waiting/deferral risks debt accumulation. Single-day 3 PRs also have low cycle impact
- **Single-post unit (plan→supplement→write) cycle for blog work validated**: feedback-blog-workflow policy applied correctly. One post = single sprint, plan stage user agreement → scribe writes → user review → merge flow works well. Inline handling sufficient without tmux dispatch

## 7. Sprint 153 Carryover Seeds

### UAT User Direct (Outside Oracle's Scope)
- Seed #5: Programmers resubmission scoring pass confirmation (9 sprints accumulated — Sprint 145~152)
- Seed #9: English environment + production Grafana CB dashboard ai-analysis visual consistency (9 sprints accumulated)

### Automation Candidates (2 New Seeds from Sprint 152)
- Seed #18: Blog post pre-merge domain fact cross-check automation (e.g., ADR accumulation count / sprint numbers / GitHub URL validity). Specification in plan template checklist + lint rule if possible
- Seed #19: KR/EN dual simultaneous authoring plan obligation for new blog posts — plan template update + CI rule ("when posts/X.mdx added, posts-en/X.mdx mandatory" matching)

### Follow-up (Sprint 151 unchanged + 0 new from this sprint)
- create/edit page.tsx category UI addition (palette assessment: low user scenario frequency)
- Programmers URL automatic category inference (sourceUrl pattern matching)
- Existing SQL problem data backfill (manual ADMIN or import script)
- Sprint 150 unresolved 3 candidates (`.claude-tools/` cleanup / CI paths filter bypass debt check automation / prom-client default metric stale check)

## 8. Deliverable Links

- **Blog post (KR)**: `blog/content/posts/sliding-window-agent-context.mdx`
- **Blog post (EN)**: `blog/content/posts-en/sliding-window-agent-context.mdx`
- **PR #233**: <https://github.com/tpals0409/AlgoSu/pull/233> (Korean version new)
- **PR #234**: <https://github.com/tpals0409/AlgoSu/pull/234> (fact correction hotfix)
- **PR #235**: <https://github.com/tpals0409/AlgoSu/pull/235> (English version added)
