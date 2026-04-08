/**
 * @file 이벤트 트래커 — 경량 이벤트 수집 클라이언트
 * @domain common
 * @layer lib
 */

const API_BASE =
  typeof process !== 'undefined' && process.env['NEXT_PUBLIC_API_BASE_URL']
    ? process.env['NEXT_PUBLIC_API_BASE_URL']
    : '';

const BUFFER_SIZE = 5; // 5개 모이면 전송
const FLUSH_INTERVAL = 30000; // 30초마다 전송

interface EventPayload {
  type: string;
  page?: string;
  target?: string;
  value?: number;
  sessionId: string;
  userId?: string;
  ts: string;
  meta?: Record<string, unknown>;
}

class EventTracker {
  private buffer: EventPayload[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private sessionId: string;

  constructor() {
    this.sessionId = this.getOrCreateSessionId();
    if (typeof window !== 'undefined') {
      this.timer = setInterval(() => this.flush(), FLUSH_INTERVAL);
      // 페이지 이탈 시 sendBeacon으로 남은 이벤트 전송
      window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          this.flush(true);
        }
      });
    }
  }

  track(
    type: string,
    data?: Partial<Omit<EventPayload, 'type' | 'sessionId' | 'ts'>>,
  ): void {
    if (typeof window === 'undefined') return;
    this.buffer.push({
      type,
      sessionId: this.sessionId,
      ts: new Date().toISOString(),
      ...data,
    });
    if (this.buffer.length >= BUFFER_SIZE) {
      this.flush();
    }
  }

  private flush(useBeacon = false): void {
    if (this.buffer.length === 0) return;
    const events = [...this.buffer];
    this.buffer = [];
    const body = JSON.stringify({ events });

    if (useBeacon && navigator.sendBeacon) {
      navigator.sendBeacon(
        `${API_BASE}/api/events`,
        new Blob([body], { type: 'application/json' }),
      );
      return;
    }

    fetch(`${API_BASE}/api/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {
      // silent drop — 이벤트 유실 허용
    });
  }

  private getOrCreateSessionId(): string {
    if (typeof window === 'undefined') return '';
    const key = 'algosu:session-id';
    let id = sessionStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(key, id);
    }
    return id;
  }

  destroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.flush(true);
  }
}

// 싱글톤 인스턴스
export const eventTracker =
  typeof window !== 'undefined' ? new EventTracker() : null;
