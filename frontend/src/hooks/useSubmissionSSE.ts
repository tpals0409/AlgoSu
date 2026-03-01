'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { getToken } from '@/lib/auth';

/**
 * Submission SSE Hook — EventSource API
 *
 * Gateway의 GET /sse/submissions/:id 엔드포인트에 연결
 * Redis Pub/Sub → SSE 스트림 → UI 상태 업데이트
 *
 * 상태 매핑:
 * - github_synced → Step 2 완료
 * - github_failed → Step 2 실패
 * - github_token_invalid → Step 2 실패 (재연동 필요)
 * - ai_completed → Step 3 완료
 * - ai_delayed → Step 3 지연 (Circuit Breaker)
 * - ai_failed → Step 3 실패
 *
 * 최종 상태 수신 시 자동 재연결 중단
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

const API_BASE = process.env['NEXT_PUBLIC_API_BASE_URL'] ?? 'http://localhost:3000';

export function useSubmissionSSE(submissionId: string | null) {
  const [status, setStatus] = useState<SSEStatus>('connecting');
  const [events, setEvents] = useState<SSEEvent[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!submissionId) return;

    // H1: JWT 토큰을 query param으로 전달 (SSE 인증)
    const token = getToken();
    const url = `${API_BASE}/sse/submissions/${submissionId}${token ? `?token=${encodeURIComponent(token)}` : ''}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    setStatus('github_syncing');

    es.addEventListener('status', (e: MessageEvent) => {
      try {
        const event: SSEEvent = JSON.parse(e.data);
        setEvents((prev) => [...prev, event]);

        // 상태 매핑
        switch (event.status) {
          case 'github_synced':
            setStatus('ai_analyzing');
            break;
          case 'github_skipped':
            setStatus('github_skipped');
            break;
          case 'github_failed':
            setStatus('github_failed');
            break;
          case 'github_token_invalid':
            setStatus('github_token_invalid');
            disconnect();
            break;
          case 'ai_completed':
            setStatus('done');
            disconnect();
            break;
          case 'ai_delayed':
            setStatus('ai_delayed');
            break;
          case 'ai_failed':
            setStatus('ai_failed');
            disconnect();
            break;
          default:
            break;
        }
      } catch {
        // 파싱 오류 무시
      }
    });

    es.addEventListener('done', () => {
      disconnect();
    });

    es.onerror = () => {
      // EventSource 자동 재연결 — 3초 후 재시도
      setStatus('error');
    };

    return () => {
      disconnect();
    };
  }, [submissionId, disconnect]);

  return { status, events, disconnect };
}

/**
 * SSE 상태를 3단계 UI 상태로 변환
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
        return 'done' as const;
      })(),
      detail: status === 'github_token_invalid'
        ? 'GitHub 재연동이 필요합니다'
        : status === 'github_skipped'
          ? 'GitHub 동기화 건너뜀 (스터디 레포 미설정)'
          : undefined,
    },
    {
      label: 'AI 분석',
      status: (() => {
        if (['connecting', 'github_syncing'].includes(status)) return 'pending' as const;
        if (status === 'ai_analyzing') return 'in_progress' as const;
        if (['ai_failed', 'ai_delayed'].includes(status)) return 'failed' as const;
        if (['done', 'ai_completed'].includes(status)) return 'done' as const;
        // GitHub 실패 시에도 AI 분석은 진행될 수 있음
        if (['github_failed'].includes(status)) return 'in_progress' as const;
        return 'pending' as const;
      })(),
      detail: status === 'ai_delayed' ? 'AI 분석이 지연되고 있습니다 (잠시 후 재확인)' : undefined,
    },
  ];

  return steps;
}
