/**
 * @file useFeedbackDetail SWR 훅 단위 테스트
 * @domain feedback
 * @layer test
 * @related use-feedback-detail.ts, cacheKeys, swr.ts
 */

import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { useFeedbackDetail } from '../use-feedback-detail';
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

describe('useFeedbackDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('publicId가 있을 때 상세를 조회한다', async () => {
    mockFetcher.mockResolvedValue(mockFeedback);

    const { result } = renderHook(() => useFeedbackDetail('fb-1'), { wrapper });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.detail).toBeNull();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.detail).toEqual(mockFeedback);
    expect(result.current.error).toBeNull();
    expect(mockFetcher).toHaveBeenCalledWith('/api/feedbacks/fb-1/detail');
  });

  it('publicId가 null이면 요청을 스킵하고 detail null을 반환한다', () => {
    const { result } = renderHook(() => useFeedbackDetail(null), { wrapper });

    expect(mockFetcher).not.toHaveBeenCalled();
    expect(result.current.detail).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('fetch 실패 시 error를 반환한다', async () => {
    const fetchError = new Error('서버 오류 (404)');
    mockFetcher.mockRejectedValue(fetchError);

    const { result } = renderHook(() => useFeedbackDetail('fb-1'), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe(fetchError);
    expect(result.current.detail).toBeNull();
  });

  it('mutate 함수가 노출된다', () => {
    const { result } = renderHook(() => useFeedbackDetail('fb-1'), { wrapper });
    expect(typeof result.current.mutate).toBe('function');
  });
});
