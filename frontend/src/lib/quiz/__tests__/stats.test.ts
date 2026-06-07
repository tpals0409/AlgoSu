/**
 * @file aggregateCategoryBests 단위 테스트 — 분야별 최고 점수 집계
 * @domain quiz
 * @layer lib
 * @related src/lib/quiz/stats.ts
 */
import { aggregateCategoryBests } from '../stats';
import { QuizCategory } from '@/data/quiz';
import type { QuizBestRecord } from '../storage';

/** 테스트용 best 기록 생성 헬퍼. */
function rec(scorePercent: number): QuizBestRecord {
  return { scorePercent, playedAt: '2026-06-07T00:00:00.000Z' };
}

describe('aggregateCategoryBests', () => {
  it('returns an empty array for an empty map', () => {
    expect(aggregateCategoryBests({})).toEqual([]);
  });

  it('maps a single composite key to one category stat', () => {
    const result = aggregateCategoryBests({ 'DATA_STRUCTURE::ALL': rec(80) });
    expect(result).toEqual([{ category: QuizCategory.DATA_STRUCTURE, bestPercent: 80 }]);
  });

  it('keeps only the highest score across difficulties of the same category', () => {
    const result = aggregateCategoryBests({
      'ALGORITHM::EASY': rec(60),
      'ALGORITHM::HARD': rec(90),
      'ALGORITHM::ALL': rec(75),
    });
    expect(result).toEqual([{ category: QuizCategory.ALGORITHM, bestPercent: 90 }]);
  });

  it('sorts categories by best score descending', () => {
    const result = aggregateCategoryBests({
      'DATA_STRUCTURE::ALL': rec(50),
      'ALGORITHM::ALL': rec(95),
      'NETWORK::ALL': rec(70),
    });
    expect(result).toEqual([
      { category: QuizCategory.ALGORITHM, bestPercent: 95 },
      { category: QuizCategory.NETWORK, bestPercent: 70 },
      { category: QuizCategory.DATA_STRUCTURE, bestPercent: 50 },
    ]);
  });

  it('ignores keys with an unknown category', () => {
    const result = aggregateCategoryBests({
      'UNKNOWN_CATEGORY::ALL': rec(100),
      'OS::ALL': rec(40),
    });
    expect(result).toEqual([{ category: QuizCategory.OS, bestPercent: 40 }]);
  });

  it('ignores malformed keys without the separator', () => {
    const result = aggregateCategoryBests({
      DATABASE: rec(100),
      'DATABASE::MEDIUM': rec(55),
    });
    expect(result).toEqual([{ category: QuizCategory.DATABASE, bestPercent: 55 }]);
  });
});
