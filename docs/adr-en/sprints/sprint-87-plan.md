---
sprint: 87
title: "Blog Category System Introduction"
date: "2026-04-14"
status: planned
agents: [Oracle, Herald, Palette]
related_adrs: []
prerequisite: "Sprint 86 Blog Reframing Complete"
---

# Sprint 87 Plan: Blog Category System Introduction

## Context

AlgoSu blog posts are separating into two distinct characters:
- **Post 1~5**: Journey/structure/retrospective posts with a bird's-eye view of the whole project
- **Post 6+**: Challenge posts that dive deep into specific technical problems

Reference research (Channeltalk, Toss, Woowahan, Kakao, LINE) concluded that **Toss style** (top horizontal tabs + single-column list + category badges) is best suited for the current scale (6 posts).

## Design Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Number of categories | 2 (`journey`, `challenge`) | Current posts clearly divide into 2 types |
| Filter UI | Top horizontal tabs (All/Journey/Challenge) | Toss reference; sidebar is overkill for 6 posts |
| Tab state management | `useState` | SSG environment, URL persistence not needed |
| Server/Client boundary | HomePage (Server) → PostListWithFilter (Client) | getAllPosts with fs dependency stays server-side, filter state on client |
| Category badge colors | journey: brand (indigo), challenge: accent-4 (amber) | Reuse existing design tokens, visual differentiation |
| Layout | Keep single-column list | Grid is overkill for 6 posts |

## Category Mapping

| slug | category |
|------|----------|
| agent-orchestration-solo-dev | journey |
| system-architecture-overview | journey |
| orchestration-structure | journey |
| cicd-ai-guardrails | journey |
| sprint-journey | journey |
| session-policy-sync | challenge |

## Changed File List

### 1. `blog/src/lib/posts.ts` — Category Type + PostMeta Extension

- `Category` union type export: `'journey' | 'challenge'`
- Add `category: Category` to `PostMeta`
- `getAllPosts()` mapping includes `category` parsing (fallback: `'journey'`)
- `getPostBySlug()` return value explicitly includes `category`

### 2. `blog/src/lib/i18n.ts` — Category Translation Keys Added

```
categoryAll: '전체' / 'All'
categoryJourney: '프로젝트 여정' / 'Project Journey'
categoryChallenge: '기술 챌린지' / 'Tech Challenge'
```

### 3. MDX frontmatter — 12 files (KR 6 + EN 6)

Add `category: "journey"` or `category: "challenge"` to each post's frontmatter.

### 4. `blog/src/components/category-tabs.tsx` — New Client Component

- 3 horizontal tabs: All / Project Journey / Tech Challenge
- Toss style: active tab bottom indicator (`after:` pseudo-element)
- Active: `text-brand` + bottom bar, Inactive: `text-text-muted`
- `role="tablist"` / `role="tab"` / `aria-selected` accessibility

### 5. `blog/src/components/post-list-with-filter.tsx` — New Client Component

- props: `posts: PostMeta[]`, `basePath: string`, `locale: Locale`
- `useState<Category | 'all'>('all')` for tab state management
- `filteredPosts = activeCategory === 'all' ? posts : posts.filter(...)`
- CategoryTabs + PostCard list rendering

### 6. `blog/src/components/post-card.tsx` — Category Badge Added

- Add `category: Category`, `locale: Locale` to props
- Display category badge next to date
- journey: `bg-brand-soft text-brand`, challenge: `bg-amber-50 text-amber-700`

### 7. `blog/src/components/home-page.tsx` — PostListWithFilter Integration

- Direct `<ul>` rendering → `<PostListWithFilter>` replacement
- HomePage remains as Server Component

## Component Tree (After Changes)

```
HomePage (Server) — getAllPosts() call
  ├── <h1> siteTitle
  ├── <p> siteDescription
  └── PostListWithFilter (Client) — posts[] props
       ├── CategoryTabs (Client) — useState
       └── <ul> PostCard × N
            ├── date + category badge ← new
            ├── title
            ├── excerpt
            └── tags
```

## Implementation Order

| # | Task | File |
|---|------|------|
| 1 | Category type + PostMeta extension | `posts.ts` |
| 2 | i18n dictionary key additions | `i18n.ts` |
| 3 | Add category to MDX frontmatter | 12 .mdx files |
| 4 | Create CategoryTabs component | `category-tabs.tsx` (new) |
| 5 | Create PostListWithFilter component | `post-list-with-filter.tsx` (new) |
| 6 | Category badge + locale prop in PostCard | `post-card.tsx` |
| 7 | Connect PostListWithFilter in HomePage | `home-page.tsx` |

## Verification

1. `cd blog && npm run build` — Confirm SSG build success
2. Docker build → k3d import → rollout restart
3. localhost:8099 main page:
   - "All" tab: all 6 posts displayed
   - "Project Journey" tab: 5 posts
   - "Tech Challenge" tab: 1 post
4. Category badge displayed normally on each card
5. EN page same behavior confirmed
6. Detail page → other posts rendering normally confirmed
