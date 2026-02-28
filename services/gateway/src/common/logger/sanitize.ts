/**
 * AlgoSu Gateway — 로그 보안 유틸리티
 * ------------------------------------
 * 규칙 근거: /docs/monitoring-log-rules.md §3
 *
 * 보안 요구사항:
 * - Authorization, X-Internal-Key, Cookie 헤더 → [REDACTED]
 * - IP 마지막 옥텟 마스킹
 * - 이메일 앞 2자 + **@domain 처리
 * - path, userAgent 제어문자 제거 + truncate
 * - Axios 에러 응답에서 민감 헤더 제거
 * - Log Injection 방지: 제어문자 패턴 제거
 */

// Log Injection 방지: 제어문자 패턴 (CR LF TAB NUL 및 \x00-\x1f 전체)
const CONTROL_CHAR_RE = /[\x00-\x1f\x7f]/g;

// 마스킹 대상 헤더 (소문자 정규화 후 비교)
const REDACTED_HEADERS = new Set([
  'authorization',
  'x-internal-key',
  'cookie',
  'x-api-key',
]);

/**
 * 제어문자 제거 + 길이 truncate (Log Injection 방지)
 */
export function sanitizePath(path: string, maxLen = 500): string {
  return path.replace(CONTROL_CHAR_RE, '').slice(0, maxLen);
}

/**
 * User-Agent 제어문자 제거 + truncate
 */
export function sanitizeUserAgent(ua: string, maxLen = 200): string {
  return ua.replace(CONTROL_CHAR_RE, '').slice(0, maxLen);
}

/**
 * IP 마지막 옥텟 마스킹: 192.168.1.100 → 192.168.1.**
 */
export function maskIp(ip: string): string {
  const parts = ip.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.${parts[2]}.**`;
  }
  // IPv6 또는 비표준 형식은 전체 마스킹
  return '***';
}

/**
 * 이메일 마스킹: user@example.com → us**@example.com
 */
export function maskEmail(email: string): string {
  const atIdx = email.indexOf('@');
  if (atIdx < 0) return '**';
  const local = email.slice(0, atIdx);
  const domain = email.slice(atIdx);
  return `${local.slice(0, 2)}**${domain}`;
}

/**
 * 민감 헤더 [REDACTED] 처리
 * Authorization, X-Internal-Key, Cookie, X-Api-Key
 */
export function sanitizeHeaders(
  headers: Record<string, string | string[] | undefined>,
): Record<string, string | string[] | undefined> {
  const result: Record<string, string | string[] | undefined> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (REDACTED_HEADERS.has(key.toLowerCase())) {
      result[key] = '[REDACTED]';
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Axios 에러 응답 직렬화 (민감 정보 제거)
 * - 응답 헤더에서 민감 헤더 제거
 * - 요청 config의 headers에서 민감 헤더 제거
 * - production에서 stack trace 제거
 */
export function sanitizeAxiosError(error: unknown): {
  name: string;
  message: string;
  code?: string;
  status?: number;
  url?: string;
  stack?: string;
} {
  if (!isAxiosError(error)) {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message.slice(0, 500),
        ...(process.env['ENV'] !== 'production' && error.stack
          ? { stack: error.stack }
          : {}),
      };
    }
    return { name: 'UnknownError', message: String(error).slice(0, 500) };
  }

  const result: ReturnType<typeof sanitizeAxiosError> = {
    name: error.name ?? 'AxiosError',
    message: error.message?.slice(0, 500) ?? 'Unknown axios error',
  };

  if (error.code) result.code = error.code;
  if (error.response?.status) result.status = error.response.status;
  if (error.config?.url) result.url = sanitizePath(error.config.url, 200);
  if (process.env['ENV'] !== 'production' && error.stack) {
    result.stack = error.stack;
  }

  return result;
}

/** Axios 에러 타입 가드 */
function isAxiosError(
  error: unknown,
): error is {
  name?: string;
  message?: string;
  code?: string;
  stack?: string;
  config?: { url?: string };
  response?: { status?: number };
} {
  return (
    error !== null &&
    typeof error === 'object' &&
    'isAxiosError' in error &&
    (error as Record<string, unknown>)['isAxiosError'] === true
  );
}
