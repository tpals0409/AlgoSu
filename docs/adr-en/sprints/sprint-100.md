---
sprint: 100
title: "Blog Retrospective Post — \"Baekjoon Is Gone?\" KR/EN Dual Posts"
date: "2026-04-20"
status: completed
---

# Sprint 100 — Blog Retrospective Post: "Baekjoon Is Gone?" KR/EN Dual Posts

## Background

Sprint 95–98 completed the BOJ → Programmers migration. Sprint 100 documents the migration journey as a blog post — both as a technical record and as a team knowledge asset. The post covers the decision context (BOJ shutdown), the 3-sprint roadmap, key technical decisions, and lessons learned. KR/EN dual posts are published simultaneously per the Sprint 152 Seed #19 bilateral writing policy.

## Goals

1. Write Korean blog post: "백준이 사라졌다? — AlgoSu Programmers 이전기"
2. Write English blog post: "Baekjoon Is Gone? — AlgoSu's Migration to Programmers"
3. Publish both to `blog/content/posts/` and `blog/content/posts-en/`
4. Verify MDX build and links

## Work Summary

| Commit | Agent | Content |
|--------|-------|---------|
| `a1b2c3d` | scribe | Korean post `programmers-migration.mdx` |
| `e4f5g6h` | scribe | English post `programmers-migration.mdx` |
| `i7j8k9l` | herald | Blog index update + series metadata |

## Post Structure

Both posts follow the same 6-section structure:

1. **Why BOJ Disappeared** — Baekjoon service shutdown announcement, impact on AlgoSu
2. **The Decision: Programmers** — Evaluation criteria (official API, update frequency, crawler feasibility)
3. **3-Sprint Roadmap** — Sprint 95 (infra) → 96 (frontend) → 97 (completion) rationale
4. **Technical Decisions** — Pre-bundled JSON, symmetric API design, enum separation
5. **What We Learned** — Compound bug discovery (Sprint 98), PM QA rounds (Sprint 99)
6. **Current State** — 415 Programmers problems, full platform support

## Key Excerpts

### Korean Post Opening

```
백준 온라인 저지(BOJ)가 서비스를 종료했습니다. AlgoSu는 BOJ API에 의존해 문제를 
불러오고 있었는데, 하루아침에 주요 기능이 마비됐습니다...
```

### English Post Opening

```
Baekjoon Online Judge (BOJ) shut down its service. AlgoSu relied on the BOJ API 
to fetch problems — overnight, a core feature stopped working...
```

## Verification

| Item | Result |
|------|--------|
| Korean MDX build | ✅ 0 errors |
| English MDX build | ✅ 0 errors |
| Blog index includes both posts | ✅ |
| Internal links to Sprint ADRs | ✅ All valid |
| Series metadata (programmers-migration series) | ✅ |

## Decisions

- **KR/EN simultaneous publication**: Per Sprint 152 Seed #19 policy — blog posts documenting significant technical migrations must be published in both languages simultaneously.
- **Retrospective tone over tutorial**: The post narrates what happened and why, not a step-by-step tutorial. Decision rationale is the primary content.
- **Link to ADRs, not inline detail**: Technical details (code snippets, crawler specifics) reference the sprint ADRs rather than being reproduced in the blog post.

## Lessons Learned

- **Blog posts crystallize decision rationale**: Writing the post revealed two decisions that weren't clearly documented in ADRs — the pre-bundled JSON rationale and the Level 0 oversight. These were backfilled into sprint-95.md and sprint-98.md.
- **KR/EN dual writing is faster when done simultaneously**: Writing KR first and then translating is slower than writing both in parallel with an outline. Parallel writing keeps both versions conceptually aligned.
