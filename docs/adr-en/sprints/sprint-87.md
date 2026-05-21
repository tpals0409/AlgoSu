---
sprint: 87
title: "Blog Category System + Post 6 Reframing Complete"
date: "2026-04-14"
status: completed
agents: [Oracle, Scribe, Herald, Palette]
related_adrs: []
carryover_from: sprint-86
---

# Sprint 87: Blog Category System + Content Reframing Complete

## Context

Started with the goal of Sprint 86 carryover (Post 6 reframing) + introducing a new category system.
Performed parallel agent orchestration with 3-wave dispatch (Scribe → Herald/Palette → Scribe).

## Decisions

### D1: Post 6 (session-policy-sync) KR/EN Reframing Complete

**Change commit**: `195c839`

- Removed series footer blockquote (7-post links + previous post links)
- Converted 5 MDX custom components → standard Markdown:

| Component | Conversion Method |
|-----------|------------------|
| `<MetricGrid>/<MetricCard>` | Markdown table (label/value/hint columns) |
| `<Mermaid caption="...">` | ` ```mermaid ``` ` code block + **bold** caption |
| `<PhaseTimeline>/<PhaseMilestone>` | Numbered list (phase title — period) |
| `<Callout type="warn">` | `> **⚠️ Title**` blockquote |

- Added AI context: "In a structure with 12 agents working in parallel, this type of state mismatch is a bug that's hard to catch without seeing the whole picture at once"

### D2: Category Data Layer

**Change commit**: `12c14cd`

- `Category = 'journey' | 'challenge'` union type + `parseCategory()` function (fallback: journey)
- Added `category: Category` field to `PostMeta`
- i18n: `categoryAll`, `categoryJourney`, `categoryChallenge` (ko/en)
- Inserted `category` field in 12 MDX frontmatters (Post 1~5: journey, Post 6: challenge)

### D3: CategoryTabs Component

**Change commit**: `82abecd`

- Toss-style horizontal tab Client Component (`category-tabs.tsx`)
- Active tab bottom 2px brand bar indicator
- Accessibility: `role="tablist"`, `role="tab"`, `aria-selected`, roving tabindex

### D4: Category Filter UI + HomePage Integration

**Change commit**: `6464497`

- `PostListWithFilter` Client Component: `useState<Category|'all'>('all')` filter state
- `PostCard`: category badge next to date (journey → `bg-brand-soft text-brand`, challenge → `bg-amber-50 text-amber-700`)
- `HomePage`: Server Component maintained, `<ul>` → `<PostListWithFilter>` replaced

### D5: Build Verification — Passed

`cd blog && npm run build` — 17 static pages, SSG normal.

## Outcome

| Item | Commit | Agent |
|------|--------|-------|
| Post 6 KR/EN reframing | `195c839` | Scribe |
| Category data layer | `12c14cd` | Herald |
| CategoryTabs component | `82abecd` | Palette |
| Filter UI + HomePage integration | `6464497` | Herald |
| Sprint 87 ADR | `4467788` → updated | Scribe → Oracle |

## Carryover Items

- Post 4 (cicd-ai-guardrails) title/conclusion adjustment + MDX → Markdown conversion (`<PhaseTimeline>` removal)

## Lessons Learned

- **No duplicate agents in chain dispatch**: `herald,palette,herald` chain caused jq `select(.name)` collision. If the same agent is needed in multiple stages, separate into individual tasks.
- **Dependency between waves must be explicit**: Wave 3 (ADR) executed before Wave 2 (category), causing "carryover" misjudgment. A task dependency declaration mechanism is needed.
- **4-agent collaboration succeeded**: Scribe (content) → Herald (data/integration) → Palette (UI) → Herald (integration) pipeline completed the 6-post blog category system.
