/**
 * @file useProfileSettings SWR 훅 단위 테스트
 * @domain share
 * @layer test
 * @related use-profile-settings.ts, cacheKeys, swr.ts
 */

import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { useProfileSettings } from '../use-profile-settings';
import type { ProfileSettings } from '@/lib/api';

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

/** 공통 목 프로필 설정 픽스처 */
const mockSettings: ProfileSettings = {
  profileSlug: 'john-doe',
  isProfilePublic: true,
};

describe('useProfileSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('enabled=true일 때 프로필 설정을 조회한다', async () => {
    mockFetcher.mockResolvedValue(mockSettings);

    const { result } = renderHook(() => useProfileSettings(true), { wrapper });

    // 초기 로딩 상태 검증
    expect(result.current.isLoading).toBe(true);
    expect(result.current.settings).toBeNull();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.settings).toEqual(mockSettings);
    expect(result.current.error).toBeNull();
    expect(mockFetcher).toHaveBeenCalledWith('/api/users/me/settings');
  });

  it('enabled=false일 때 요청을 스킵하고 null settings를 반환한다', () => {
    const { result } = renderHook(() => useProfileSettings(false), { wrapper });

    // fetcher 미호출 검증
    expect(mockFetcher).not.toHaveBeenCalled();
    expect(result.current.settings).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('fetch 실패 시 error를 반환하고 settings는 null이다', async () => {
    const fetchError = new Error('인증 실패 (401)');
    mockFetcher.mockRejectedValue(fetchError);

    const { result } = renderHook(() => useProfileSettings(true), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe(fetchError);
    expect(result.current.settings).toBeNull();
  });

  it('isProfilePublic=false 설정도 올바르게 반환한다', async () => {
    const privateSettings: ProfileSettings = {
      profileSlug: null,
      isProfilePublic: false,
    };
    mockFetcher.mockResolvedValue(privateSettings);

    const { result } = renderHook(() => useProfileSettings(true), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.settings).toEqual(privateSettings);
    expect(result.current.settings?.profileSlug).toBeNull();
    expect(result.current.settings?.isProfilePublic).toBe(false);
  });

  it('mutate 함수가 노출된다', () => {
    const { result } = renderHook(() => useProfileSettings(true), { wrapper });

    expect(typeof result.current.mutate).toBe('function');
  });
});
