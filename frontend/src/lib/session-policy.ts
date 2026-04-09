/**
 * @file session-policy.ts
 * @domain auth
 * @layer lib
 * @related services/gateway/src/auth/session-policy/, hooks/useSessionKeepAlive.ts, contexts/AuthContext.tsx
 *
 * 세션 정책 SSoT (클라이언트 측). 서버 SessionPolicyModule이 env로부터
 * 파생한 값을 `GET /auth/session-policy` (공개 엔드포인트)로 내려주며,
 * 클라이언트는 앱 부트 시 한 번 fetch하여 AuthContext에 저장한다.
 *
 * 실패/비정상 응답 시 안전한 DEFAULT_SESSION_POLICY로 fallback한다.
 * 이 모듈은 `api.ts`의 fetchApi를 사용하지 않는다:
 *   - 정책 엔드포인트는 인증 불필요이며,
 *   - fetchApi는 401 응답 시 `/login?expired=true`로 리다이렉트하므로
 *     정책 fetch 실패가 리다이렉트 루프로 이어질 수 있기 때문.
 *
 * Sprint 71 (71-2R): 하드코딩 상수 제거 + 런타임 정책 주입.
 */

/**
 * 클라이언트가 사용하는 세션 정책. Gateway SessionPolicyModule의
 * 응답 스키마와 1:1 대응한다.
 */
export interface ClientSessionPolicy {
  /** Access Token TTL (ms). 정보 용도 — 프론트 직접 사용 없음 */
  accessTokenTtlMs: number;
  /** heartbeat 전송 주기 (ms). setInterval 주기 */
  heartbeatIntervalMs: number;
  /** 세션 만료 판정 시간 (ms). 마지막 heartbeat 성공 후 경과 시간과 비교 */
  sessionTimeoutMs: number;
  /** sliding refresh 임계값 (ms). 정보 용도 */
  refreshThresholdMs: number;
}

/**
 * 서버 정책 fetch 실패 시 적용되는 보수적 fallback.
 *
 * 서버 기본값(JWT 2h, heartbeat 10m, timeout 125m, refresh 1h)보다
 * 짧은 값을 선택해 "서버보다 먼저 만료 판정"을 유도함으로써
 * 실제 토큰 만료로 인한 돌발 401을 최소화한다.
 *
 * - accessTokenTtlMs: 1h — 프론트 표시/정보 용도
 * - heartbeatIntervalMs: 10m — 기존 동작과 동일
 * - sessionTimeoutMs: 65m — 1h + 5m 버퍼 (보수적)
 * - refreshThresholdMs: 5m — 정보 용도
 */
export const DEFAULT_SESSION_POLICY: ClientSessionPolicy = Object.freeze({
  accessTokenTtlMs: 60 * 60 * 1000,
  heartbeatIntervalMs: 10 * 60 * 1000,
  sessionTimeoutMs: 65 * 60 * 1000,
  refreshThresholdMs: 5 * 60 * 1000,
}) as ClientSessionPolicy;

/** 정책 엔드포인트 경로 */
const SESSION_POLICY_PATH = '/auth/session-policy';

/** API base URL — api.ts와 동일한 env 규약 */
function getApiBase(): string {
  if (typeof process !== 'undefined' && process.env['NEXT_PUBLIC_API_BASE_URL']) {
    return process.env['NEXT_PUBLIC_API_BASE_URL'] as string;
  }
  return '';
}

/** 필드가 positive finite number인지 검증 */
function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/**
 * 응답 payload가 ClientSessionPolicy 스키마를 만족하는지 런타임 검증.
 * 불일치 시 null 반환 → 호출부에서 fallback 사용.
 */
function validatePolicy(payload: unknown): ClientSessionPolicy | null {
  if (payload === null || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;
  if (
    !isPositiveNumber(p['accessTokenTtlMs']) ||
    !isPositiveNumber(p['heartbeatIntervalMs']) ||
    !isPositiveNumber(p['sessionTimeoutMs']) ||
    !isPositiveNumber(p['refreshThresholdMs'])
  ) {
    return null;
  }
  return {
    accessTokenTtlMs: p['accessTokenTtlMs'] as number,
    heartbeatIntervalMs: p['heartbeatIntervalMs'] as number,
    sessionTimeoutMs: p['sessionTimeoutMs'] as number,
    refreshThresholdMs: p['refreshThresholdMs'] as number,
  };
}

/**
 * 서버에서 세션 정책을 1회 fetch한다.
 *
 * - 공개 엔드포인트 호출 (credentials 불필요)
 * - 실패/비정상 응답/스키마 불일치 시 DEFAULT_SESSION_POLICY 반환
 * - 리다이렉트 우회: 순수 fetch 사용, 401 처리 로직 없음
 * - SSR/Node 환경에서 fetch가 없을 경우 안전하게 fallback
 */
export async function fetchSessionPolicy(): Promise<ClientSessionPolicy> {
  if (typeof fetch !== 'function') {
    return DEFAULT_SESSION_POLICY;
  }
  try {
    const res = await fetch(`${getApiBase()}${SESSION_POLICY_PATH}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) return DEFAULT_SESSION_POLICY;

    const json: unknown = await res.json().catch(() => null);
    // { data: {...} } 래퍼와 플랫 응답 모두 수용
    const candidate =
      json !== null && typeof json === 'object' && 'data' in (json as Record<string, unknown>)
        ? (json as { data: unknown }).data
        : json;

    const validated = validatePolicy(candidate);
    return validated ?? DEFAULT_SESSION_POLICY;
  } catch {
    return DEFAULT_SESSION_POLICY;
  }
}
