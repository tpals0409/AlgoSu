/**
 * @file useFeedbacks SWR 훅 단위 테스트
 * @domain feedback
 * @layer test
 * @related use-feedbacks.ts, cacheKeys, swr.ts
 */

import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { useFeedbacks } from '../use-feedbacks';
import type { AdminFeedback } from '@/lib/api';

jest.mock('@/lib/swr', () => ({
  ...jest.requireActual('@/lib/swr'),
  swrFetcher: jest.fn(),
}));

const mockFetcher = jest.fn();

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, fetcher: mockFetcher }}>
    {children}
  </SWRConfig>
);

const mockFeedback: AdminFeedback = {
  publicId: 'fb-1',
  userId: 'user-1',
  userName: 'Alice',
  userEmail: 'alice@example.com',
  studyId: 'study-1',
  studyName: 'Study 1',
  category: 'BUG',
  content: 'sample feedback',
  pageUrl: null,
  browserInfo: null,
  screenshot: null,
  status: 'OPEN',
  createdAt: '2026-04-20T00:00:00Z',
  resolvedAt: null,
};

const mockResponse = {
  items: [mockFeedback],
  total: 1,
  counts: { OPEN: 1, 'cat:BUG': 1 },
};

describe('useFeedbacks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('필수 page/pageSize만으로 호출 시 기본 쿼리스트링으로 조회한다', async () => {
    mockFetcher.mockResolvedValue(mockResponse);

    const { result } = renderHook(
      () => useFeedbacks({ page: 1, pageSize: 10 }),
      { wrapper },
    );

    expect(result.current.isLoading).toBe(true);
    expect(result.current.feedbacks).toEqual([]);
    expect(result.current.total).toBe(0);
    expect(result.current.counts).toEqual({});

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.feedbacks).toEqual([mockFeedback]);
    expect(result.current.total).toBe(1);
    expect(result.current.counts).toEqual({ OPEN: 1, 'cat:BUG': 1 });
    expect(mockFetcher).toHaveBeenCalledWith('/api/feedbacks?page=1&limit=10');
  });

  it('category/search/status 모든 필터가 쿼리스트링에 포함된다', async () => {
    mockFetcher.mockResolvedValue(mockResponse);

    const { result } = renderHook(
      () => useFeedbacks({ page: 2, pageSize: 20, category: 'BUG', search: 'foo', status: 'OPEN' }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFetcher).toHaveBeenCalledWith(
      '/api/feedbacks?page=2&limit=20&category=BUG&search=foo&status=OPEN',
    );
  });

  it('counts 누락 응답도 빈 객체로 안전하게 처리한다', async () => {
    mockFetcher.mockResolvedValue({ items: [mockFeedback], total: 1 });

    const { result } = renderHook(
      () => useFeedbacks({ page: 1, pageSize: 10 }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.counts).toEqual({});
  });

  it('fetch 실패 시 error를 반환한다', async () => {
    const fetchError = new Error('서버 오류 (500)');
    mockFetcher.mockRejectedValue(fetchError);

    const { result } = renderHook(
      () => useFeedbacks({ page: 1, pageSize: 10 }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe(fetchError);
    expect(result.current.feedbacks).toEqual([]);
  });

  it('mutate 함수가 노출된다', () => {
    const { result } = renderHook(
      () => useFeedbacks({ page: 1, pageSize: 10 }),
      { wrapper },
    );
    expect(typeof result.current.mutate).toBe('function');
  });
});
