/**
 * @file useStudyStats SWR 훅 단위 테스트
 * @domain study
 * @layer test
 * @related use-study-stats.ts, cacheKeys, swr.ts
 */

import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { useStudyStats } from '../use-study-stats';
import type { StudyStats } from '@/lib/api';

// swrFetcher를 mock으로 대체 (실제 HTTP 요청 방지), cacheKeys는 실제 구현 유지
jest.mock('@/lib/swr', () => ({
  ...jest.requireActual('@/lib/swr'),
  swrFetcher: jest.fn(),
}));

const mockFetcher = jest.fn();

/**
 * SWR 캐시 격리 + 목 페처를 주입하는 테스트 래퍼
 */
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, fetcher: mockFetcher }}>
    {children}
  </SWRConfig>
);

/** 공통 목 통계 픽스처 */
const mockStats: StudyStats = {
  totalSubmissions: 20,
  uniqueSubmissions: 15,
  uniqueAnalyzed: 10,
  byWeek: [
    { week: '1', count: 10 },
    { week: '2', count: 10 },
  ],
  byWeekPerUser: [{ userId: 'user-1', week: '1', count: 5 }],
  byMember: [],
  byMemberWeek: null,
  recentSubmissions: [],
  solvedProblemIds: ['prob-1'],
  userSubmissions: [{ problemId: 'prob-1', aiScore: 90, createdAt: '2026-04-20T00:00:00Z' }],
  submitterCountByProblem: [{ problemId: 'prob-1', count: 3, analyzedCount: 2 }],
};

describe('useStudyStats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('studyId가 있을 때 스터디 통계를 조회한다', async () => {
    mockFetcher.mockResolvedValue(mockStats);

    const { result } = renderHook(() => useStudyStats('study-1'), { wrapper });

    // 초기 로딩 상태 검증
    expect(result.current.isLoading).toBe(true);
    expect(result.current.stats).toBeNull();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.stats).toEqual(mockStats);
    expect(result.current.error).toBeNull();
    expect(mockFetcher).toHaveBeenCalledWith('/api/studies/study-1/stats');
  });

  it('weekNumber 파라미터가 있을 때 쿼리스트링이 포함된 URL로 조회한다', async () => {
    mockFetcher.mockResolvedValue(mockStats);

    const { result } = renderHook(() => useStudyStats('study-1', '3'), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFetcher).toHaveBeenCalledWith('/api/studies/study-1/stats?weekNumber=3');
    expect(result.current.stats).toEqual(mockStats);
  });

  it('studyId가 null이면 요청을 스킵하고 null stats를 반환한다', () => {
    const { result } = renderHook(() => useStudyStats(null), { wrapper });

    // fetcher 미호출 검증
    expect(mockFetcher).not.toHaveBeenCalled();
    expect(result.current.stats).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('fetch 실패 시 error를 반환하고 stats는 null이다', async () => {
    const fetchError = new Error('서버 오류 (500)');
    mockFetcher.mockRejectedValue(fetchError);

    const { result } = renderHook(() => useStudyStats('study-1'), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe(fetchError);
    expect(result.current.stats).toBeNull();
  });

  it('mutate 함수가 노출된다', () => {
    const { result } = renderHook(() => useStudyStats('study-1'), { wrapper });

    expect(typeof result.current.mutate).toBe('function');
  });
});
