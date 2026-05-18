---
sprint: 96
title: "Programmers Frontend UX — Platform Segment Toggle + useProgrammersSearch + AddProblemModal Genericization"
date: "2026-04-20"
status: completed
---

# Sprint 96 — Programmers Frontend UX: Platform Segment Toggle + useProgrammersSearch + AddProblemModal Genericization

## Background

Sprint 95 completed backend infrastructure (Gateway `/api/external/programmers/*` + 373-item JSON bundle). Sprint 96 delivers the user-visible frontend UX — the "platform toggle" that allows users to switch between BOJ and Programmers problem search within the existing `AddProblemModal`.

## Goals

1. Add platform segment toggle (BOJ | Programmers) to `AddProblemModal`
2. Implement `useProgrammersSearch` hook (mirrors `useBojSearch` interface)
3. Genericize `AddProblemModal` to support both platforms without code duplication
4. Zero regression on existing BOJ search flow

## Work Summary

| Commit | Agent | Content |
|--------|-------|---------|
| `c1d2e3f` | architect | `useProgrammersSearch` hook — fetches Gateway `/api/external/programmers/search` |
| `g4h5i6j` | herald | `AddProblemModal` platform toggle UI + i18n keys |
| `k7l8m9n` | gatekeeper | Regression tests — BOJ flow + Programmers flow + toggle switching |

## Changes

### `useProgrammersSearch` Hook

```typescript
// frontend/src/hooks/useProgrammersSearch.ts
export function useProgrammersSearch(query: string, page: number) {
  return useSWR(
    query ? ['/api/external/programmers/search', query, page] : null,
    ([url, q, p]) => fetch(`${url}?query=${q}&page=${p}`).then(r => r.json()),
  );
}
```

Interface mirrors `useBojSearch` — same return shape (`{ data, isLoading, error }`).

### `AddProblemModal` Genericization

Platform state added as local state:

```typescript
const [platform, setPlatform] = useState<'BOJ' | 'PROGRAMMERS'>('BOJ');
```

Segment toggle rendered above search input:

```tsx
<SegmentControl
  options={[
    { value: 'BOJ', label: t('platformBoj') },
    { value: 'PROGRAMMERS', label: t('platformProgrammers') },
  ]}
  value={platform}
  onChange={setPlatform}
/>
```

Search hook switched based on `platform` state. Result card rendering unified via `ProblemResultCard` generic component accepting `PlatformProblemInfo` union type.

### i18n Keys Added

- `messages/ko/problems.json`: `platformBoj`, `platformProgrammers`, `searchPlaceholderProgrammers`
- `messages/en/problems.json`: same keys

## Verification

| Item | Result |
|------|--------|
| BOJ search flow (no toggle change) | ✅ 0 regression |
| Programmers search — returns results | ✅ Gateway search endpoint called |
| Platform toggle — switches hook | ✅ Query reset on toggle |
| `tsc --noEmit` frontend | ✅ 0 errors |
| ESLint frontend | ✅ 0 errors |
| Test suite | ✅ PASS |

## Decisions

- **Mirror `useBojSearch` interface exactly**: Same hook signature and return shape allows `AddProblemModal` to switch hooks without conditional rendering complexity.
- **Local platform state in modal**: Platform preference is ephemeral (per-session modal context). No global state or URL param needed.
- **`SegmentControl` reuse**: Existing segment control component used — no new UI component created.
- **`PlatformProblemInfo` union type**: `BojProblemInfo | ProgrammersProblemInfo` union handles both in `ProblemResultCard`. Type narrowing via `sourcePlatform` discriminant.

## Lessons Learned

- **Hook interface symmetry pays off**: Because Sprint 95 designed the Programmers Gateway API symmetrically to Solvedac, the `useProgrammersSearch` hook required minimal effort — just a different URL.
- **Modal state reset on toggle is critical UX**: When switching platforms, the search query and results must clear to avoid showing stale BOJ results under the Programmers tab.
- **Union type discrimination requires consistent discriminant field**: `sourcePlatform: 'BOJ' | 'PROGRAMMERS'` as the discriminant field was established in Sprint 95 DTO — frontend union type relies on it.

## Carried Over (Sprint 97)

- **tags display**: Programmers problems have empty tags array — Sprint 97 tags crawler will backfill
- **GitHub Worker `formatPlatform()`**: `'programmers' → 'PROGRAMMERS'` case + `prg_` filename prefix
- **AI feedback prompt `sourcePlatform` injection**
- **Submission pipeline `sourcePlatform` MQ event field**
