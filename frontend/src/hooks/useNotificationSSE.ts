/**
 * @file 알림 SSE 실시간 수신 Hook
 * @domain notification
 * @layer hook
 * @related NotificationBell, SseController
 *
 * Gateway의 GET /sse/notifications 엔드포인트에 연결하여
 * 실시간 알림을 수신. Redis Pub/Sub → SSE 스트림 → UI 반영.
 *
 * 타임아웃(5분) 또는 비정상 종료 시 자동 재연결 (최대 5회, 지수 백오프).
 * 로그인 상태에서만 연결.
 */
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Notification } from '@/lib/api';

// ─── CONSTANTS ────────────────────────────

const API_BASE =
  typeof process !== 'undefined' && process.env['NEXT_PUBLIC_API_BASE_URL']
    ? process.env['NEXT_PUBLIC_API_BASE_URL']
    : '';

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_MS = 3000;

// ─── HOOK ─────────────────────────────────

/**
 * SSE 기반 실시간 알림 수신 hook
 *
 * @domain notification
 * @param enabled - SSE 연결 활성화 여부 (로그인 상태)
 * @param onNotification - 새 알림 수신 콜백
 */
export function useNotificationSSE(
  enabled: boolean,
  onNotification: (notification: Notification) => void,
): { sseDisconnected: boolean } {
  const abortControllerRef = useRef<AbortController | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onNotificationRef = useRef(onNotification);
  const [sseDisconnected, setSseDisconnected] = useState(false);

  // 콜백 ref 최신 유지 (리렌더 시 재연결 방지)
  onNotificationRef.current = onNotification;

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    let terminated = false;

    const connect = async (): Promise<void> => {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const response = await fetch(`${API_BASE}/sse/notifications`, {
          credentials: 'include',
          headers: { Accept: 'text/event-stream' },
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          if (!terminated) scheduleReconnect();
          return;
        }

        // 연결 성공 시 재연결 카운터 리셋 + 연결 복구 표시
        reconnectAttemptRef.current = 0;
        setSseDisconnected(false);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (!terminated) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const raw = trimmed.slice('data:'.length).trim();
            try {
              const notification: Notification = JSON.parse(raw);
              onNotificationRef.current(notification);
            } catch {
              // 파싱 오류 무시 (heartbeat, timeout 등)
            }
          }
        }

        // 스트림 정상 종료 (타임아웃 등) → 재연결
        if (!terminated) {
          scheduleReconnect();
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (!terminated) {
          scheduleReconnect();
        }
      }
    };

    const scheduleReconnect = (): void => {
      if (terminated) return;

      reconnectAttemptRef.current += 1;
      if (reconnectAttemptRef.current > MAX_RECONNECT_ATTEMPTS) {
        // 최대 재연결 초과 시 폴링 fallback으로 동작 (SSE 중단)
        setSseDisconnected(true);
        return;
      }

      const delay = RECONNECT_BASE_MS * Math.pow(2, reconnectAttemptRef.current - 1);
      reconnectTimerRef.current = setTimeout(() => {
        if (!terminated) {
          void connect();
        }
      }, delay);
    };

    void connect();

    return () => {
      terminated = true;
      disconnect();
    };
  }, [enabled, disconnect]);

  return { sseDisconnected };
}
