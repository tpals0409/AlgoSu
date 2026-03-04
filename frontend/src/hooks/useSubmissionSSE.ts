/**
 * @file 제출 상태 SSE 스트림 Hook
 * @domain submission
 * @layer hook
 * @related SubmissionStatus, api.ts
 */
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Submission SSE Hook — fetch + ReadableStream (Cookie 인증)
 *
 * Gateway의 GET /sse/submissions/:id 엔드포인트에 연결
 * Redis Pub/Sub → SSE 스트림 → UI 상태 업데이트
 *
 * 상태 매핑:
 * - github_synced → Step 2 완료, Step 3 진행 중
 * - github_failed → Step 2 실패, Step 3 진행 중
 * - github_token_invalid → Step 2 실패 (재연동 필요)
 * - github_skipped → Step 2 완료 (건너뜀), Step 3 진행 중
 * - ai_completed → Step 3 완료
 * - ai_delayed → Step 3 지연 (Circuit Breaker)
 * - ai_failed → Step 3 실패
 *
 * 최종 상태 수신 시 자동 재연결 중단
 * 비정상 종료 시 자동 재연결 (최대 3회, 지수 백오프)
 */

export type SSEStatus =
  | 'connecting'
  | 'github_syncing'
  | 'github_synced'
  | 'github_failed'
  | 'github_token_invalid'
  | 'github_skipped'
  | 'ai_analyzing'
  | 'ai_completed'
  | 'ai_delayed'
  | 'ai_failed'
  | 'done'
  | 'error';

interface SSEEvent {
  submissionId: string;
  status: string;
  timestamp: string;
}

// ─── CONSTANTS ────────────────────────────

const API_BASE =
  typeof process !== 'undefined' && process.env['NEXT_PUBLIC_API_BASE_URL']
    ? process.env['NEXT_PUBLIC_API_BASE_URL']
    : '';

const TERMINAL_SSE_STATUSES = new Set([
  'github_token_invalid',
  'ai_completed',
  'ai_failed',
]);

/** 자동 재연결 최대 횟수 */
const MAX_RECONNECT_ATTEMPTS = 3;

/** 재연결 기본 대기 시간 (ms) */
const RECONNECT_BASE_MS = 2000;

// ─── HOOK ─────────────────────────────────

/**
 * SSE 기반 제출 상태 실시간 추적 hook
 *
 * 서버 재시작 시 자동 재연결 (최대 3회, 지수 백오프).
 * 최종 상태 수신 시 자동 종료.
 *
 * @domain submission
 * @param submissionId - 추적할 제출 UUID
 * @returns 현재 상태, 이벤트 목록, 연결 해제 함수
 */
export function useSubmissionSSE(submissionId: string | null) {
  const [status, setStatus] = useState<SSEStatus>('connecting');
  const [events, setEvents] = useState<SSEEvent[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  /**
   * SSE 이벤트 데이터 한 줄을 파싱하여 상태를 업데이트
   * @domain submission
   */
  const handleLine = useCallback(
    (line: string, onTerminal: () => void) => {
      if (!line.startsWith('data:')) return;
      const raw = line.slice('data:'.length).trim();
      try {
        const event: SSEEvent = JSON.parse(raw);
        setEvents((prev) => [...prev, event]);

        // 재연결 카운터 리셋 (유효 메시지 수신 = 연결 정상)
        reconnectAttemptRef.current = 0;

        switch (event.status) {
          case 'github_synced':
            setStatus('ai_analyzing');
            break;
          case 'github_skipped':
            setStatus('ai_analyzing');
            break;
          case 'github_failed':
            setStatus('github_failed');
            break;
          case 'github_token_invalid':
            setStatus('github_token_invalid');
            onTerminal();
            break;
          case 'ai_completed':
            setStatus('done');
            onTerminal();
            break;
          case 'ai_delayed':
            setStatus('ai_delayed');
            break;
          case 'ai_failed':
            setStatus('ai_failed');
            onTerminal();
            break;
          default:
            break;
        }

        if (TERMINAL_SSE_STATUSES.has(event.status)) {
          onTerminal();
        }
      } catch {
        // 파싱 오류 무시
      }
    },
    [],
  );

  useEffect(() => {
    if (!submissionId) return;

    let terminated = false;

    /**
     * fetch 기반 SSE 연결 — httpOnly Cookie를 통해 인증
     * 비정상 종료 시 지수 백오프로 자동 재연결
     * @domain submission
     */
    const connect = async (): Promise<void> => {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      if (reconnectAttemptRef.current === 0) {
        setStatus('github_syncing');
      }

      try {
        const response = await fetch(
          `${API_BASE}/sse/submissions/${submissionId}`,
          {
            credentials: 'include',
            headers: { Accept: 'text/event-stream' },
            signal: controller.signal,
          },
        );

        if (!response.ok || !response.body) {
          setStatus('error');
          return;
        }

        // 연결 성공 시 재연결 카운터 리셋
        reconnectAttemptRef.current = 0;

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
            handleLine(line.trim(), () => {
              terminated = true;
              controller.abort();
            });
          }
        }

        // 스트림 정상 종료인데 최종 상태 미수신 → 재연결 시도
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

    /**
     * 지수 백오프 재연결 스케줄러
     * @domain submission
     */
    const scheduleReconnect = (): void => {
      if (terminated) return;

      reconnectAttemptRef.current += 1;
      if (reconnectAttemptRef.current > MAX_RECONNECT_ATTEMPTS) {
        setStatus('error');
        return;
      }

      const delay = RECONNECT_BASE_MS * Math.pow(2, reconnectAttemptRef.current - 1);
      setStatus('connecting');
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
  }, [submissionId, disconnect, handleLine]);

  return { status, events, disconnect };
}

/**
 * SSE 상태를 3단계 UI 스텝으로 변환
 *
 * Step 1: 제출 완료 (항상 done)
 * Step 2: GitHub 동기화
 * Step 3: AI 분석
 *
 * @domain submission
 * @param status - 현재 SSE 상태
 * @returns 3단계 스텝 배열
 */
export function mapSSEToSteps(status: SSEStatus) {
  const steps = [
    {
      label: '제출 완료',
      status: 'done' as const,
    },
    {
      label: 'GitHub 동기화',
      status: (() => {
        if (['connecting', 'github_syncing'].includes(status)) return 'in_progress' as const;
        if (['github_failed', 'github_token_invalid'].includes(status)) return 'failed' as const;
        if (status === 'github_skipped') return 'done' as const;
        // AI 단계 진입 후에는 GitHub done
        if (['ai_analyzing', 'ai_completed', 'ai_delayed', 'ai_failed', 'done'].includes(status)) return 'done' as const;
        return 'done' as const;
      })(),
      detail: status === 'github_token_invalid'
        ? 'GitHub 재연동이 필요합니다'
        : status === 'github_skipped'
          ? 'GitHub 동기화 건너뜀 (GitHub 미연동)'
          : status === 'github_failed'
            ? 'GitHub 동기화 실패 (AI 분석은 계속 진행)'
            : undefined,
    },
    {
      label: 'AI 분석',
      status: (() => {
        if (['connecting', 'github_syncing'].includes(status)) return 'pending' as const;
        if (status === 'github_token_invalid') return 'pending' as const;
        if (['ai_analyzing', 'github_failed', 'github_skipped'].includes(status)) return 'in_progress' as const;
        if (['ai_failed', 'ai_delayed'].includes(status)) return 'failed' as const;
        if (['done', 'ai_completed'].includes(status)) return 'done' as const;
        return 'pending' as const;
      })(),
      detail: status === 'ai_delayed' ? 'AI 분석이 지연되고 있습니다 (잠시 후 재확인)' : undefined,
    },
  ];

  return steps;
}
