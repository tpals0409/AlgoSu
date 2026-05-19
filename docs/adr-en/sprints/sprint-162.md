---
sprint: 162
title: "ADR Related Document Link Normalization + Mermaid Activation"
date: "2026-05-19"
status: completed
agents: [Oracle, Architect, Critic]
related_adrs: ["sprint-161", "sprint-160"]
related_memory: ["sprint-window"]
---
# Sprint 162 — ADR Related Document Link Normalization + Mermaid Activation

## Goals

- Resolve 2 defects discovered during Sprint 161 user visual verification: (1) Meta sidebar RelatedLinks rendered as `<span>` — not clickable (2) ADR body `.md` markdown links produce 404 on static export
- Resolve Sprint 161 Critic R2 P3 carry-over: `splitTableRow` escaped pipe handling
- Activate Mermaid code fence rendering in ADR — reuse existing Mermaid component

## Decisions

- **ID → URL conversion + span fallback pattern adopted**: `resolveAdrUrl(id, locale)` helper returns null on pattern match failure → existing span preserved. Prevents 404 anchor creation
- **rehype plugin-based link normalization**: Separated from parser.ts metadata extraction (`extractOutgoingLinks`) as a render-only transformation. Separation of concerns
- **Null byte placeholder pattern**: Escaped pipe (`\|`) handling via `\x00PIPE\x00` substitution → split → restore. No general text collision possible
- **CodeBlock → Mermaid early return branch**: When `extractLanguage` yields `'mermaid'`, reuse existing `<Mermaid>` component (dynamic import, SSG-safe). Zero new implementation
- **Critic P2 data integrity resolution**: sprint-67 `related_adrs: [ADR-004, ADR-005]` references non-existent ADRs → frontmatter removed

## Implementation (single PR, branch `feat/sprint-162-adr-links-mermaid`, 5 commits)

| Phase | Owner | Change | Lines |
|-------|-------|--------|-------|
| A — RelatedLinks anchor conversion | architect | `adr-meta-sidebar.tsx` | +46 −6 |
| B — rehype link normalization | architect | `rehype-adr-link-rewrite.ts` new + `markdown.ts` + `adr-detail-view.tsx` | +90 −2 |
| C — escaped pipe handling | architect | `parser.ts` | +5 −1 |
| D — Mermaid activation | architect | `code-block.tsx` + `sprint-160.md` Mermaid diagram | +19 |
| Critic R1 P2 | architect | `sprint-67.md` KR+EN frontmatter | −2 |

### Detailed Changes

1. **adr-meta-sidebar.tsx** (+46 −6): `resolveAdrUrl(id, locale)` helper — sprint-NNN → `/adr/sprints/NNN/`, ADR-NNN → `/adr/permanent/NNN/`, unsupported patterns → null. `RelatedLinks` `<span>` → `<a>` anchor conversion + unsupported ID span fallback (graceful degradation). locale prop added
2. **rehype-adr-link-rewrite.ts** (+75, new): `unist-util-visit`-based rehype plugin. ADR body `./sprint-NNN.md` / `./topics/SLUG.md` / `../adr-en/sprints/sprint-NNN.md` relative paths → static export URL conversion
3. **markdown.ts** (+13 −1): `renderAdrMdx(source, locale)` signature extended + `[rehypeAdrLinkRewrite, { locale }]` inserted into rehypePlugins chain (after rehypeSlug, before rehypeHighlight)
4. **adr-detail-view.tsx** (+2 −1): locale prop passed to `renderAdrMdx`
5. **parser.ts** (+5 −1): `splitTableRow` — `\|` escaped pipe replaced with null byte placeholder (`\x00PIPE\x00`) → split → restore
6. **code-block.tsx** (+8): `extractLanguage` result `'mermaid'` → `<Mermaid chart={chartSource} />` early return branch
7. **docs/adr/sprints/sprint-160.md** (+11): Phase A→F 6-step workflow Mermaid flowchart added
8. **docs/adr/sprints/sprint-67.md** (−1): Non-existent `ADR-004`, `ADR-005` references removed (Critic R1 P2)
9. **docs/adr-en/sprints/sprint-67.md** (−1): Same change

## Verification

| Item | Result |
|------|--------|
| tsc --noEmit | clean (0 errors) |
| npm run build | 247 pages static export success |
| check-adr-en-coverage --strict | 110/110 (100.0%) PASS |
| check-doc-refs | 287 files 0 broken refs |
| Critic R1 (Codex, session `019e3ec2-5445-70d0-96e3-9d71fa8d8640`) | P0/P1 0 items, P2 1 item (sprint-67 non-existent ADR) → resolved (commit `23002cd`), P3 2 items → Sprint 163 carry-over |
| Critic R2 (Codex, R2-sprint162-20260519) | PASS. R1 P2 resolution confirmed, 0 new P0/P1/P2, P3 2 items (existing) |

## Branch Discipline ✅ 30 sprints of consecutive compliance

- New branch `feat/sprint-162-adr-links-mermaid` + Squash merge pending
- 0 direct commits to main, 0 `--no-verify` uses

## New Patterns

1. **ID → URL conversion + span fallback pattern** — `resolveAdrUrl` returns null on pattern match failure → existing span preserved. Prevents 404 anchor creation
2. **rehype plugin-based link normalization** — Separated from parser.ts metadata extraction (`extractOutgoingLinks`) as a render-only transformation. Separation of concerns
3. **Null byte placeholder pattern** — `\x00` used for escaped pipe handling ensures no general text collision
4. **CodeBlock → Mermaid early return branch** — Reuses existing Mermaid component (dynamic import, SSG-safe). Zero new implementation
5. **Critic P2 → data integrity resolution** — Critic detects frontmatter data issues, not code defects. Resolved via data correction rather than code modification

## Lessons

1. **User visual verification is the last safety net** — Sprint 161 pattern reconfirmed for the 3rd consecutive sprint (159/160/161 all had additional defects found during direct user verification)
2. **rehype plugins are the natural link normalization tool at the markdown → HTML AST stage** — Render chain transformation is better suited for separation of concerns than parser.ts preprocessing
3. **Non-existent resource references become broken links upon anchor conversion** — Fallback (span preservation) or data integrity (frontmatter cleanup) is mandatory
4. **Mermaid SSG safety comes at zero verification cost via component reuse** — `<Mermaid>` dynamic import already guarantees SSG safety

## Sprint 163 Carry-Over

- Critic R1 P3 2 items: (1) test coverage (2) expanded Mermaid diagram application to existing ADRs
- Sprint 163 scope: Phase D PR table separation + lesson/carry-over callout boxes
- Existing carry-over items maintained (seeds #new1~#new7, #30/#31, #24/#26~#28, etc.)

## Related Documents

- [sprint-161.md](./sprint-161.md) — Previous sprint, user visual verification defect discovery pattern inheritance
- [sprint-160.md](./sprint-160.md) — Mermaid flowchart addition target
