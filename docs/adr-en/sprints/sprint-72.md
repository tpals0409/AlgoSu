---
sprint: 72
title: "Blog Visual Design Improvement — Visual-Only Design Polish (Palette+Scout Joint Evaluation)"
date: "2026-04-10"
status: completed
agents: [Oracle, Palette, Scout, Herald, Gatekeeper, Scribe]
related_adrs: []
---

# Sprint 72: Blog Visual Design Improvement — Visual-Only Design Polish

## Context

`blog.algo-su.com` (Next.js 15 SSG + Tailwind 3 + MDX) had its content reorganized into 6 topic-based posts in Sprint 68, and in Sprint 70 the 36 ASCII diagrams in the body were converted to 11 React visual components — making the **structure, content, and components stable**. However, following user feedback ("improve the screen"), **visual depth (shadow/hover), typographic hierarchy, spacing rhythm, and token consistency** had not been touched.

PM clearly separated the nature of the work: **"Not content improvement, but visible design improvement"**. That is, content additions or new feature creation — MDX body/copy, Hero metric additions, code block copy buttons, dark mode toggle, post navigation, etc. — are out of scope. Only "how existing markup looks" is addressed.

Oracle performed a joint evaluation by two agents instead of deciding alone:

- **Palette** — Before→After proposals from design token/style perspective (10 sections)
- **Scout** — Scouting visual weaknesses from a first-time visitor perspective (TOP 12+)

The **intersection** of both evaluations was adopted as core priority. Items Scout found but with "content/feature addition" character (Hero section, Back nav, dark mode toggle, code block copy button) were **excluded from this sprint** by Oracle authority and deferred. The result was refined to 6 work units (72-1 ~ 72-6) and ADR (72-D), all processed as **6 local commits**.

This sprint is "pure design polishing" unlike "Sprint 71 bug fix", and is also the first case validating that the **Palette+Scout joint evaluation can become the standard entry flow for design work** in the AlgoSu 12-Agent system.

## Decisions

### D1: Design work entry flow — Oracle → Palette + Scout joint evaluation

- **Context**: Design work is difficult to determine by a single agent. Palette knows token/style SSoT but not user experience; Scout claims to know user experience but not the token system. Asking only one side risks (a) arbitrary hardcoding ignoring tokens or (b) token cleanup the user doesn't feel.
- **Choice**: When a design work trigger occurs, invoke Oracle skill to **delegate Palette and Scout in parallel**. Palette does code-based evaluation (file:line citation + Before→After description), Scout does build output/markup-based user perspective evaluation (first visitor's impression). Oracle aggregates both results into priority candidates, blocking scope (content/feature addition) violating items, then submits to PM.
- **Alternatives**:
  - PM directly narrows scope with AskUserQuestion and proceeds with single work unit — high PM cognitive load, low agent system utilization. Actually attempted at start of this sprint, then rejected.
  - Palette evaluation alone — risk of "token cleanup done but first impression unchanged" without user experience validation.
- **Code Paths**: `agents/commands/palette.md`, `agents/commands/scout.md`, `.claude/commands/algosu-oracle.md`
- **Note**: This decision is permanently recorded in [memory feedback_design_workflow.md](file:///root/.claude/projects/-root-AlgoSu/memory/feedback_design_workflow.md) as the standard workflow for future design work.

### D2: Full tokenization of hardcoded colors/borders (72-1)

- **Context**: Tailwind palette color classes used directly — `text-gray-500/600/400`, `border-gray-200`, `dark:border-gray-800`, `text-brand-500/600/700`, `bg-brand-50` — scattered across pages/cards/visual components. Also, all 11 visual components had inline React style `style={{ borderColor: 'var(--border)' }}` creating a dual path bypassing tokens.
- **Choice**: One-to-one substitution rules for full conversion:
  ```
  text-gray-500/600     → text-text-muted
  text-gray-400         → text-text-subtle
  border-gray-200       → border-border
  dark:border-gray-800  → (remove, --border auto-inverts in .dark)
  text-brand-600        → text-brand
  text-brand-700        → text-brand-strong
  bg-brand-50           → bg-brand-soft
  hover:border-brand-500 → hover:border-brand
  ```
  Remove all 14 inline `style={{ borderColor/backgroundColor: 'var(--...)' }}` occurrences and unify to `border-border` / `bg-border-strong` Tailwind token classes. Explicitly add `bg-surface text-text` to body.
- **Alternatives**: Gradual substitution — risk of hardcoding recurring in new work units. Safer to bring grep to 0 occurrences at once so subsequent work units start from a clean state.
- **Code Paths**: `blog/src/app/layout.tsx`, `blog/src/app/page.tsx`, `blog/src/app/posts/[slug]/page.tsx`, `blog/src/components/post-card.tsx`, `blog/src/components/blog/{architecture-map,hierarchy-tree,kv,mermaid,metric-grid,phase-timeline,pipeline,service-grid,tier-matrix,tier-stack}.tsx`

### D3: Spacing/rhythm redistribution (72-1)

- **Context**: Header felt cramped with `py-4`, and home subtitle had excessive spacing with `mb-10`, breaking visual rhythm into the body (post card list).
- **Choice**: Header `py-4 → py-6`, home subtitle `mb-10 → mb-8`. Body container `max-w-3xl` and post list `space-y-6` are already good, kept as-is.
- **Alternatives**: Redefine all page spacing at once — high regression risk. Only touch the two most impactful points, leave the rest for 72-2/72-3 per-component realignment.
- **Code Paths**: `blog/src/app/layout.tsx`, `blog/src/app/page.tsx`

### D4: Post header visual hierarchy reinforcement (72-3)

- **Context**: First screen when entering post detail: `text-3xl font-bold mb-2` title + `text-sm text-gray-500` date + `text-xs bg-brand-50 py-0.5` tags — visual hierarchy nearly flat. Hard for users to grasp "what this post is, when written, and what category" at a glance.
- **Choice**: 4 simultaneous improvements in single component change:
  1. h1: `text-3xl mb-2` → `text-4xl mb-4 leading-tight tracking-tight` (letter-spacing + line height + weight)
  2. Tag container: `mt-2 gap-2` → `mt-4 gap-3` (breathing room)
  3. Tag chip: `py-0.5` → `py-1 font-medium` (readability)
  4. Add `border-b border-border pb-8 mb-10` at bottom of header block → visual separator from body (prose)
- **Alternatives**: Add hero image — **content/asset addition in scope**. Add signature — same reason, deferred.
- **Code Paths**: `blog/src/app/posts/[slug]/page.tsx`

### D5: Home PostCard multi-axis interaction (72-2)

- **Context**: Home card has `border-gray-200 p-5 hover:border-brand-500` — on hover only color changes, no depth/movement/shadow change. Hard for first visitors to feel "this is a clickable card", and 6 cards are monotonous in the same tone.
- **Choice**: **3-axis hover feedback** (border + shadow + translate) + internal hierarchy realignment in PostCard:
  - Container: `shadow-sm` default + `hover:shadow-md hover:border-brand hover:-translate-y-0.5 transition-all duration-200`
  - Padding: `p-5 → p-6`
  - Date promoted to top `text-xs uppercase tracking-wide text-text-subtle` meta
  - Title: `text-lg font-semibold → text-xl font-bold leading-snug` + `group-hover:text-brand` (card is `<a>`, use group)
  - Excerpt: `line-clamp-2 leading-relaxed` (stable area)
  - Tags reuse same tokens as 72-3 (intra-sprint consistency)
  - focus-visible ring for keyboard focus visualization
- **Alternatives**:
  - Distribute accent colors per card — Palette recommended, but meaning attribution is weak without "latest post highlight". 6 posts all same date makes it unnecessary. Hold.
  - Introduce thumbnail images — public directory is empty and asset creation needed, out of scope.
- **Code Paths**: `blog/src/components/post-card.tsx`

### D6: Token-based prose body element customization extension (72-4)

- **Context**: Almost entirely dependent on `@tailwindcss/typography` plugin's `.prose` defaults. globals.css had minimal corrections for only 3 types (table/inline code/blockquote), while h2/h3 hierarchy, link underline, strong/em weight, ul/ol markers, hr spacing, etc. were all plugin defaults. Body appeared as "standard markdown with no distinctiveness".
- **Choice**: Add **8 element** token-based rules to globals.css `@layer components`:
  - h2/h3/h4: Redefine spacing/size/letter-spacing/weight (emphasize section boundaries)
  - p: line-height 1.75
  - a: `text-brand` + `underline-offset 2` + `decoration 2` + `transition`, hover `text-brand-strong`
  - strong/em: Specify weight/color
  - ul/ol/li: Spacing/padding/marker color alignment
  - hr: 2.5rem spacing + `border-border`
  - Inline code: padding `0.375rem → 0.5rem`, radius/font-size reinforced
  - blockquote: Left bar `4px → 6px`, background `surface-muted → brand-soft` (contrast reinforced)
- **Alternatives**:
  - Switch to shiki/Prism for code block syntax enhancement — build tool change, out of scope.
  - Introduce dedicated CJK font for prose — web font loading/performance, out of scope.
- **Code Paths**: `blog/src/app/globals.css` (8 additions in `@layer components`, reinforce existing table/code/blockquote)
- **Note**: All colors reuse existing CSS variables — **0 new token definitions**.

### D7: Apply shadow-sm default to 4 representative card types (72-5)

- **Context**: Of 11 visual components, almost no depth. Only ArchService has `hover:shadow-md`, no default shadow. After introducing `shadow-sm` to PostCard (72-2), body cards felt relatively flat in comparison.
- **Choice**: Full normalization of all 11 types is excessive scope (L workload) → Apply `shadow-sm` default to **4 representative types** (Callout, MetricCard, ServiceCard, ArchService) only. ArchService maintains existing `hover:shadow-md` keeping interactive intensity. In dark mode shadow is weak, but existing `border-border` token auto-inverts in `.dark` to maintain separation via brightness difference.
- **Alternatives**:
  - Apply to all 11 — L workload + need to verify visual consistency for each diverse component (Pipeline arrows, TierStack matrix, HierarchyTree tree, etc.). Separate to next sprint.
- **Code Paths**: `blog/src/components/blog/{callout,metric-grid,service-grid,architecture-map}.tsx`

### D8: Interaction base layer (72-6)

- **Context**: Link transitions and keyboard focus visualization not defined globally. `transition` classes scattered or missing per component, and focus-visible handling only explicitly set in PostCard (72-2).
- **Choice**: Add global `a` `transition: color 150ms ease` + `a/button:focus-visible` 2-step shadow (2px surface offset + 2px brand ring) as ring + offset expression to globals.css `@layer base`. Implements ring + offset equivalent to Tailwind `ring-offset` with CSS only, auto-adapts in dark mode as `--surface` auto-inverts.
- **Alternatives**:
  - Introduce shadcn/ui — blog doesn't use shadcn, overkill to introduce framework for single utility addition.
  - Tailwind base config extension with utility-only — expressible via `tailwind.config.ts` plugin, but direct CSS variable usage is more intuitive.
- **Code Paths**: `blog/src/app/globals.css` (`@layer base` extension)
- **Note**: PostCard already explicitly specified focus-visible ring in 72-2 with same expression as global rule — harmless duplication, kept.

## Patterns

### P1: Oracle → Palette + Scout joint evaluation workflow

- **Where**: This entire sprint. Role division in `agents/commands/palette.md` + `agents/commands/scout.md` called in parallel for design work.
- **When to Reuse**: When design/UI/visual improvement work arrives. Especially when (a) work scope spans multiple components/pages, (b) it's unclear "where to start", and (c) it's not trivial work like a single typo/color fix. When invoking Oracle skill, assign clear roles to each agent (Palette: code-based token evaluation / Scout: user perspective visual weaknesses) with **common constraints** (no content changes, no feature additions, plan mode read-only). Oracle organizes the intersection of both results as priority, cross-section as candidate alternatives, blocks scope-violating items, and returns final candidate list to PM. PM only needs to approve priority to immediately proceed with work unit division.

### P2: Token SSoT grep 0-occurrence guarantee

- **Where**: Full substitution across `blog/src/**` (D2)
- **When to Reuse**: In projects with design tokens, "do all colors go through tokens?" can only be verified with grep. At work unit end, `rg "text-gray-|border-gray-|dark:border-gray-|brand-(50|500|600|700|900)" src/` result must be 0 occurrences for token SSoT to be intact. Inline `style={{ borderColor/backgroundColor: 'var(--...)' }}` must also be 0 occurrences (becomes a path bypassing Tailwind tokens). This sprint unified it into work unit 1 so subsequent work units start from a clean state.

### P3: Multi-axis hover feedback (border + shadow + translate)

- **Where**: `blog/src/components/post-card.tsx` (D5)
- **When to Reuse**: When giving hover feedback to clickable cards/panels/list items, single-axis change (color only) is weak for users to perceive "this is interactive". Bundling **3-axis simultaneous changes** (border color + shadow intensity + translate position) into `transition-all duration-200` maximizes interactive intensity with depth/movement/highlight happening simultaneously. Even when shadow weakens in dark mode, other 2 axes maintain feedback, stable in both light/dark. Adding focus-visible ring provides same intensity for keyboard users.

### P4: prose customization — token reuse first

- **Where**: `blog/src/app/globals.css` `@layer components` (D6)
- **When to Reuse**: When using `@tailwindcss/typography` and want to apply brand color/dark mode/readability to body, directly defining `.prose child selectors` in globals.css `@layer components` is more intuitive and advantageous for token reuse than touching prose's variable system (`--tw-prose-*`). Key principle: **no new CSS variable definitions**, use existing tokens only. Colors reference directly as `var(--brand)`/`var(--text-muted)` for dark mode auto-adaptation. Apply `line-height 1.75`, `letter-spacing -0.01em`. Reinforce blockquote with thicker left bar (4px → 6px) and background (surface-muted → brand-soft) for contrast.

## Gotchas

### G1: inline `style={{ var('--token') }}` bypasses token system

- **Symptom**: `tailwind.config.ts` has `border-border` / `bg-border-strong` tokens mapped, but 11 visual components reference CSS variables directly with inline React style `style={{ borderColor: 'var(--border)' }}`. Result: token usage not visible via Tailwind class grep, hard to track impact scope on design token changes.
- **Root Cause**: During initial component writing, Tailwind token mapping was insufficient or author bypassed with CSS variable without knowing `tailwind.config.ts`. Once embedded, permanently invisible via grep.
- **Fix**: Remove all 14 occurrences in work unit 1. `border-border`/`bg-border-strong` already mapped in `tailwind.config.ts`, class substitution alone is sufficient. Use `rg "style=\{\{" blog/src/components/blog` being 0 occurrences as gate going forward.
- **Lesson**: In projects with design token SSoT policy, **blocking inline styles in code review is safest**. Can be enforced with ESLint `react/forbid-component-props` + `@typescript-eslint/no-restricted-syntax` rules. Didn't introduce rules in this sprint but worth future consideration.

### G2: Shadow invisible in dark mode

- **Symptom**: Even after applying `shadow-sm` to PostCard / Callout / MetricCard, shadow is barely visible in dark mode on dark surface — appears nearly flat.
- **Root Cause**: Shadow fundamentally expresses depth as "darker area than background", but dark backgrounds have little room to go darker. `dark:shadow-*` variant doesn't create significant brightness difference.
- **Fix**: Accept shadow as light-mode-only depth cue; in dark mode express separation via **border brightness difference** (`border-border` auto-inverts to `gray-800`/`gray-900` tone in `.dark`) and **card background surface-elevated**. Leave shadow class dark variant as-is — weak but harmless.
- **Lesson**: Dark mode card design should be validated by "does it separate even without shadow?". If shadow is the only depth cue, it will appear flat in dark mode. Prioritize border token brightness difference or surface layer difference (surface / surface-muted / surface-elevated).

### G3: Dependence on prose defaults creates "characterless body"

- **Symptom**: Body appears **standard markdown with no personality/brand color** when only `.prose` class is applied. Especially weak h2/h3 hierarchy, links use only prose internal colors, and blockquote has flat plugin-default gray left bar.
- **Root Cause**: Prose plugin is intentionally neutral by design as a "general safety net". Host sites must separately apply brand colors and emphasis effects.
- **Fix**: Directly redefine 8 `.prose child selectors` in globals.css `@layer components` (see D6 P4). Approach of **reinforcing missing hierarchy and emphasis** rather than overriding prose defaults. All colors reuse existing tokens for dark mode auto-adaptation.
- **Lesson**: Adopting the prose plugin doesn't mean "body design done". Plugin is basic safety net; brand distinctiveness must be additionally applied in host CSS. Treating "h2/h3, a, blockquote, code, hr — customize these 5 types at minimum" as a checklist from first introduction is safer.

### G4: PM's "content vs design" boundary awareness

- **Symptom**: Scout found "Hero/overview summary absent", "next post card absent", "code block copy button absent", "dark mode toggle absent" — all visual weaknesses, but solutions require **content additions** or **new Client Component creation/feature additions**. Conflicts with PM's explicitly stated scope "not content, but visible design".
- **Root Cause**: Goal of "better-looking screen" implies both (a) styling existing markup and (b) modifying/adding markup structure. Proceeding without distinction leads to infinite scope expansion.
- **Fix**: Oracle separates "**content/feature addition** vs **pure styling**" into a binary at the evaluation synthesis stage. Former completely deferred to next sprint, latter only divided into work units. When submitting to PM, explicitly provide "deferred items list" alongside to document scope agreement.
- **Lesson**: For design work requests, agree with PM that "visible design = keeping markup/content as-is, styling only", and Oracle must explicitly block when user-perspective agent (Scout) proposals exceed scope. Leaving this boundary decision itself in ADR (D1, G4) establishes it as the standard separation line for future design work.

## Metrics

- **Commits (AlgoSu)**: 6 (`b272b7a..bdc4cd3`)
  - `b272b7a` chore(blog): color/border tokenization + header/home spacing rhythm readjustment (72-1)
  - `cf120f1` style(blog): post header typographic/spacing redesign (72-3)
  - `02907c2` style(blog): PostCard visual hierarchy/interaction reinforcement (72-2)
  - `2c23302` style(blog): prose body element style extension (72-4)
  - `24a4253` style(blog): card component shadow consistency cleanup (72-5)
  - `bdc4cd3` style(blog): global transition/focus-visible addition (72-6)
  - (+ 1 ADR commit planned)
- **Files changed (AlgoSu)**: 16 files
  - Pages (3): `blog/src/app/layout.tsx`, `blog/src/app/page.tsx`, `blog/src/app/posts/[slug]/page.tsx`
  - Card (1): `blog/src/components/post-card.tsx`
  - Visual components (11): `blog/src/components/blog/{architecture-map,callout,hierarchy-tree,kv,mermaid,metric-grid,phase-timeline,pipeline,service-grid,tier-matrix,tier-stack}.tsx`
  - Global CSS (1): `blog/src/app/globals.css`
  - Documentation (1): `docs/adr/sprints/sprint-72.md` (this file)
- **Files changed (aether-gitops)**: 0 (no blog manifest changes — only image rebuild needed)
- **Lines**: ~+153 / -84 (code only; excluding ADR)
- **Build**: `cd blog && npm run build` passed after each work unit end (10 pages SSG, First Load JS 103-104 kB maintained)
- **New external dependencies**: None
- **New CSS variables / Tailwind tokens**: None (100% existing token reuse)

## Follow-up Recommendations (outside Sprint 72 scope)

Add to MEMORY.md follow-up section:

- **Dark mode toggle UI introduction** — Dark mode is technically implemented but no toggle entry point, users cannot activate it. Introduce `next-themes` + sun/moon icon toggle in header + localStorage persistence. New Client Component required.
- **Code block language label + copy button** — New Client Component (`code-block.tsx`). Can also enrich syntax highlighting if reviewed together with shiki/Prism transition.
- **Hero / overview summary section** — "67 sprints / 2,432 tests / 12 agents / 6 services" metric cards on home first screen. **Content addition** so separate PM decision needed. MetricGrid component can be reused.
- **Post → list back nav, next/previous post card** — "← Blog Home" at top + "Next post" card at bottom of post detail page. Information architecture change so separate work unit.
- **Visual component 11 types full shadow normalization** — This sprint only processed 4 types (Callout/Metric/Service/ArchService). Remaining 7 types (Pipeline/TierStack/TierMatrix/PhaseTimeline/HierarchyTree/Mermaid/KV) deferred to next sprint. Visual consistency verification needed for each component.
- **inline `style={{ }}` ESLint rule introduction** — Block token system bypass (G1 lesson). Enforce with `react/forbid-component-props` or custom rule.
- **nginx trailing slash pattern enhancement** — Enhance `blog/nginx.conf` `try_files` pattern to `$uri $uri.html $uri/index.html =404`. Sprint 70 remaining item, already registered in MEMORY.md.
