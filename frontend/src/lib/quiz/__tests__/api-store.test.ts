/**
 * @file api-store.ts 단위 테스트 — API 기반 퀴즈 기록 저장소
 * @domain quiz
 * @layer lib
 * @related src/lib/quiz/api-store.ts, src/lib/api/client.ts
 */

jest.mock('@/lib/api/client', () => ({
  fetchApi: jest.fn(),
}));

import { createApiQuizStore } from '../api-store';
import { fetchApi } from '@/lib/api/client';

const mockFetchApi = jest.mocked(fetchApi);

/** snake_case raw QuizRecord 목 데이터. */
const MOCK_RECORDS = [
  {
    id: 'r1',
    user_id: 'u1',
    category: 'ALGORITHM',
    difficulty: 'ALL',
    best_score_percent: 80,
    played_at: '2026-06-01T00:00:00.000Z',
    created_at: '2026-06-01T00:00:00.000Z',
    updated_at: '2026-06-01T00:00:00.000Z',
  },
  {
    id: 'r2',
    user_id: 'u1',
    category: 'NETWORK',
    difficulty: 'HARD',
    best_score_percent: 60,
    played_at: '2026-06-02T00:00:00.000Z',
    created_at: '2026-06-02T00:00:00.000Z',
    updated_at: '2026-06-02T00:00:00.000Z',
  },
];

describe('createApiQuizStore', () => {
  beforeEach(() => {
    mockFetchApi.mockReset();
  });

  it('getAllBest fetches from API and converts snake_case to camelCase composite key', async () => {
    mockFetchApi.mockResolvedValueOnce(MOCK_RECORDS);
    const store = createApiQuizStore();
    const result = await store.getAllBest();
    expect(result).toEqual({
      'ALGORITHM::ALL': { scorePercent: 80, playedAt: '2026-06-01T00:00:00.000Z' },
      'NETWORK::HARD': { scorePercent: 60, playedAt: '2026-06-02T00:00:00.000Z' },
    });
    expect(mockFetchApi).toHaveBeenCalledWith('/api/quiz-records');
  });

  it('caches getAllBest — second call does not re-fetch', async () => {
    mockFetchApi.mockResolvedValueOnce(MOCK_RECORDS);
    const store = createApiQuizStore();
    await store.getAllBest();
    await store.getAllBest();
    expect(mockFetchApi).toHaveBeenCalledTimes(1);
  });

  it('getBest returns the record for matching composite key', async () => {
    mockFetchApi.mockResolvedValueOnce(MOCK_RECORDS);
    const store = createApiQuizStore();
    const best = await store.getBest('ALGORITHM', 'ALL');
    expect(best).toEqual({ scorePercent: 80, playedAt: '2026-06-01T00:00:00.000Z' });
  });

  it('getBest returns null for unknown category/difficulty', async () => {
    mockFetchApi.mockResolvedValueOnce(MOCK_RECORDS);
    const store = createApiQuizStore();
    const best = await store.getBest('OS', 'EASY');
    expect(best).toBeNull();
  });

  it('saveResult POSTs to /api/quiz-records with the correct payload', async () => {
    mockFetchApi
      .mockResolvedValueOnce(MOCK_RECORDS) // initial getAllBest (via getBest)
      .mockResolvedValueOnce({});           // saveResult POST

    const store = createApiQuizStore();
    await store.getBest('ALGORITHM', 'ALL'); // warm cache
    await store.saveResult({
      category: 'ALGORITHM',
      difficulty: 'ALL',
      total: 10,
      correct: 9,
      scorePercent: 90,
      playedAt: '2026-06-03T00:00:00.000Z',
    });

    expect(mockFetchApi).toHaveBeenNthCalledWith(2, '/api/quiz-records', {
      method: 'POST',
      body: JSON.stringify({
        category: 'ALGORITHM',
        difficulty: 'ALL',
        scorePercent: 90,
        playedAt: '2026-06-03T00:00:00.000Z',
      }),
    });
  });

  it('saveResult invalidates cache so the next getAllBest re-fetches', async () => {
    mockFetchApi
      .mockResolvedValueOnce(MOCK_RECORDS) // 1st getAllBest
      .mockResolvedValueOnce({})           // saveResult POST
      .mockResolvedValueOnce([]);           // 2nd getAllBest (after invalidate)

    const store = createApiQuizStore();
    await store.getAllBest(); // warm cache (1 call)
    await store.saveResult({
      category: 'ALGORITHM',
      difficulty: 'ALL',
      total: 10,
      correct: 9,
      scorePercent: 90,
      playedAt: '2026-06-03T00:00:00.000Z',
    });
    await store.getAllBest(); // re-fetch after invalidate (3rd call total)
    expect(mockFetchApi).toHaveBeenCalledTimes(3);
  });

  it('getAllBest returns empty map on network failure (best-effort)', async () => {
    mockFetchApi.mockRejectedValueOnce(new Error('Network error'));
    const store = createApiQuizStore();
    const result = await store.getAllBest();
    expect(result).toEqual({});
  });

  it('saveResult swallows network failure (best-effort, does not reject)', async () => {
    mockFetchApi.mockRejectedValueOnce(new Error('Network error'));
    const store = createApiQuizStore();
    await expect(
      store.saveResult({
        category: 'ALGORITHM',
        difficulty: 'ALL',
        total: 10,
        correct: 8,
        scorePercent: 80,
        playedAt: '2026-06-01T00:00:00.000Z',
      }),
    ).resolves.toBeUndefined();
  });
});
