/**
 * @file useStudyMembers SWR 훅 단위 테스트
 * @domain study
 * @layer test
 * @related use-study-members.ts, cacheKeys, swr.ts
 */

import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { useStudyMembers } from '../use-study-members';
import type { StudyMember } from '@/lib/api';

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

const mockMembers: StudyMember[] = [
  {
    id: 'm-1',
    study_id: 'study-1',
    user_id: 'user-1',
    role: 'ADMIN',
    joined_at: '2026-04-01T00:00:00Z',
    nickname: 'Alice',
    email: 'alice@example.com',
  },
  {
    id: 'm-2',
    study_id: 'study-1',
    user_id: 'user-2',
    role: 'MEMBER',
    joined_at: '2026-04-05T00:00:00Z',
    nickname: 'Bob',
    email: 'bob@example.com',
  },
];

describe('useStudyMembers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('studyId가 있을 때 멤버 목록을 조회한다', async () => {
    mockFetcher.mockResolvedValue(mockMembers);

    const { result } = renderHook(() => useStudyMembers('study-1'), { wrapper });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.members).toEqual([]);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.members).toEqual(mockMembers);
    expect(result.current.error).toBeNull();
    expect(mockFetcher).toHaveBeenCalledWith('/api/studies/study-1/members');
  });

  it('studyId가 null이면 요청을 스킵하고 빈 배열을 반환한다', () => {
    const { result } = renderHook(() => useStudyMembers(null), { wrapper });

    expect(mockFetcher).not.toHaveBeenCalled();
    expect(result.current.members).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('fetch 실패 시 error를 반환한다', async () => {
    const fetchError = new Error('서버 오류 (500)');
    mockFetcher.mockRejectedValue(fetchError);

    const { result } = renderHook(() => useStudyMembers('study-1'), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe(fetchError);
    expect(result.current.members).toEqual([]);
  });

  it('mutate 함수가 노출된다', () => {
    const { result } = renderHook(() => useStudyMembers('study-1'), { wrapper });
    expect(typeof result.current.mutate).toBe('function');
  });
});
