/**
 * @file SWR 공용 fetcher & 캐시 키 유틸
 * @domain common
 * @layer lib
 * @related api.ts, SWRProvider
 */

import { mutate } from 'swr';
import { fetchApi } from '@/lib/api';

/**
 * SWR fetcher — fetchApi를 위임하여 httpOnly Cookie 인증·X-Study-ID 헤더 자동 주입
 * SWR 2.x: array key는 단일 tuple 인자로 전달 → 첫 요소(path)만 추출
 */
export async function swrFetcher<T>(key: string | readonly [string, ...unknown[]]): Promise<T> {
  const path = Array.isArray(key) ? key[0] : key;
  return fetchApi<T>(path);
}

/**
 * 도메인별 캐시 키 팩토리 — API path를 그대로 키로 사용
 */
export const cacheKeys = {
  problems: {
    all: () => '/api/problems/all' as const,
    byId: (id: string) => `/api/problems/${id}` as const,
  },
  submissions: {
    list: (params?: URLSearchParams) => {
      const qs = params?.toString();
      return `/api/submissions${qs ? `?${qs}` : ''}` as const;
    },
    byId: (id: string) => `/api/submissions/${id}` as const,
  },
  studies: {
    stats: (studyId: string, weekNumber?: string) => {
      const qs = weekNumber ? `?weekNumber=${encodeURIComponent(weekNumber)}` : '';
      return `/api/studies/${studyId}/stats${qs}` as const;
    },
    members: (studyId: string) => `/api/studies/${studyId}/members` as const,
  },
  notifications: {
    unreadCount: () => '/api/notifications/unread-count' as const,
    list: () => '/api/notifications' as const,
  },
  settings: {
    profile: () => '/api/users/me/settings' as const,
  },
  aiQuota: () => '/api/analysis/quota' as const,
  feedbacks: {
    list: (params?: URLSearchParams) => {
      const qs = params?.toString();
      return `/api/feedbacks${qs ? `?${qs}` : ''}` as const;
    },
    detail: (publicId: string) => `/api/feedbacks/${publicId}/detail` as const,
  },
} as const;

/**
 * 전체 SWR 캐시 무효화 — 스터디 전환 시 호출
 */
export function invalidateAllCache(): void {
  void mutate(() => true, undefined, { revalidate: true });
}
