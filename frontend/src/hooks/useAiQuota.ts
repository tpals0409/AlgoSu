/**
 * @file AI 일일 할당량 조회 hook
 * @domain ai
 * @layer hook
 * @related aiQuotaApi, AiQuotaBadge
 */

import { useState, useEffect, useCallback } from 'react';
import { aiQuotaApi, type AiQuota } from '@/lib/api';

// ─── TYPES ────────────────────────────────

interface UseAiQuotaReturn {
  /** 할당량 데이터 (로딩 전 null) */
  quota: AiQuota | null;
  /** 로딩 상태 */
  isLoading: boolean;
  /** 에러 메시지 */
  error: string | null;
  /** 수동 리프레시 */
  refresh: () => void;
}

// ─── HOOK ─────────────────────────────────

/**
 * AI 일일 할당량을 조회하는 hook
 *
 * @domain ai
 * @param enabled - true일 때만 API 호출 (인증 완료 후 사용)
 * @returns 할당량 데이터, 로딩/에러 상태, 리프레시 함수
 */
export function useAiQuota(enabled: boolean = true): UseAiQuotaReturn {
  const [quota, setQuota] = useState<AiQuota | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchQuota = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await aiQuotaApi.get();
      setQuota(data);
    } catch (err: unknown) {
      setError((err as Error).message ?? 'AI 할당량 조회 실패');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) {
      void fetchQuota();
    }
  }, [enabled, fetchQuota]);

  const refresh = useCallback(() => {
    void fetchQuota();
  }, [fetchQuota]);

  return { quota, isLoading, error, refresh };
}
