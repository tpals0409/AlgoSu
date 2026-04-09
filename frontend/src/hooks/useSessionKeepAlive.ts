/**
 * @file 세션 유지 훅 — 사용자 활동 감지 + heartbeat + 만료 감지
 * @domain identity
 * @layer hook
 * @related AuthContext, TokenRefreshInterceptor, lib/session-policy.ts, docs/adr/sprints/sprint-71.md
 *
 * 사용자 활동(click/mousemove/keydown/scroll/touchstart) 감지 시
 * 일정 간격으로 heartbeat API를 호출하여 세션을 유지한다.
 * 탭 비활성 시 heartbeat을 중단하고, 세션 만료 시 콜백을 호출한다.
 *
 * Sprint 71 (71-2R): 하드코딩 상수 제거, 런타임 정책 주입.
 *   - HEARTBEAT_INTERVAL_MS, SESSION_TIMEOUT_MS → policy 필드로 이동
 *   - ACTIVITY_DEBOUNCE_MS는 서버 정책이 아닌 UX 상수이므로 유지
 *
 * 정책은 호출부(AuthContext)가 `ClientSessionPolicy`로 주입한다.
 * 정책 변경 시 타이머가 재설정되도록 effect deps에 policy 필드를 포함한다.
 */

'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { ClientSessionPolicy } from '@/lib/session-policy';

/** 활동 감지 디바운스 (ms) — 마지막 활동 후 30초 이상 경과해야 새 활동으로 인정 */
const ACTIVITY_DEBOUNCE_MS = 30 * 1000;

/** 세션 만료 체크 타이머 주기 (ms) — 1분마다 마지막 heartbeat 경과 시간 판정 */
const EXPIRY_CHECK_INTERVAL_MS = 60 * 1000;

interface UseSessionKeepAliveOptions {
  /** 인증 상태 — false면 heartbeat 비활성 */
  enabled: boolean;
  /** 세션 만료 시 호출 */
  onSessionExpired: () => void;
  /** 세션 정책 (서버에서 fetch 또는 DEFAULT_SESSION_POLICY) */
  policy: ClientSessionPolicy;
}

export function useSessionKeepAlive({
  enabled,
  onSessionExpired,
  policy,
}: UseSessionKeepAliveOptions): void {
  const lastActivityRef = useRef<number>(Date.now());
  const lastHeartbeatRef = useRef<number>(Date.now());
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const expiryTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onSessionExpiredRef = useRef(onSessionExpired);
  onSessionExpiredRef.current = onSessionExpired;

  const { heartbeatIntervalMs, sessionTimeoutMs } = policy;

  const sendHeartbeat = useCallback(async () => {
    // 탭이 숨겨져 있으면 전송하지 않음
    if (document.hidden) return;

    // 마지막 활동이 heartbeat 주기 이내가 아니면 (유휴 상태) 전송하지 않음
    const idleTime = Date.now() - lastActivityRef.current;
    if (idleTime > heartbeatIntervalMs) return;

    try {
      const res = await fetch('/auth/heartbeat', {
        method: 'GET',
        credentials: 'include',
      });
      if (res.ok || res.status === 204) {
        lastHeartbeatRef.current = Date.now();
      } else if (res.status === 401) {
        // 토큰 만료 — 세션 만료 처리
        onSessionExpiredRef.current();
      }
    } catch {
      // 네트워크 오류 — 무시 (다음 주기에 재시도)
    }
  }, [heartbeatIntervalMs]);

  const recordActivity = useCallback(() => {
    const now = Date.now();
    if (now - lastActivityRef.current > ACTIVITY_DEBOUNCE_MS) {
      lastActivityRef.current = now;
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    // 활동 이벤트 등록
    const events = ['click', 'mousemove', 'keydown', 'scroll', 'touchstart'] as const;
    for (const event of events) {
      window.addEventListener(event, recordActivity, { passive: true });
    }

    // heartbeat 주기 타이머
    heartbeatTimerRef.current = setInterval(() => {
      void sendHeartbeat();
    }, heartbeatIntervalMs);

    // 세션 만료 체크 타이머 (1분마다)
    expiryTimerRef.current = setInterval(() => {
      const sinceLastHeartbeat = Date.now() - lastHeartbeatRef.current;
      if (sinceLastHeartbeat > sessionTimeoutMs) {
        onSessionExpiredRef.current();
      }
    }, EXPIRY_CHECK_INTERVAL_MS);

    // visibility change — 탭 복귀 시 즉시 heartbeat
    const handleVisibility = () => {
      if (!document.hidden) {
        lastActivityRef.current = Date.now();
        void sendHeartbeat();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      for (const event of events) {
        window.removeEventListener(event, recordActivity);
      }
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
      if (expiryTimerRef.current) clearInterval(expiryTimerRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [enabled, recordActivity, sendHeartbeat, heartbeatIntervalMs, sessionTimeoutMs]);
}
