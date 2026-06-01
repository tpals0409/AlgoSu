/**
 * @file storage.ts 단위 테스트 — 최고기록 갱신·SSR 가드·폴백
 * @domain quiz
 * @layer lib
 * @related src/lib/quiz/storage.ts
 */
import {
  createLocalStorageQuizStore,
  type QuizPlayResult,
} from '../storage';

const STORAGE_KEY = 'algosu.quiz.records';

function makeResult(overrides: Partial<QuizPlayResult> = {}): QuizPlayResult {
  return {
    category: 'ALGORITHM',
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

  it('saves a result and reads it back as best', () => {
    const store = createLocalStorageQuizStore();
    store.saveResult(makeResult({ scorePercent: 80 }));
    expect(store.getBest('ALGORITHM')).toEqual({
      scorePercent: 80,
      playedAt: '2026-06-01T00:00:00.000Z',
    });
  });

  it('returns null for an unknown category', () => {
    const store = createLocalStorageQuizStore();
    expect(store.getBest('NETWORK')).toBeNull();
  });

  it('updates best only when the new score is strictly higher', () => {
    const store = createLocalStorageQuizStore();
    store.saveResult(makeResult({ scorePercent: 80, playedAt: 'a' }));
    store.saveResult(makeResult({ scorePercent: 60, playedAt: 'b' }));
    expect(store.getBest('ALGORITHM')?.scorePercent).toBe(80);
    expect(store.getBest('ALGORITHM')?.playedAt).toBe('a');
  });

  it('does not update best on an equal score', () => {
    const store = createLocalStorageQuizStore();
    store.saveResult(makeResult({ scorePercent: 80, playedAt: 'first' }));
    store.saveResult(makeResult({ scorePercent: 80, playedAt: 'second' }));
    expect(store.getBest('ALGORITHM')?.playedAt).toBe('first');
  });

  it('overwrites best when the new score is higher', () => {
    const store = createLocalStorageQuizStore();
    store.saveResult(makeResult({ scorePercent: 50 }));
    store.saveResult(makeResult({ scorePercent: 90, playedAt: 'better' }));
    expect(store.getBest('ALGORITHM')).toEqual({
      scorePercent: 90,
      playedAt: 'better',
    });
  });

  it('returns all best records across categories', () => {
    const store = createLocalStorageQuizStore();
    store.saveResult(makeResult({ category: 'ALGORITHM', scorePercent: 70 }));
    store.saveResult(makeResult({ category: 'DATA_STRUCTURE', scorePercent: 90 }));
    expect(store.getAllBest()).toEqual({
      ALGORITHM: { scorePercent: 70, playedAt: '2026-06-01T00:00:00.000Z' },
      DATA_STRUCTURE: { scorePercent: 90, playedAt: '2026-06-01T00:00:00.000Z' },
    });
  });

  it('falls back to empty state on corrupted JSON', () => {
    window.localStorage.setItem(STORAGE_KEY, '{not valid json');
    const store = createLocalStorageQuizStore();
    expect(store.getAllBest()).toEqual({});
    expect(store.getBest('ALGORITHM')).toBeNull();
  });

  it('returns empty map when storage key is absent', () => {
    const store = createLocalStorageQuizStore();
    expect(store.getAllBest()).toEqual({});
  });

  it('does not throw when localStorage.setItem throws (best-effort persistence)', () => {
    const setItemSpy = jest
      .spyOn(window.localStorage.__proto__, 'setItem')
      .mockImplementation(() => {
        throw new DOMException('QuotaExceededError');
      });
    try {
      const store = createLocalStorageQuizStore();
      expect(() => store.saveResult(makeResult({ scorePercent: 80 }))).not.toThrow();
      // setItem이 throw해도 읽기 경로는 정상 동작한다 (영속화 실패 무영향)
      expect(store.getBest('ALGORITHM')).toBeNull();
    } finally {
      setItemSpy.mockRestore();
    }
  });
});
