/**
 * @file storage.ts 단위 테스트 — 최고기록 갱신·SSR 가드·폴백 (async + 복합 키)
 * @domain quiz
 * @layer lib
 * @related src/lib/quiz/storage.ts
 */
import {
  createLocalStorageQuizStore,
  type QuizPlayResult,
} from '../storage';

/** v2 스키마 키 (난이도 차원 추가로 v1 비호환). */
const STORAGE_KEY = 'algosu.quiz.records.v2';

function makeResult(overrides: Partial<QuizPlayResult> = {}): QuizPlayResult {
  return {
    category: 'ALGORITHM',
    difficulty: 'ALL',
    total: 10,
    correct: 8,
    scorePercent: 80,
    playedAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('createLocalStorageQuizStore', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('saves a result and reads it back as best', async () => {
    const store = createLocalStorageQuizStore();
    await store.saveResult(makeResult({ scorePercent: 80 }));
    expect(await store.getBest('ALGORITHM', 'ALL')).toEqual({
      scorePercent: 80,
      playedAt: '2026-06-01T00:00:00.000Z',
    });
  });

  it('returns null for an unknown category/difficulty combination', async () => {
    const store = createLocalStorageQuizStore();
    expect(await store.getBest('NETWORK', 'ALL')).toBeNull();
  });

  it('updates best only when the new score is strictly higher', async () => {
    const store = createLocalStorageQuizStore();
    await store.saveResult(makeResult({ scorePercent: 80, playedAt: 'a' }));
    await store.saveResult(makeResult({ scorePercent: 60, playedAt: 'b' }));
    expect((await store.getBest('ALGORITHM', 'ALL'))?.scorePercent).toBe(80);
    expect((await store.getBest('ALGORITHM', 'ALL'))?.playedAt).toBe('a');
  });

  it('does not update best on an equal score', async () => {
    const store = createLocalStorageQuizStore();
    await store.saveResult(makeResult({ scorePercent: 80, playedAt: 'first' }));
    await store.saveResult(makeResult({ scorePercent: 80, playedAt: 'second' }));
    expect((await store.getBest('ALGORITHM', 'ALL'))?.playedAt).toBe('first');
  });

  it('overwrites best when the new score is higher', async () => {
    const store = createLocalStorageQuizStore();
    await store.saveResult(makeResult({ scorePercent: 50 }));
    await store.saveResult(makeResult({ scorePercent: 90, playedAt: 'better' }));
    expect(await store.getBest('ALGORITHM', 'ALL')).toEqual({
      scorePercent: 90,
      playedAt: 'better',
    });
  });

  it('returns all best records across categories using composite keys', async () => {
    const store = createLocalStorageQuizStore();
    await store.saveResult(makeResult({ category: 'ALGORITHM', difficulty: 'ALL', scorePercent: 70 }));
    await store.saveResult(makeResult({ category: 'DATA_STRUCTURE', difficulty: 'ALL', scorePercent: 90 }));
    expect(await store.getAllBest()).toEqual({
      'ALGORITHM::ALL': { scorePercent: 70, playedAt: '2026-06-01T00:00:00.000Z' },
      'DATA_STRUCTURE::ALL': { scorePercent: 90, playedAt: '2026-06-01T00:00:00.000Z' },
    });
  });

  it('tracks records separately per difficulty', async () => {
    const store = createLocalStorageQuizStore();
    await store.saveResult(makeResult({ category: 'ALGORITHM', difficulty: 'EASY', scorePercent: 60 }));
    await store.saveResult(makeResult({ category: 'ALGORITHM', difficulty: 'HARD', scorePercent: 40 }));
    expect((await store.getBest('ALGORITHM', 'EASY'))?.scorePercent).toBe(60);
    expect((await store.getBest('ALGORITHM', 'HARD'))?.scorePercent).toBe(40);
    expect(await store.getBest('ALGORITHM', 'ALL')).toBeNull();
  });

  it('falls back to empty state on corrupted JSON', async () => {
    window.localStorage.setItem(STORAGE_KEY, '{not valid json');
    const store = createLocalStorageQuizStore();
    expect(await store.getAllBest()).toEqual({});
    expect(await store.getBest('ALGORITHM', 'ALL')).toBeNull();
  });

  it('returns empty map when storage key is absent', async () => {
    const store = createLocalStorageQuizStore();
    expect(await store.getAllBest()).toEqual({});
  });

  it('does not throw when localStorage.setItem throws (best-effort persistence)', async () => {
    const setItemSpy = jest
      .spyOn(window.localStorage.__proto__, 'setItem')
      .mockImplementation(() => {
        throw new DOMException('QuotaExceededError');
      });
    try {
      const store = createLocalStorageQuizStore();
      await expect(store.saveResult(makeResult({ scorePercent: 80 }))).resolves.toBeUndefined();
      // setItem이 throw해도 읽기 경로는 정상 동작한다 (영속화 실패 무영향)
      expect(await store.getBest('ALGORITHM', 'ALL')).toBeNull();
    } finally {
      setItemSpy.mockRestore();
    }
  });
});
