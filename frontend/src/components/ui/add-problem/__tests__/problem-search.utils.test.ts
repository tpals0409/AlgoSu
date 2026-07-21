/**
 * @file problem-search.utils unit tests — tier mapping, SQL tagging, search adapters
 * @domain problem
 * @layer test
 * @related problem-search.utils, AddProblemModal
 */
import {
  toOurDiff,
  isSqlProblem,
  mergeSqlTag,
  TIER_NAMES,
  resolveSourceUrl,
  resolveTierLabel,
  buildCreatePayload,
  searchSolvedAC,
  searchProgrammers,
  parseProblemIdFromUrl,
  recommendationToSolvedProblem,
  type SolvedProblem,
} from '../problem-search.utils';
import type { RecommendationItem } from '@/lib/api';

// API mock — exercised by the search adapters
const mockSolvedacSearch = jest.fn();
const mockProgrammersSearch = jest.fn();
jest.mock('@/lib/api', () => ({
  solvedacApi: { searchByQuery: (...args: unknown[]) => mockSolvedacSearch(...args) },
  programmersApi: { searchByQuery: (...args: unknown[]) => mockProgrammersSearch(...args) },
  // Use the real SSOT helper so dual-check drift surfaces in tests
  isProgrammersSqlProblem: jest.requireActual('@/lib/api/external').isProgrammersSqlProblem,
}));

const baseProblem: SolvedProblem = {
  problemId: 1000,
  titleKo: 'A+B',
  level: 1,
  tags: [],
  acceptedUserCount: 100,
};

describe('toOurDiff — solved.ac level mapping', () => {
  it('returns BRONZE level 1 for unrated (level <= 0)', () => {
    expect(toOurDiff(0)).toEqual({ difficulty: 'BRONZE', level: 1 });
    expect(toOurDiff(-3)).toEqual({ difficulty: 'BRONZE', level: 1 });
  });

  it('maps each tier band correctly (1..30)', () => {
    expect(toOurDiff(1).difficulty).toBe('BRONZE');   // Bronze V
    expect(toOurDiff(5).difficulty).toBe('BRONZE');   // Bronze I
    expect(toOurDiff(6).difficulty).toBe('SILVER');   // Silver V
    expect(toOurDiff(10).difficulty).toBe('SILVER');  // Silver I
    expect(toOurDiff(11).difficulty).toBe('GOLD');    // Gold V
    expect(toOurDiff(15).difficulty).toBe('GOLD');    // Gold I
    expect(toOurDiff(16).difficulty).toBe('PLATINUM');
    expect(toOurDiff(20).difficulty).toBe('PLATINUM');
    expect(toOurDiff(21).difficulty).toBe('DIAMOND');
    expect(toOurDiff(25).difficulty).toBe('DIAMOND');
    expect(toOurDiff(26).difficulty).toBe('RUBY');
    expect(toOurDiff(30).difficulty).toBe('RUBY');
  });

  it('clamps levels above 30 to RUBY (defensive)', () => {
    expect(toOurDiff(99).difficulty).toBe('RUBY');
  });

  it('preserves the raw solved.ac level on the result', () => {
    expect(toOurDiff(13).level).toBe(13);
    expect(toOurDiff(27).level).toBe(27);
  });
});

describe('isSqlProblem — Programmers SQL detection', () => {
  it('returns true when category === "sql"', () => {
    expect(isSqlProblem({ ...baseProblem, category: 'sql' })).toBe(true);
  });

  it('returns false when category === "algorithm"', () => {
    expect(isSqlProblem({ ...baseProblem, category: 'algorithm' })).toBe(false);
  });

  it('returns true when tags contain SQL (any case)', () => {
    expect(isSqlProblem({ ...baseProblem, tags: ['sql'] })).toBe(true);
    expect(isSqlProblem({ ...baseProblem, tags: ['SQL'] })).toBe(true);
    expect(isSqlProblem({ ...baseProblem, tags: ['hash', 'Sql'] })).toBe(true);
  });

  it('returns false when neither category nor tags indicate SQL', () => {
    expect(isSqlProblem({ ...baseProblem, tags: ['hash'] })).toBe(false);
    expect(isSqlProblem(baseProblem)).toBe(false);
  });
});

describe('mergeSqlTag — case-insensitive dedup', () => {
  it('prepends SQL when missing', () => {
    expect(mergeSqlTag([])).toEqual(['SQL']);
    expect(mergeSqlTag(['hash'])).toEqual(['SQL', 'hash']);
  });

  it('keeps the original order when SQL is already present', () => {
    expect(mergeSqlTag(['SQL', 'a'])).toEqual(['SQL', 'a']);
  });

  it('treats SQL detection as case-insensitive', () => {
    expect(mergeSqlTag(['sql', 'a'])).toEqual(['sql', 'a']);
    expect(mergeSqlTag(['Sql'])).toEqual(['Sql']);
  });
});

describe('TIER_NAMES', () => {
  it('starts with Unrated and ends with Ruby I', () => {
    expect(TIER_NAMES[0]).toBe('Unrated');
    expect(TIER_NAMES[30]).toBe('Ruby I');
  });

  it('has 31 entries (0..30)', () => {
    expect(TIER_NAMES).toHaveLength(31);
  });
});

describe('resolveSourceUrl', () => {
  it('returns problem.sourceUrl when provided (any platform)', () => {
    const p: SolvedProblem = { ...baseProblem, sourceUrl: 'https://example.com/x' };
    expect(resolveSourceUrl('PROGRAMMERS', p)).toBe('https://example.com/x');
    expect(resolveSourceUrl('BOJ', p)).toBe('https://example.com/x');
  });

  it('falls back to Programmers schools URL', () => {
    expect(resolveSourceUrl('PROGRAMMERS', { ...baseProblem, problemId: 42 }))
      .toBe('https://school.programmers.co.kr/learn/courses/30/lessons/42');
  });

  it('falls back to BOJ acmicpc URL', () => {
    expect(resolveSourceUrl('BOJ', { ...baseProblem, problemId: 1000 }))
      .toBe('https://www.acmicpc.net/problem/1000');
  });
});

describe('resolveTierLabel', () => {
  const PG_LABELS: Record<number, string> = { 1: 'Lv.1', 5: 'Lv.5' };

  it('uses TIER_NAMES for BOJ', () => {
    expect(resolveTierLabel('BOJ', 0, PG_LABELS)).toBe('Unrated');
    expect(resolveTierLabel('BOJ', 13, PG_LABELS)).toBe('Gold III');
  });

  it('falls back to "Unrated" for BOJ levels outside the table', () => {
    expect(resolveTierLabel('BOJ', 999, PG_LABELS)).toBe('Unrated');
  });

  it('uses provided labels for Programmers', () => {
    expect(resolveTierLabel('PROGRAMMERS', 5, PG_LABELS)).toBe('Lv.5');
  });

  it('falls back to "Lv.N" for Programmers levels missing from the table', () => {
    expect(resolveTierLabel('PROGRAMMERS', 7, PG_LABELS)).toBe('Lv.7');
  });
});

describe('buildCreatePayload', () => {
  const args = {
    problem: { ...baseProblem, problemId: 1000, titleKo: 'A+B', level: 1, tags: [] },
    platform: 'BOJ' as const,
    weekNumber: '6月2周次',
    deadline: '2026-06-15T14:59:59.000Z',
  };

  it('produces the base payload for a non-SQL problem (no allowedLanguages/category)', () => {
    const payload = buildCreatePayload(args);
    expect(payload).toMatchObject({
      title: 'A+B',
      weekNumber: '6月2周次',
      sourcePlatform: 'BOJ',
      level: 1,
      tags: [],
      sourceUrl: 'https://www.acmicpc.net/problem/1000',
    });
    expect(payload.allowedLanguages).toBeUndefined();
    expect(payload.category).toBeUndefined();
  });

  it('augments SQL problems with allowedLanguages + category and merges the SQL tag', () => {
    const sql = buildCreatePayload({
      ...args,
      platform: 'PROGRAMMERS',
      problem: {
        ...baseProblem,
        problemId: 59034,
        titleKo: 'SELECT ALL',
        category: 'sql',
        tags: [],
        difficulty: 'BRONZE',
        sourceUrl: 'https://school.programmers.co.kr/learn/courses/30/lessons/59034',
      },
    });
    expect(sql.allowedLanguages).toEqual(['sql']);
    expect(sql.category).toBe('SQL');
    expect(sql.tags).toContain('SQL');
    expect(sql.sourceUrl).toBe('https://school.programmers.co.kr/learn/courses/30/lessons/59034');
  });

  it('preserves the raw Programmers difficulty/level (no remap via toOurDiff)', () => {
    const payload = buildCreatePayload({
      ...args,
      platform: 'PROGRAMMERS',
      problem: { ...baseProblem, level: 3, difficulty: 'GOLD' },
    });
    // difficulty.GOLD was explicit ⇒ level passes through untouched
    expect(payload.level).toBe(3);
    expect(payload.difficulty).toBe('GOLD');
  });

  it('caps tags at 5 before the SQL merge (so a SQL problem yields at most 6 entries)', () => {
    const many = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const payload = buildCreatePayload({
      ...args,
      platform: 'PROGRAMMERS',
      problem: { ...baseProblem, tags: many, category: 'sql' },
    });
    expect(payload.tags).toEqual(['SQL', 'a', 'b', 'c', 'd', 'e']);
  });

  it('normalises the deadline to a UTC ISO string', () => {
    const payload = buildCreatePayload({ ...args, deadline: '2026-06-15T14:59:59.000Z' });
    expect(payload.deadline).toBe(new Date('2026-06-15T14:59:59.000Z').toISOString());
  });
});

describe('searchSolvedAC — Gateway proxy adapter', () => {
  beforeEach(() => jest.clearAllMocks());

  it('maps items, defaults missing fields, and forwards the page parameter', async () => {
    mockSolvedacSearch.mockResolvedValue({
      items: [
        {
          problemId: 1,
          titleKo: 'Title KO',
          title: 'Title',
          level: 5,
          tags: ['math'],
          acceptedUserCount: 999,
        },
        // Missing titleKo + tags + acceptedUserCount → fallback path
        { problemId: 2, level: 3 },
      ],
    });

    const results = await searchSolvedAC('test');

    expect(mockSolvedacSearch).toHaveBeenCalledWith('test', 1);
    expect(results).toEqual([
      {
        problemId: 1,
        titleKo: 'Title KO',
        level: 5,
        tags: ['math'],
        acceptedUserCount: 999,
      },
      {
        problemId: 2,
        titleKo: '#2',
        level: 3,
        tags: [],
        acceptedUserCount: 0,
      },
    ]);
  });

  it('throws SEARCH_RESULT_INVALID when items is missing', async () => {
    mockSolvedacSearch.mockResolvedValue({});
    await expect(searchSolvedAC('x')).rejects.toThrow('SEARCH_RESULT_INVALID');
  });

  it('throws SEARCH_RESULT_INVALID when items is not an array', async () => {
    mockSolvedacSearch.mockResolvedValue({ items: 'oops' });
    await expect(searchSolvedAC('x')).rejects.toThrow('SEARCH_RESULT_INVALID');
  });

  it('throws SEARCH_RESULT_INVALID when the response is null', async () => {
    mockSolvedacSearch.mockResolvedValue(null);
    await expect(searchSolvedAC('x')).rejects.toThrow('SEARCH_RESULT_INVALID');
  });

  it('uses item.title when titleKo is absent', async () => {
    mockSolvedacSearch.mockResolvedValue({
      items: [{ problemId: 7, title: 'Only title', level: 1 }],
    });
    const [first] = await searchSolvedAC('x');
    expect(first.titleKo).toBe('Only title');
  });
});

describe('parseProblemIdFromUrl', () => {
  it('parses the trailing BOJ problem number', () => {
    expect(parseProblemIdFromUrl('https://www.acmicpc.net/problem/1000')).toBe(1000);
  });

  it('parses the trailing Programmers lesson number', () => {
    expect(
      parseProblemIdFromUrl('https://school.programmers.co.kr/learn/courses/30/lessons/59034'),
    ).toBe(59034);
  });

  it('tolerates a trailing slash', () => {
    expect(parseProblemIdFromUrl('https://www.acmicpc.net/problem/2000/')).toBe(2000);
  });

  it('returns 0 when no trailing number is present', () => {
    expect(parseProblemIdFromUrl('https://example.com/problems/abc')).toBe(0);
    expect(parseProblemIdFromUrl('')).toBe(0);
  });
});

describe('recommendationToSolvedProblem', () => {
  const baseRec: RecommendationItem = {
    title: 'Two Sum',
    sourceUrl: 'https://www.acmicpc.net/problem/1234',
    sourcePlatform: 'BOJ',
    difficulty: 'GOLD',
    level: 13,
    tags: ['dp', 'greedy'],
    category: 'ALGORITHM',
  };

  it('maps a fully-populated item onto the SolvedProblem shape', () => {
    expect(recommendationToSolvedProblem(baseRec)).toEqual({
      problemId: 1234,
      titleKo: 'Two Sum',
      level: 13,
      tags: ['dp', 'greedy'],
      acceptedUserCount: 0,
      difficulty: 'GOLD',
      sourceUrl: 'https://www.acmicpc.net/problem/1234',
      category: 'algorithm',
    });
  });

  it('converts the SQL category to lowercase', () => {
    const out = recommendationToSolvedProblem({ ...baseRec, category: 'SQL' });
    expect(out.category).toBe('sql');
  });

  it('defaults tags to [] when null', () => {
    const out = recommendationToSolvedProblem({ ...baseRec, tags: null });
    expect(out.tags).toEqual([]);
  });

  it('leaves difficulty undefined when the API sends null', () => {
    const out = recommendationToSolvedProblem({ ...baseRec, difficulty: null, level: null });
    expect(out.difficulty).toBeUndefined();
    // No difficulty + no level → default level 1.
    expect(out.level).toBe(1);
  });

  it('derives a band-midpoint level from difficulty when level is null', () => {
    expect(recommendationToSolvedProblem({ ...baseRec, level: null, difficulty: 'BRONZE' }).level).toBe(3);
    expect(recommendationToSolvedProblem({ ...baseRec, level: null, difficulty: 'GOLD' }).level).toBe(13);
    expect(recommendationToSolvedProblem({ ...baseRec, level: null, difficulty: 'RUBY' }).level).toBe(28);
  });

  it('falls back to problemId 0 when the URL has no trailing number', () => {
    const out = recommendationToSolvedProblem({ ...baseRec, sourceUrl: 'https://example.com/x' });
    expect(out.problemId).toBe(0);
  });

  it('produces an object that buildCreatePayload accepts end-to-end', () => {
    const solved = recommendationToSolvedProblem({ ...baseRec, category: 'SQL', tags: ['join'] });
    const payload = buildCreatePayload({
      problem: solved,
      platform: 'PROGRAMMERS',
      weekNumber: 'W1',
      deadline: '2026-06-15T14:59:59.000Z',
    });
    expect(payload.category).toBe('SQL');
    expect(payload.tags).toContain('SQL');
    expect(payload.sourceUrl).toBe(baseRec.sourceUrl);
  });
});

describe('searchProgrammers — Gateway proxy adapter', () => {
  beforeEach(() => jest.clearAllMocks());

  it('forwards difficulty/sourceUrl/category and zeroes acceptedUserCount', async () => {
    mockProgrammersSearch.mockResolvedValue({
      items: [
        {
          problemId: 59034,
          title: 'SELECT ALL',
          level: 1,
          tags: [],
          difficulty: 'BRONZE',
          sourceUrl: 'https://school.programmers.co.kr/learn/courses/30/lessons/59034',
          category: 'sql',
        },
      ],
    });

    const results = await searchProgrammers('SQL');

    expect(mockProgrammersSearch).toHaveBeenCalledWith('SQL', 1);
    expect(results).toEqual([
      {
        problemId: 59034,
        titleKo: 'SELECT ALL',
        level: 1,
        tags: [],
        acceptedUserCount: 0,
        difficulty: 'BRONZE',
        sourceUrl: 'https://school.programmers.co.kr/learn/courses/30/lessons/59034',
        category: 'sql',
      },
    ]);
  });

  it('throws SEARCH_RESULT_INVALID on a malformed response', async () => {
    mockProgrammersSearch.mockResolvedValue({ items: null });
    await expect(searchProgrammers('x')).rejects.toThrow('SEARCH_RESULT_INVALID');
  });

  it('defaults missing optional fields to undefined / empty array', async () => {
    mockProgrammersSearch.mockResolvedValue({
      items: [{ problemId: 1, title: 'X', level: 2 }],
    });
    const [first] = await searchProgrammers('x');
    expect(first.tags).toEqual([]);
    expect(first.difficulty).toBeUndefined();
    expect(first.sourceUrl).toBeUndefined();
    expect(first.category).toBeUndefined();
  });
});
