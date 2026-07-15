---
type: index
domain: docs/adr-en
---
# AlgoSu ADR — English Versions

This directory contains English translations of the Architecture Decision Records originally written in Korean.

The Korean originals at [`../adr/`](../adr/) are the **SSOT** and must not be edited via the translation pipeline. Always edit `docs/adr/` first, then regenerate (or hand-translate) the English version here.

## Directory layout

```
docs/adr-en/
├─ README.md                              ← this file
├─ ADR-{NNN}-{slug}.md                    ← permanent ADRs (mirrors docs/adr/)
├─ topics/
│  └─ {topic-slug}.md                     ← topic ADRs
└─ sprints/
   └─ sprint-{NN}.md                      ← sprint retrospective ADRs
```

The directory structure mirrors `docs/adr/` exactly. The loader (`blog/src/lib/adr/loader.ts`) resolves the English file path by replacing the `docs/adr/` prefix with `docs/adr-en/`.

## Translation policy

- **Title**: translated to English
- **Frontmatter** (`sprint`, `date`, `status`, `agents`, `related_adrs`, `related_memory`): preserved as-is; only `title` is translated
- **Body**:
  - Technical terms keep their English form: Outbox, Saga, Gateway, Identity, Submission, Problem, AI Analysis, GitHub Worker, etc.
  - Code blocks: code is preserved verbatim; only Korean comments inside code are translated
  - Mermaid diagrams: only node labels are translated; syntax stays untouched
  - Markdown tables: headers translated; data cells preserved (Korean descriptive text inside cells is translated)
  - PR links, URLs, file paths, and `sprint-NN` slugs are preserved exactly
- The original Markdown structure (heading levels, lists, tables, fenced code) must remain identical to the Korean source so cross-references and section anchors keep working

## Auto-translation

A Claude-API-backed translator is provided at `scripts/translate-adr.mjs`:

```bash
# Translate a single file
node scripts/translate-adr.mjs --target docs/adr/ADR-001-gateway-identity-db-separation.md

# Translate all untranslated KR ADRs
node scripts/translate-adr.mjs --all

# Dry run — token budget only, no API call
node scripts/translate-adr.mjs --dry-run --target <path>

# Force overwrite existing English translation
node scripts/translate-adr.mjs --force --target <path>
```

Requires `ANTHROPIC_API_KEY` to be set in the environment.

The translator uses the `claude-opus-4-7` model with a system prompt that prioritises technical accuracy and structural preservation over idiomatic English (closer to literal translation).

## Going forward

Per the Sprint 157 decision, every new sprint ADR must be authored in **both** Korean and English at sprint close:

1. Author `docs/adr/sprints/sprint-{N}.md` (Korean — SSOT)
2. Run `node scripts/translate-adr.mjs --target docs/adr/sprints/sprint-{N}.md` to generate `docs/adr-en/sprints/sprint-{N}.md`
3. Skim the English output for technical accuracy and commit both files together

The `/sprint-close` workflow (`.claude/commands/sprint-close.md`) enforces this in step 3 (Sprint ADR creation).

## Coverage tracking

`scripts/check-adr-en-coverage.mjs --lint` reports which KR ADRs are missing an English translation. Since Sprint 158, the check runs as a **CI hard gate** (`--strict` mode in the `quality-docs` job) — any new KR ADR without an EN counterpart will fail the CI pipeline.

## Site

- Korean: `https://blog.algosu.dev/adr/`
- English: `https://blog.algosu.dev/en/adr/` — pages with a translated body render natively; pages without one display the Korean body with a "Content in Korean" callout

## i18n quality layers (Sprint 175 #30/#31)

ADR internationalisation is gated in three layers, each enforced in the `quality-docs` CI job:

| Layer | Question | Gate |
|-------|----------|------|
| 1 — Source of truth | Does the Korean original exist? | `docs/adr/` is the SSOT (authored first) |
| 2 — Existence | Does an English counterpart file exist? | `scripts/check-adr-en-coverage.mjs --strict` |
| 3 — Translation quality | Is the English file actually translated (no untranslated Korean body)? | `scripts/check-i18n-residue.mjs --strict` |

Layer 3 closes the gap where an English file exists (passing layer 2) but is still a Korean stub. It measures the Hangul ratio of each `docs/adr-en/**/*.md` **prose** region — code fences (``` ``` ```) and inline code (`` `…` ``) are excluded, so Korean log/commit examples inside code stay legal. A file fails only when its prose Hangul ratio exceeds the threshold (default 8%, current corpus max ≈ 2.2%) **and** has at least 10 Hangul characters, which cleanly separates genuine stubs (30–60%) from incidental proper nouns. Because the blog `/en` ADR body is rendered verbatim from `docs/adr-en/` (`blog/src/lib/adr/loader.ts`), gating the source also keeps the build artifact (`out/en/**`) Korean-free (shift-left).

```bash
node scripts/check-i18n-residue.mjs            # stats only
node scripts/check-i18n-residue.mjs --strict   # fail on residue (CI gate)
```
