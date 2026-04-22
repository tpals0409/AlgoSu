/**
 * @file useProblems SWR 훅 단위 테스트
 * @domain problem
 * @layer test
 * @related use-problems.ts, cacheKeys, swr.ts
 */

import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { useProblems } from '../use-problems';
import type { Problem } from '@/lib/api';

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

/** 공통 목 문제 픽스처 */
const mockProblem: Problem = {
  id: 'prob-1',
  title: '두 수의 합',
  difficulty: 'BRONZE',
  status: 'ACTIVE',
  deadline: '2026-04-30T00:00:00Z',
  description: '두 수를 더하시오.',
  weekNumber: '1',
  allowedLanguages: ['python'],
};

describe('useProblems', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('studyId가 있을 때 문제 목록을 조회하고 데이터를 반환한다', async () => {
    mockFetcher.mockResolvedValue([mockProblem]);

    const { result } = renderHook(() => useProblems('study-1'), { wrapper });

    // 초기 로딩 상태 검증
    expect(result.current.isLoading).toBe(true);
    expect(result.current.problems).toEqual([]);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.problems).toEqual([mockProblem]);
    expect(result.current.error).toBeNull();
    expect(mockFetcher).toHaveBeenCalledWith('/api/problems/all');
  });

  it('studyId가 null이면 요청을 스킵하고 빈 배열을 반환한다', () => {
    const { result } = renderHook(() => useProblems(null), { wrapper });

    // fetcher 미호출 검증
    expect(mockFetcher).not.toHaveBeenCalled();
    expect(result.current.problems).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('fetch 실패 시 error를 반환하고 problems는 빈 배열이다', async () => {
    const fetchError = new Error('네트워크 오류');
    mockFetcher.mockRejectedValue(fetchError);

    const { result } = renderHook(() => useProblems('study-1'), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe(fetchError);
    expect(result.current.problems).toEqual([]);
  });

  it('mutate 함수가 노출된다', () => {
    const { result } = renderHook(() => useProblems('study-1'), { wrapper });

    expect(typeof result.current.mutate).toBe('function');
  });

  it('빈 배열 응답 시 problems가 빈 배열이다', async () => {
    mockFetcher.mockResolvedValue([]);

    const { result } = renderHook(() => useProblems('study-1'), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.problems).toEqual([]);
    expect(result.current.error).toBeNull();
  });
});
