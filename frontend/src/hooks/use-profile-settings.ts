/**
 * @file 프로필 설정 SWR 훅
 * @domain share
 * @layer hook
 * @related settingsApi, cacheKeys
 */

import useSWR from 'swr';
import { cacheKeys } from '@/lib/swr';
import type { ProfileSettings } from '@/lib/api';
import type { KeyedMutator } from 'swr';

interface UseProfileSettingsReturn {
  settings: ProfileSettings | null;
  isLoading: boolean;
  error: Error | null;
  mutate: KeyedMutator<ProfileSettings>;
}

/**
 * 프로필 설정을 SWR로 조회
 * @param enabled 조회 조건 (인증 완료 시 true)
 */
export function useProfileSettings(enabled: boolean): UseProfileSettingsReturn {
  const { data, error, isLoading, mutate } = useSWR<ProfileSettings>(
    enabled ? cacheKeys.settings.profile() : null,
  );

  return {
    settings: data ?? null,
    isLoading,
    error: error ?? null,
    mutate,
  };
}
