---
sprint: 74
title: "Blog UI Optimization — Visual Component Layout Fix · Content Fact Verification · 3-way Dark Theme"
date: "2026-04-10"
status: completed
agents: [Oracle, Palette, Scribe, Explore, Gatekeeper]
related_adrs: [sprint-73.md, sprint-72.md]
---

# Sprint 74: Blog UI Optimization

## Context

Sprint 73 completed blog visual assets (shadow 11/11, dark mode toggle, post navigation), but during Scout verification three types of unresolved residuals emerged: (1) layout defects in some visual components like HierarchyTree and ServiceCard where sibling rail connections were weak or long text was cut off with `truncate`, (2) **numeric values hardcoded in MDX body — like "Sprint 67 / 2,432 tests" — diverged from actual metrics at Sprint 73 completion** (sprint-journey Phase 4 range still shown as "56~67"), (3) **3-way dark theme toggle** (no system return path) carried over from Sprint 73 D5 Note.

Sprint 74 bundled these three axes as "blog UI optimization." Since all tasks remain within `blog/` file boundaries with no service or infrastructure impact, each task was processed single-session serially with lighter overhead than Sprint 73 P2 (implementation + independent verification 2-stage). For 74-2, fact-checking required simultaneously reading 4 posts, so **4 Explore agents were launched in parallel** to split the fact-check. 74-3 **directly reused** the Sprint 73-6 implementation base (next-themes 0.4.6, `ThemeProvider` wrapper, mounted guard) and was completed with a single `theme-toggle.tsx` file change.

As a result, this sprint resolved "3-way toggle" from Sprint 73 carryovers while closing the blog design series running from Sprint 72~73 with **actual user readability residuals (74-1)** and **content accuracy (74-2)**.

## Decisions

### D1: Visual Component Layout Fix — truncate Removal + flex-wrap Allowed (74-1)

- **Context**: `ArchService`/`ServiceCard` h4 was fixed with the `truncate` class, causing long service names (e.g., `github-worker`, `ai-analysis`) and port to render with the latter part cut off with ellipsis when displayed together. `HierarchyTree` sibling top rails were drawn as only `w-px` 1px lines, weakening the connection feel in dark mode when border contrast was low. `HierarchyNode` had no means to place Tier section labels separately above cards, so when grouping 11 agents into Tier 1/2/3, section headers were awkwardly wedged between nodes.
- **Choice**:
  - `ServiceCard`/`ArchService`: Remove `truncate` + `flex-wrap` + `leading-tight` to keep long name + port on the same line while allowing natural line breaks when space is insufficient. Prevents cutoff on mobile.
  - `HierarchyTree`: Strengthen sibling rail and hook thickness from `w-0.5`/`h-0.5` **1px → 2px**. Ensures visibility even in border-on-border low contrast environments.
  - `HierarchyNode`: Add `groupLabel` prop → renders Tier section labels as block elements above nodes. Inject Tier 1/2/3 labels for Conductor/Architect/Sensei nodes in `agent-orchestration-solo-dev.mdx` for visual grouping of 11 agents.
  - `system-architecture-overview.mdx` ServiceCard port notation normalized from `"9100 metrics"` → `"9100"`, moving metrics context to `role` field. Ensures semantic consistency of the port field (numbers only).
- **Alternatives**:
  - (A) Increase card width to extend truncate tolerance — still cuts off on mobile, responsive limitation unresolved
  - (B) Switch HierarchyTree rail to CSS `outline` based — risk of browser rendering differences
  - (C) Create `<HierarchySection>` wrapper component instead of groupLabel — API surface expansion cost exceeds prop addition cost
- **Code Paths**: `blog/src/components/blog/hierarchy-tree.tsx` (+79/-37), `blog/src/components/blog/service-grid.tsx`, `blog/src/components/blog/architecture-map.tsx`, `blog/content/adr/agent-orchestration-solo-dev.mdx`, `blog/content/adr/system-architecture-overview.mdx`

### D2: Content Fact Verification — Explore 4 Parallel Fact-check + Bulk Numeric Correction (74-2)

- **Context**: During Sprint 72~73 focus on blog design and visual assets, numeric values hardcoded in MDX body remained fixed at Sprint 67 completion benchmarks. Up to a 6-sprint gap from the current Sprint 73 completion point (~71 sprints, ~2,453 tests). In particular, `sprint-journey.mdx` Phase 4 range remained `56~67`, missing recent milestones (Sprint 70 visuals, 71 session lifetime, 73 security hotfix).
- **Choice**: **4 Explore agents simultaneously delegated** to fact-check 4 major posts (agent-orchestration-solo-dev, meet-the-agents, orchestration-structure, sprint-journey) in parallel. Each Explore cross-references all numeric values, sprint references, and milestones from their assigned post against actual assets (`docs/adr/sprints/`, MEMORY.md, sprint-window.md). Oracle converges fact-check results:
  - **system-architecture-overview** (100% pass) + **cicd-ai-guardrails** ("CI 15 jobs" accurate for push-on-main basis) → **no changes**
  - **4 posts corrected**: "Sprint 3~67 / 65 / 67 / 73rd" → "Sprint 3~73 / 71 / 73 / 73rd" unified, "2,432 tests" → "**approximately** 2,453" (`approximately` prefix for variation defense)
  - `agent-orchestration-solo-dev`: Added 1 line of Sprint 70s milestones (visuals, session 4-layer, design tokenization, security hotfix)
  - `sprint-journey`: Phase 4 range `56~67` → `56~73` + 3 PhaseMilestones added (Sprint 70/71/73), ending "Sprint 68 is empty" → "Sprint 74"
  - Historical event references (Sprint 67/63/64 etc.) verified against actual ADRs and retained
- **Alternatives**:
  - (A) Sequential fact-check of 4 posts in a single session — one session must hold context for all 4 posts, risk of confirmation bias + cross-reference omissions. Parallelization lets each Explore focus on only their 1 post.
  - (B) Introduce variable references instead of numeric values in MDX (`<Metric name="sprintCount" />`) — runtime data source design cost exceeds one-time correction. To be handled separately in Sprint 72 carryover "Hero/MetricGrid" work.
- **Code Paths**: `blog/content/adr/agent-orchestration-solo-dev.mdx`, `blog/content/adr/meet-the-agents.mdx`, `blog/content/adr/orchestration-structure.mdx`, `blog/content/adr/sprint-journey.mdx`
- **Note**: Adding "approximately" prefix is not a simple typo fix but a **variation defense notation** strategy. Given that test count varies by tens each sprint, exact numeric notation requires re-correction alongside each sprint's ADR update. `approximately 2,453` allows ±1% variation tolerance.

### D3: 3-way Dark Theme Toggle — theme vs resolvedTheme Distinction (74-3)

- **Context**: Sprint 73-6 (`0c250bf`) introduced next-themes 0.4.6 based dark mode toggle but only supported **light↔dark 2-way**. The structure only read `resolvedTheme` for binary judgment, making it impossible to detect `theme === 'system'` state. Once the toggle was clicked, localStorage would be fixed to `theme=light|dark`, and OS dark mode changes would no longer be tracked. The only return was manual localStorage deletion, formally carried over in Sprint 73 ADR D5 Note.
- **Choice**: **Reuse implementation base, single file modification**. `theme-provider.tsx` already supports system with `defaultTheme="system"` + `enableSystem` — no changes needed. In `theme-toggle.tsx`, switch from `resolvedTheme` → `theme` (user selection) as basis to implement `system → light → dark → system` 3-way cycle:
  - Define cycle function with `NEXT_MODE: Record<ThemeMode, ThemeMode>` map
  - Centralize labels with `MODE_LABEL: Record<ThemeMode, string>` ("System Tracking" / "Light Mode" / "Dark Mode")
  - 3 icons: `Monitor` (system) / `Sun` (light) / `Moon` (dark) — `lucide-react` already in bundle from Sprint 73-6, **0 additional dependencies**
  - `aria-label` format: "Current: {state}, click to switch to {next}" — screen readers can distinguish all 3 states
  - `mounted` guard + placeholder maintained exactly as in Sprint 73-6 to prevent SSR hydration mismatch
  - When `theme === undefined` (SSR) or `'system'`, fallback current to `'system'`
- **Alternatives**:
  - (A) Dropdown menu + 3 radio options — explicit selection UX is superior but Popover/DropdownMenu implementation cost + no shadcn/ui in blog package means unavoidable additional dependencies. Over-investment for blog peripheral features.
  - (B) Separate "system tracking" checkbox + keep existing 2-way — 2 buttons increase header layout burden + checkbox state sync complexity
  - (C) 3-state self-management with custom `localStorage` `theme-mode` key — bypassing next-themes dependency means reconstructing `theme-provider` at cost exceeding the current approach
- **Code Paths**: `blog/src/components/theme-toggle.tsx` (+40/-13, single file)
- **Note**: Rationale for cycle direction `system → light → dark → system`: when the user is in `system` state, `resolvedTheme` already reflects OS preference, so toggle intent is **override**. Completing a full cycle starting from `light` through `dark` back to `system` matches the intentional flow. Resolves the carryover from Sprint 73 D5 Note.

## Patterns

### P1: Multi-Item Content Fact Verification Parallelization — Explore N Split (74-2)

- **Where**: `blog/content/adr/*.mdx` body numeric/milestone correction
- **When to Reuse**: When verifying factual accuracy of existing content (documents, blog, README) and (a) 3+ verification targets exist and (b) each target's context is independent. A single session handling multiple posts suffers from **cross-context contamination** (unconsciously projecting post A's numbers onto post B) and **confirmation bias** (memory of "it's correct" from a previous post influencing the next post's judgment). Launching N Explore agents each assigned 1 post forces cross-verification while each operates without knowing the others' conclusions. Oracle handles convergence by collecting results and processing corrections as a single commit. In this sprint, 4 Explores working independently resulted in a clear split: 2 posts (system-architecture-overview, cicd-ai-guardrails) ruled "no changes" + 4 posts needed corrections. Generalization of Sprint 73 P2's "implementation + independent verification" pattern to **verification-only work**.

### P2: `theme` vs `resolvedTheme` Distinction — next-themes 3-State UI Fundamentals (74-3)

- **Where**: `blog/src/components/theme-toggle.tsx` (next-themes based theme toggle UI)
- **When to Reuse**: When implementing a 3-state UI including `system` mode with next-themes, **always** consciously use the two values differently. `theme` is the **value the user selected** (`'system' | 'light' | 'dark' | undefined`) and `resolvedTheme` is the **value actually applied to the screen** (`'light' | 'dark'`, the result of OS preference mapping when system is selected). UI expressing "user intent" like icons/labels/`aria-label` must read `theme` to recognize the `system` state; conversely, style branching that conditions on "actually dark" (e.g., changing a specific image path) must use `resolvedTheme` so system mode still reflects OS preference. `theme` is `undefined` during SSR, so mount guard + fallback (`'system'`) logic is required. The root cause of Sprint 73-6's inability to support 3 states was precisely missing this distinction.

## Gotchas

### G1: `truncate` Class Hides Semantic "Cutoff" in Flex Children (74-1)

- **Symptom**: `truncate` (= `overflow-hidden text-ellipsis whitespace-nowrap`) was on `ServiceCard`/`ArchService` h4, causing long service names like `github-worker` combined with port to have the latter part cut off with `...`. This cutoff persisted throughout Sprint 70~72 visual enrichment as if it were "design intent."
- **Root Cause**: Initial design decision to apply `truncate` by default to "cleanly" handle long text in fixed-width cards became a fixed assumption. In mobile responsive + long name combinations this results in information loss, but verification was primarily done on desktop with short names, making it imperceptible.
- **Fix**: Remove `truncate` + `flex-wrap` + `leading-tight`. When space is sufficient, maintains single line; when insufficient, allows natural line breaks. `leading-tight` maintains vertical rhythm for 2-line cards.
- **Lesson**: Use `truncate` only when "absolutely must be single line" is a hard constraint. First ask whether the information itself can be cut off. Card component text fields should default to **wrap allowed**, with `truncate` added explicitly only for special cases.

### G2: Reading Only `resolvedTheme` Makes `system` State Forever Undetectable (74-3 Background)

- **Symptom**: Sprint 73-6's 2-way toggle judged state with a single line `const isDark = resolvedTheme === 'dark'`. In `system` state with OS as dark, `resolvedTheme === 'dark'` makes the toggle call `setTheme` with `'light'` → `theme=light` is fixed in localStorage, and after that no matter how OS mode changes, the blog stays on `light`. The only return is manual localStorage deletion.
- **Root Cause**: Implemented under the assumption "just knowing dark/not is sufficient for toggle" without knowing the difference between `theme` (user selection) and `resolvedTheme` (applied result). next-themes docs were not read from a 3-state perspective.
- **Fix**: In 74-3, read `theme` to branch on `'system' | 'light' | 'dark'` 3 states. `resolvedTheme` removed (unnecessary for icon/label judgment). `mounted` guard maintained as-is to guarantee no hydration mismatch.
- **Lesson**: **When using next-themes, consciously decide which of `theme` or `resolvedTheme` to read**. UI expressing user intent uses `theme`, style branching conditioning on actual applied state uses `resolvedTheme`. Either seems to work at first glance, but the difference immediately surfaces when `system` mode is involved. Recorded as a general guide in P2.

## Metrics

- **Task count**: 3 (74-1 layout · 74-2 fact verification · 74-3 3-way toggle) + 1 ADR
- **Commits (AlgoSu)**: 3 (`86dcde9..5416168`)
  - `2450d6f` feat(blog): Sprint 74-1 blog visual component layout fix (5 files, +60/-37)
  - `54ee420` docs(blog): Sprint 74-2 post body fact verification and latest metrics update (4 files, +33/-29)
  - `5416168` feat(blog): Sprint 74-3 blog 3-way dark theme toggle (system return path restored) (1 file, +40/-13)
  - (+ this ADR commit 1 planned)
- **Commits (aether-gitops)**: 0 (GitOps updates are automatic — only 3 image tag bumps: `2d504fa` `2b374ed` `cd4151f`)
- **Files changed (AlgoSu)**: 10 blog files
  - Visual components (3): `blog/src/components/blog/{hierarchy-tree,service-grid,architecture-map}.tsx`
  - Theme toggle (1): `blog/src/components/theme-toggle.tsx`
  - MDX body (6): `blog/content/adr/{agent-orchestration-solo-dev,meet-the-agents,orchestration-structure,sprint-journey,system-architecture-overview}.mdx` (system-architecture-overview has port normalization in 74-1)
- **Dependencies added**: **0** (74-3 reuses `Monitor` icon from existing `lucide-react`)
- **Build**: `cd blog && npm run build` success (1 build each for 74-1/74-2/74-3 + post-build verification)
  - Compiled 7.9s (74-3 final), Generating static pages (10/10), Exporting (2/2)
  - First Load JS: 103 kB shared (no change)
- **CI consecutive success**: 3 times (`24222343109` 71 retrofit · `24223843443` 74-2 · `24224155079` 74-3, 2~3 min each)
- **CD rollout**: 3 times (blog pod: `-9lrgd` → `-rj5c8` → `-h8xf6`)
- **ArgoCD**: `Synced / Healthy`, final revision `cd4151f`
- **Sprint 73 carryover resolved**: 1 (D5 3-way dark theme toggle)
- **New token definitions**: 0 (reusing existing `border-border`, `text-text-muted`, `text-brand`)

## Related

- **Sprint 73 ADR** — Direct resolution of D5 Note (3-way toggle carryover). D6 Note (post navigation label re-examination) remains outside this sprint's scope. 74-3 **reused the Sprint 73-6 implementation base (next-themes 0.4.6, ThemeProvider, mounted guard) without modification**, completing with a single file — exemplar of minimal invasiveness principle.
- **Sprint 72 ADR** — Continuation of blog visual series including D6 (prose customization), D7 (shadow 11/11). 74-1 cleans up residuals in the **content display layer** (h4 truncate, HierarchyTree rail) not covered in Sprint 72. 74-2's "Hero/MetricGrid" carryover remains as a Sprint 72 carryover item.
- **Sprint 70 ADR** — Origin of blog visual enrichment. 74-2 sprint-journey Phase 4 range expansion (56~73) reflects Sprint 70~73 milestones in the blog body.
- **P2 (theme vs resolvedTheme)** — Enters as a fundamental guide for all future blog/frontend work using next-themes. A checkpoint Palette should read for subsequent tasks.
