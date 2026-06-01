/**
 * @jest-environment node
 */
/**
 * @file storage.ts SSR (typeof window === 'undefined') 분기 테스트
 * @domain quiz
 * @layer lib
 * @related src/lib/quiz/storage.ts
 *
 * Node 환경에서 실행해 window가 없는 SSR 상황의 no-op/빈 반환을 검증한다.
 */
import {
  createLocalStorageQuizStore,
  type QuizPlayResult,
} from '../storage';

const ssrResult: QuizPlayResult = {
  category: 'ALGORITHM',
  total: 10,
  correct: 8,
  scorePercent: 80,
  playedAt: '2026-06-01T00:00:00.000Z',
};

describe('createLocalStorageQuizStore in SSR (window undefined)', () => {
  it('getBest returns null', () => {
    expect(createLocalStorageQuizStore().getBest('ALGORITHM')).toBeNull();
  });

  it('getAllBest returns an empty map', () => {
    expect(createLocalStorageQuizStore().getAllBest()).toEqual({});
  });

  it('saveResult is a safe no-op', () => {
    expect(() => createLocalStorageQuizStore().saveResult(ssrResult)).not.toThrow();
  });
});
