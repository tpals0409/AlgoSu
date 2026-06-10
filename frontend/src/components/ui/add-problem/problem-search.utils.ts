/**
 * @file AddProblemModal helpers — tier mapping, SQL detection, search adapters
 * @domain problem
 * @layer utility
 * @related AddProblemModal, SearchStep, ConfirmStep, solvedacApi, programmersApi
 *
 * Pure helpers + Gateway proxy search adapters for the Add Problem modal.
 * Extracted from AddProblemModal.tsx (Sprint 242 Q-1 FE) to enable
 * fine-grained unit testing of the decision logic that used to be hidden
 * inside a ~800-line component.
 */
import {
  solvedacApi,
  programmersApi,
  isProgrammersSqlProblem,
  type CreateProblemData,
} from '@/lib/api';
import type { Difficulty } from '../AlgosuUI';

// ── Domain types ─────────────────────────────────────────────────────────────

/** Source platform supported by the modal */
export type Platform = 'BOJ' | 'PROGRAMMERS';

/**
 * Search result row shared by BOJ (solved.ac) and Programmers.
 *
 * `level` semantics differ by platform:
 *  - BOJ: 0 = unrated, 1..5 = Bronze, ... 21..25 = Diamond
 *  - PROGRAMMERS: 1..5
 */
export interface SolvedProblem {
  problemId: number;
  titleKo: string;
  level: number;
  tags: string[];
  acceptedUserCount: number;
  /** Programmers: difficulty provided directly by Gateway */
  difficulty?: Difficulty;
  /** Programmers: problem URL provided directly by Gateway */
  sourceUrl?: string;
  /** Programmers: problem category (algorithm | sql) */
  category?: 'algorithm' | 'sql';
}

/** Payload emitted to the parent after a successful create */
export interface NewProblemData {
  id: string;
  title: string;
  difficulty: Difficulty;
  level: number;
  weekNumber: string;
  status: 'ACTIVE';
  deadline: string;
  tags: string[];
  sourceUrl: string;
  sourcePlatform: Platform;
  description: string;
}

// ── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * Map a raw solved.ac level (0..30) to our `{ difficulty, level }` shape.
 *
 * The original `level` is preserved so the UI can show the full tier label
 * (e.g. "Gold III") via {@link TIER_NAMES}.
 */
export function toOurDiff(
  solvedLevel: number,
): { difficulty: Difficulty; level: number } {
  if (solvedLevel <= 0) return { difficulty: 'BRONZE', level: 1 };
  const tiers: Difficulty[] = [
    'BRONZE',
    'SILVER',
    'GOLD',
    'PLATINUM',
    'DIAMOND',
    'RUBY',
  ];
  const tierIdx = Math.min(Math.floor((solvedLevel - 1) / 5), 5);
  return { difficulty: tiers[tierIdx], level: solvedLevel };
}

/**
 * Detect a Programmers SQL problem.
 *
 * Thin wrapper around {@link isProgrammersSqlProblem} (the SSOT dual-check
 * helper in `@/lib/api/external`) so the component layer keeps a stable name.
 */
export function isSqlProblem(p: SolvedProblem): boolean {
  return isProgrammersSqlProblem(p);
}

/**
 * Prepend the "SQL" tag without duplicating an existing case-insensitive match.
 *
 * @param tags - existing tag list (any case)
 * @returns tag list guaranteed to contain "SQL" exactly once
 */
export function mergeSqlTag(tags: string[]): string[] {
  const has = tags.some((t) => t.toUpperCase() === 'SQL');
  return has ? tags : ['SQL', ...tags];
}

/** Full tier label (index = raw solved.ac level, 0 = Unrated) */
export const TIER_NAMES: readonly string[] = [
  'Unrated',
  'Bronze V', 'Bronze IV', 'Bronze III', 'Bronze II', 'Bronze I',
  'Silver V', 'Silver IV', 'Silver III', 'Silver II', 'Silver I',
  'Gold V', 'Gold IV', 'Gold III', 'Gold II', 'Gold I',
  'Platinum V', 'Platinum IV', 'Platinum III', 'Platinum II', 'Platinum I',
  'Diamond V', 'Diamond IV', 'Diamond III', 'Diamond II', 'Diamond I',
  'Ruby V', 'Ruby IV', 'Ruby III', 'Ruby II', 'Ruby I',
];

// ── Search adapters (Gateway proxies) ────────────────────────────────────────

/**
 * Resolve the public problem URL for a given platform/id pair.
 *
 * Falls back to a deterministic platform URL when the search payload didn't
 * provide one (BOJ never provides `sourceUrl`).
 */
export function resolveSourceUrl(platform: Platform, problem: SolvedProblem): string {
  if (problem.sourceUrl) return problem.sourceUrl;
  return platform === 'PROGRAMMERS'
    ? `https://school.programmers.co.kr/learn/courses/30/lessons/${problem.problemId}`
    : `https://www.acmicpc.net/problem/${problem.problemId}`;
}

/**
 * `CreateProblemData` narrowed to the fields the modal always provides.
 *
 * The base interface marks `level`/`tags` as optional (other callers may
 * omit them), but the modal always sets both — narrowing here lets the
 * orchestrator use them as fallbacks without `as` casts.
 */
export type AddProblemCreatePayload = CreateProblemData & {
  level: number;
  tags: string[];
};

/**
 * Build the {@link CreateProblemData} payload submitted to the backend.
 *
 * SQL problems gain `allowedLanguages: ['sql']` + `category: 'SQL'` and have
 * "SQL" merged into their tag list (capped at 5 + 1 SQL tag).
 */
export function buildCreatePayload(args: {
  problem: SolvedProblem;
  platform: Platform;
  weekNumber: string;
  deadline: string;
}): AddProblemCreatePayload {
  const { problem, platform, weekNumber, deadline } = args;
  const resolvedDiff = problem.difficulty ?? toOurDiff(problem.level).difficulty;
  const diffLevel = problem.difficulty ? problem.level : toOurDiff(problem.level).level;
  const sql = isSqlProblem(problem);
  const tagNames = sql
    ? mergeSqlTag(problem.tags.slice(0, 5))
    : problem.tags.slice(0, 5);

  const base: AddProblemCreatePayload = {
    title: problem.titleKo,
    weekNumber,
    difficulty: resolvedDiff as CreateProblemData['difficulty'],
    level: diffLevel,
    deadline: new Date(deadline).toISOString(),
    tags: tagNames,
    sourceUrl: resolveSourceUrl(platform, problem),
    sourcePlatform: platform,
  };
  return sql
    ? { ...base, allowedLanguages: ['sql'], category: 'SQL' as const }
    : base;
}

/**
 * Search solved.ac via the Gateway proxy.
 *
 * Direct solved.ac calls are blocked by their Referer policy (403), so the
 * Gateway proxy route `/api/external/solvedac/search` is the only viable path.
 *
 * @throws Error('SEARCH_RESULT_INVALID') when the response is missing items.
 */
export async function searchSolvedAC(query: string): Promise<SolvedProblem[]> {
  const data = await solvedacApi.searchByQuery(query, 1);
  if (!data || !Array.isArray(data.items)) {
    throw new Error('SEARCH_RESULT_INVALID');
  }
  return data.items.map((item) => ({
    problemId: item.problemId,
    titleKo: item.titleKo ?? item.title ?? `#${item.problemId}`,
    level: item.level,
    tags: item.tags ?? [],
    acceptedUserCount: item.acceptedUserCount ?? 0,
  }));
}

/**
 * Search Programmers via the Gateway proxy.
 *
 * Programmers results carry richer metadata (difficulty, sourceUrl, category)
 * so we forward them verbatim instead of recomputing on the client.
 *
 * @throws Error('SEARCH_RESULT_INVALID') when the response is missing items.
 */
export async function searchProgrammers(query: string): Promise<SolvedProblem[]> {
  const data = await programmersApi.searchByQuery(query, 1);
  if (!data || !Array.isArray(data.items)) {
    throw new Error('SEARCH_RESULT_INVALID');
  }
  return data.items.map((item) => ({
    problemId: item.problemId,
    titleKo: item.title,
    level: item.level,
    tags: item.tags ?? [],
    acceptedUserCount: 0,
    difficulty: (item.difficulty ?? undefined) as Difficulty | undefined,
    sourceUrl: item.sourceUrl,
    category: item.category,
  }));
}

/** Lookup the display label for a tier on a given platform */
export function resolveTierLabel(
  platform: Platform,
  level: number,
  programmersLabels: Record<number, string>,
): string {
  if (platform === 'BOJ') {
    return TIER_NAMES[level] ?? 'Unrated';
  }
  return programmersLabels[level] ?? `Lv.${level}`;
}
