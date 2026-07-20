---
sprint: 252
title: "Remove Problem Description Display on Problem Detail Page — Redirect to Source Link"
date: "2026-07-20"
status: completed
agents: [Oracle]
related_adrs: ["sprint-248", "sprint-249"]
related_memory: ["sprint-window"]
topics: ["frontend", "problem-detail", "ux", "copyright"]
tldr: "Removed the problem body text (`description`) render block from the problem detail page (`/problems/[id]`), redirecting problem access to the Programmers/BOJ source link. Only the display render logic was deleted (DB data and the AI-analysis prompt are unaffected), so it applies immediately and uniformly to all problems, new and existing. Source link, difficulty, tags, and deadline metadata are retained. PR #475 `b5b83e2`, `page.tsx` +1/−8. As a small frontend display removal, no Critic gate applied."
---
# Sprint 252 — Remove Problem Description Display on Problem Detail Page

_Date: 2026-07-20_

## Goal

On the problem detail page (`frontend/src/app/[locale]/problems/[id]/page.tsx`), do not render the problem body (`description`) text directly on screen. Users are redirected to the original problem via the Programmers/BOJ **source link**.

**Background**: Exposing the full problem body on our own page is undesirable from a source (Programmers/BOJ) copyright standpoint. Problem access is delegated to the source link, while the platform focuses on **metadata and study flow** such as difficulty, tags, and deadlines.

## Decisions

### D1. Remove only the problem body render block (delete display logic, preserve data)

Deleted the problem body render block in `page.tsx`:

```diff
-              {/* description */}
-              {problem.description && (
-                <p className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-2)' }}>
-                  {problem.description}
-                </p>
-              )}
-
-              {/* source link */}
+              {/* source link (problem body not exposed — Sprint 252: access via Programmers/BOJ link) */}
                 {problem.sourceUrl && ( ... )}
```

- **Only the display render logic is removed** — the `description` field value (DB / API response) remains intact. No data deletion, no migration.
- Independent of when a problem was created, it applies immediately and uniformly to **all problem detail pages, new and existing** (since it is a removal of the render branch).
- **Minimal revert cost**: restoring the render block alone fully reverts the change (no migration needed).

### D2. Explicitly retained elements

Instead of the body, the following are kept as-is:
- **Source link** (`problem.sourceUrl` — Programmers/BOJ)
- Problem metadata such as difficulty, tags, and deadline
- AI analysis flow — `ai-analysis` worker.py `_get_problem` reads `description` directly from the DB, so **prompt context injection is unaffected** (the Sprint 248/249 problem-context enrichment path is preserved).

## Completed Items

| Commit | PR | Content |
|--------|----|---------|
| `b5b83e2` | #475 | Remove problem body render block on problem detail page (`page.tsx` +1/−8) |

**Critic result**: Not applicable — a single-file, small frontend display removal (render block deletion; logic, data, and API unchanged), so no separate cross-review gate was run.

## Backlog

- [ ] 🔴 Security: ANTHROPIC_API_KEY rotation (user-deferred — revoke in Anthropic Console, reissue + reseal SealedSecret)
- [ ] 🔴 Security: `claude setup-token` long-lived token exposed in plaintext transcript — revoke and reissue if external sharing is a concern
- [ ] GA4 admin Enhanced Measurement OFF / production UAT / data stream URL alignment (user-direct)
- [ ] Server redeploy + live SEO verification (ops, Sprint 212/213 deliverables)
- [ ] Harness checkup `--full` CI scheduled automation (monthly cron) review (Sprint 209 follow-up)

## Lessons

- **Display removal ≠ data deletion**: copyright/exposure policy changes are often satisfiable by removing a screen render branch. Not touching the DB/migration keeps revert cost low and avoids side effects on data-consuming paths such as AI analysis.
- **Render-branch removal applies retroactively**: removing a conditional render (`problem.description && ...`) block applies immediately and uniformly to all records regardless of whether the data exists — no per-problem handling required.
- **Verify no impact on data-consuming paths**: proceed after confirming the display removal does not affect other consumers (here, the AI-analysis prompt) — `worker.py _get_problem` reads directly from the DB and is independent of the UI render.
