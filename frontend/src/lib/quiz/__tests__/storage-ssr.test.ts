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
 * Sprint 217: async 인터페이스(Promise 반환)로 업데이트.
 */
import {
  createLocalStorageQuizStore,
  type QuizPlayResult,
} from '../storage';

const ssrResult: QuizPlayResult = {
  category: 'ALGORITHM',
  difficulty: 'ALL',
  total: 10,
  correct: 8,
  scorePercent: 80,
  playedAt: '2026-06-01T00:00:00.000Z',
};

describe('createLocalStorageQuizStore in SSR (window undefined)', () => {
  it('getBest returns null', async () => {
    expect(await createLocalStorageQuizStore().getBest('ALGORITHM', 'ALL')).toBeNull();
  });

  it('getAllBest returns an empty map', async () => {
    expect(await createLocalStorageQuizStore().getAllBest()).toEqual({});
  });

  it('saveResult is a safe no-op', async () => {
    await expect(createLocalStorageQuizStore().saveResult(ssrResult)).resolves.toBeUndefined();
  });
});
