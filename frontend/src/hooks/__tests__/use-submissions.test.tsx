/**
 * @file useSubmissions SWR 훅 단위 테스트
 * @domain submission
 * @layer test
 * @related use-submissions.ts, cacheKeys, swr.ts
 */

import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { useSubmissions } from '../use-submissions';
import type { PaginatedResponse, Submission } from '@/lib/api';

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

/** 공통 목 제출 픽스처 */
const mockSubmission: Submission = {
  id: 'sub-1',
  problemId: 'prob-1',
  problemTitle: '두 수의 합',
  language: 'python',
  sagaStep: 'DONE',
  aiScore: 88,
  isLate: false,
  createdAt: '2026-04-22T10:00:00Z',
};

/** 페이지네이션 응답 픽스처 */
const mockPaginatedResponse: PaginatedResponse<Submission> = {
  data: [mockSubmission],
  meta: {
    total: 1,
    page: 1,
    limit: 10,
    totalPages: 1,
  },
};

describe('useSubmissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('studyId가 있을 때 제출 목록과 meta를 조회한다', async () => {
    mockFetcher.mockResolvedValue(mockPaginatedResponse);

    const { result } = renderHook(() => useSubmissions('study-1'), { wrapper });

    // 초기 로딩 상태 검증
    expect(result.current.isLoading).toBe(true);
    expect(result.current.submissions).toEqual([]);
    expect(result.current.meta).toBeNull();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.submissions).toEqual([mockSubmission]);
    expect(result.current.meta).toEqual(mockPaginatedResponse.meta);
    expect(result.current.error).toBeNull();
    expect(mockFetcher).toHaveBeenCalledWith(['/api/submissions', 'study-1']);
  });

  it('studyId가 null이면 요청을 스킵하고 빈 초기값을 반환한다', () => {
    const { result } = renderHook(() => useSubmissions(null), { wrapper });

    // fetcher 미호출 검증
    expect(mockFetcher).not.toHaveBeenCalled();
    expect(result.current.submissions).toEqual([]);
    expect(result.current.meta).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('fetch 실패 시 error를 반환하고 submissions는 빈 배열이다', async () => {
    const fetchError = new Error('네트워크 오류');
    mockFetcher.mockRejectedValue(fetchError);

    const { result } = renderHook(() => useSubmissions('study-1'), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe(fetchError);
    expect(result.current.submissions).toEqual([]);
    expect(result.current.meta).toBeNull();
  });

  it('params.page와 params.limit가 있을 때 쿼리스트링이 포함된 URL로 조회한다', async () => {
    mockFetcher.mockResolvedValue(mockPaginatedResponse);

    const { result } = renderHook(
      () => useSubmissions('study-1', { page: 2, limit: 5 }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFetcher).toHaveBeenCalledWith(['/api/submissions?page=2&limit=5', 'study-1']);
  });

  it('params.page만 있을 때 page 쿼리만 포함된 URL로 조회한다', async () => {
    mockFetcher.mockResolvedValue(mockPaginatedResponse);

    const { result } = renderHook(
      () => useSubmissions('study-1', { page: 3 }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFetcher).toHaveBeenCalledWith(['/api/submissions?page=3', 'study-1']);
  });

  it('mutate 함수가 노출된다', () => {
    const { result } = renderHook(() => useSubmissions('study-1'), { wrapper });

    expect(typeof result.current.mutate).toBe('function');
  });
});
