---
sprint: 107
title: "CI Refactoring Blog — Channeltalk Reference Application: Single Comprehensive Post"
period: "2026-04-21"
status: complete
start_commit: bbaf974
end_commit: a3ab0b4
---

# Sprint 107 — CI Refactoring Blog: Channeltalk Reference Application

## Background

Sprints 102–106 refactored AlgoSu's CI pipeline over 5 sprints using the Channeltalk Backend CI Refactoring post ([https://channel.io/ko/team/blog/articles/backend-ci-refactoring-73fca77d](https://channel.io/ko/team/blog/articles/backend-ci-refactoring-73fca77d)) as a reference. Decisions, numbers, and lessons remain in `docs/adr/sprints/sprint-102.md ~ sprint-106.md` and `memory/project-ci-refactoring-roadmap.md`, but were scattered without a reader-facing narrative.

Sprint 107 consolidates this 5-sprint journey into a **single comprehensive blog post**. The differentiator is centering the narrative on "the process of translating — not directly translating — the reference into the context of a solo developer + AI agent orchestration."

## Goals

| Item | Content | Status |
|------|---------|--------|
| Single comprehensive post | Channeltalk reference application frame, 500–700 lines | ✅ Complete (501 lines) |
| Fact verification | Direct cross-reference with Sprint 102–106 ADR numbers | ✅ Complete (13 items matched) |
| Blog build verification | `blog/ npm run build` SSG 20/20 | ✅ Complete |
| Deployment (main merge) | PR squash merge | ✅ Complete (#128, #129) |

---

## Decisions

### D1. Structure: Single Comprehensive Post (not a series)

**Decision**: Single post, not a 4–5 part series.

**Rationale**:
- The reference Channeltalk post itself is a single post format
- The central message spanning all 5 sprints ("reference → context translation → 0 implementation lines conclusion") is weakened when split into series
- User blog workflow feedback: "single-post cycle (plan→review→write)" — single post is natural

**Alternative deferred**: Series expansion retained as Sprint 108+ candidate but not mandatory.

### D2. Frame: "Reference Application"

**Decision**: Narrative framed as "borrow principles + translate context."

**Rationale**:
- Existing blog post `cicd-ai-guardrails.mdx` covers CI topic → need differentiated angle to avoid duplication
- Not simply translating/summarizing the Channeltalk post, but explicitly comparing what was and wasn't adopted provides reader value
- Highlights AlgoSu's unique context of solo developer + AI agent structure

### D3. Agent Assignment Correction — Scribe Alone

**Decision**: Simplified plan's original Librarian/Herald assignment to Scribe alone.

**Rationale**:
- **Librarian**: Role is DB schema/TypeORM Migration management — unsuitable for blog fact verification
- **Herald**: Role is Frontend UI implementation — commit/PR role is Oracle/PM domain
- **Scribe**: Dedicated to documents/memory/prompts → can handle fact verification (direct ADR Read) + MDX draft writing in parallel

**Lesson**: Agent domain matching must be re-verified by Oracle immediately before dispatch, separate from plan approval. Extension of Sprint 102 "CI is Gatekeeper's domain → Architect reassignment" lesson.

### D4. Title Simplification

**Decision**: Draft title "I read the Channeltalk CI post and did 5-sprint refactoring myself" → **"AlgoSu CI Refactoring"**.

**Rationale**: User feedback. Clean and short form. Reference mention sufficiently handled in post intro — removed from title redundancy.

### D5. "We" → "AlgoSu" Tone Unification

**Decision**: Replace all 4 occurrences of "we" (inappropriate for solo developer context) with "AlgoSu."

**Rationale**: AlgoSu is solo developer + AI agent structure, so "we" is ambiguous. Unified with proper noun subject.

---

## Outputs

- **New file**: `blog/content/posts/ci-refactoring-reference-to-reality.mdx` (501 lines)
  - frontmatter: title="AlgoSu CI Refactoring", category=journey, order=8, tags=["ci-cd", "github-actions", "ai-dev", "refactoring"]
  - 9 sections: intro → reference rationale → 4-sprint roadmap → S102 → S103-104 → S105 → S106 → 4 principles → unfinished story
  - MDX components: `<PhaseTimeline>`, `<PhaseMilestone>`, `<Callout>` (info/warn/success), `<MetricGrid>`, `<MetricCard>`
  - 6 code blocks: dependabot.yml, auto-merge workflow YAML, Branch Protection, Composite action YAML, check-coverage.mjs, commitlint + husky setup
  - Channeltalk URL cited 2 times
- **PR #128** (`599a71f`): 501 lines new file
- **PR #129** (`a3ab0b4`): Title simplification (1-line edit)
- **Verification**: `blog/ npm run build` SSG 20/20 success, `/posts/ci-refactoring-reference-to-reality` path renders correctly

## Fact Verification Results (Scribe cross-reference, 13 items)

| Item | ADR source | Value used |
|------|-----------|-----------|
| Dependabot pending PRs | sprint-102 | 30 → 2 |
| PR #102 SHA | sprint-102 | `46aeb73` |
| Composite lines deleted | sprint-104 | 67 lines |
| 3 Post run numbers | sprint-105 | `24702740418` · `24702828670` · `24703075569` |
| Quality Pre→Post | sprint-105 | +0.4% (+0.1s) |
| Audit Pre→Post | sprint-105 | -8.9% (-1.8s) |
| Test Pre→Post | sprint-105 | +3.9% (+0.8s) |
| runner-minutes savings | sprint-105 | 75% |
| Frontend branches Before | sprint-106 | 69.55% (1302/1872) |
| Frontend branches After | sprint-106 | 76.42% |
| New test count | sprint-106 | 77 |
| PR #121·#122 | sprint-106 | Match |
| Channeltalk URL | plan + all ADRs | Accurate |

All 13 items `✅` matched.

---

## Lessons Learned

### 1. Effectiveness of Blog Workflow Feedback

The "single-post cycle (plan→review→write)" feedback dominated Sprint 107's entire flow. User agreement on single/series choice at plan stage → one tone adjustment ("we→AlgoSu") after draft → one title simplification revision cycle. If executed in batch, both would have required post-production correction at higher rework cost.

### 2. Re-verification Timing for Agent Domain Matching

Librarian/Herald were assigned in the plan, but Oracle re-verified agent specs immediately before dispatch and corrected to Scribe alone. Reconfirmed that a "domain matching re-check" step is needed between plan approval and dispatch. Same lesson from Sprint 102 establishing as an operating rule.

### 3. Importance of Direct ADR Number Cross-Reference

Blog posts are public-facing, so factual errors damage credibility. Scribe's approach of directly Reading 5 ADRs and including a 13-item cross-reference table in the results report greatly reduced post-publication verification burden. Consider promoting "agent self-cross-reference table" pattern as a standard for blog/public document work.

### 4. MDX Component Reuse for Tone Consistency

Reused `<PhaseTimeline>`, `<Callout>`, `<MetricGrid>` usage patterns from the existing `cicd-ai-guardrails.mdx` to maintain blog-wide tone consistency. Pure reuse was sufficient without creating new components.

### 5. Benefit of "No Commit Until Review" Constraint

The "no commit after draft, wait for user review" constraint aligned precisely with the blog workflow feedback. User revisions (tone adjustment → title) intervened at the point when Scribe's result report arrived in inbox, naturally separating into 2 distinct PRs.

---

## Carried Over (Sprint 108+)

### Carry-overs Inherited from Sprint 106 (No Change)

- **Sprint 108 core decision candidates**: Blog/Frontend host-side build migration (true L2 achievement path, 40–60% expected reduction)
- APK_CACHE_BUST conditionalization, NestJS tsc incremental, Monaco dynamic import, heavy deps audit
- ai-analysis `branch=true`, submission/problem/identity lcov actual collection
- `check-coverage.mjs` per-service independent gate

### New Carry-overs from Sprint 107

- **Series expansion candidate**: Currently 1 single comprehensive post. Deep-dive on specific topics (pre-consultation pattern, Composite Action, Coverage Gate, etc.) not mandatory but retained as Sprint 108+ option.
- **Blog post metadata policy**: `order` field manually managed (max+1 method). As posts increase, consider switching to auto-assignment or date-based sorting.

---

## Related Documents

- `blog/content/posts/ci-refactoring-reference-to-reality.mdx` — output
- `blog/content/posts/cicd-ai-guardrails.mdx` — tone/component reference
- `docs/adr/sprints/sprint-102.md ~ sprint-106.md` — fact sources
- `memory/project-ci-refactoring-roadmap.md` — full roadmap
- `/Users/leokim/.claude/plans/drifting-wishing-thacker.md` — approved plan
- External: [Channeltalk Backend CI Refactoring](https://channel.io/ko/team/blog/articles/backend-ci-refactoring-73fca77d)
