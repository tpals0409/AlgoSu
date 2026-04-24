/**
 * @file API 클라이언트 인프라 — fetchApi, 에러 클래스, 스터디 ID 관리
 * @domain common
 * @layer api
 * @related AuthContext, JwtMiddleware, locale-path.ts
 */

import { stripLocalePrefix, withLocalePrefix } from '@/lib/locale-path';

const API_BASE =
  typeof process !== 'undefined' && process.env['NEXT_PUBLIC_API_BASE_URL']
    ? process.env['NEXT_PUBLIC_API_BASE_URL']
    : '';

// ── 모듈 레벨 현재 스터디 ID (StudyContext에서 설정) ──
let _currentStudyId: string | null =
  typeof window !== 'undefined'
    ? localStorage.getItem('algosu:current-study-id')
    : null;

export function setCurrentStudyIdForApi(id: string | null): void {
  _currentStudyId = id;
}

// ── API 에러 ──

const HTTP_ERROR_MESSAGES: Record<number, string> = {
  400: '잘못된 요청입니다.',
  401: '로그인이 필요합니다.',
  403: '접근 권한이 없습니다.',
  404: '요청한 리소스를 찾을 수 없습니다.',
  409: '이미 존재하는 데이터입니다.',
  429: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
  500: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
  502: '서버에 연결할 수 없습니다.',
  503: '서비스가 일시적으로 이용 불가합니다.',
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** 스터디 미선택 상태에서 멤버십 필수 API를 호출했을 때 발생 */
export class StudyRequiredError extends Error {
  constructor(path: string) {
    super(`스터디를 선택해주세요. (요청 경로: ${path})`);
    this.name = 'StudyRequiredError';
  }
}

// ── 멤버십 필수 경로 판별 ──

const MEMBERSHIP_REQUIRED_PREFIXES = [
  '/api/problems',
  '/api/submissions',
  '/api/reviews',
  '/api/study-notes',
  '/api/analysis',
] as const;

function requiresMembership(path: string): boolean {
  return MEMBERSHIP_REQUIRED_PREFIXES.some((prefix) => path.startsWith(prefix));
}

// ── fetch 래퍼 ──

/**
 * API 요청 래퍼 — httpOnly Cookie 인증 (credentials: 'include')
 */
export async function fetchApi<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const studyId = _currentStudyId
    ?? (typeof window !== 'undefined' ? localStorage.getItem('algosu:current-study-id') : null);
  if (studyId) {
    headers['X-Study-ID'] = studyId;
  } else if (requiresMembership(path)) {
    throw new StudyRequiredError(path);
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include',
    cache: 'no-store',
  });

  if (res.status === 204) {
    return undefined as unknown as T;
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string };

    // 403 데모 모드 쓰기 차단 — 에러 메시지 그대로 전달
    if (res.status === 403 && body.message?.includes('데모 모드')) {
      throw new ApiError(body.message, res.status);
    }

    // 401 세션 만료 시 로그인 페이지로 리다이렉트 (세션 만료 모달 표시)
    if (res.status === 401 && typeof window !== 'undefined') {
      const strippedPath = stripLocalePrefix(window.location.pathname);
      if (!strippedPath.startsWith('/login') && !strippedPath.startsWith('/callback') && strippedPath !== '/') {
        window.location.href = withLocalePrefix('/login?expired=true');
      }
    }

    throw new ApiError(body.message ?? HTTP_ERROR_MESSAGES[res.status] ?? `서버 오류 (${res.status})`, res.status);
  }

  const json = await res.json();
  // { data: ... } 래퍼 자동 언래핑 — meta가 함께 있으면 페이지네이션 응답이므로 유지
  if (json !== null && typeof json === 'object' && 'data' in json && !('meta' in json)) {
    return (json as { data: T }).data;
  }
  return json as T;
}

/** 인증 불필요 공개 API fetch */
export async function fetchPublicApi<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string };
    throw new ApiError(body.message ?? `서버 오류 (${res.status})`, res.status);
  }

  const json = await res.json();
  if (json !== null && typeof json === 'object' && 'data' in json && !('meta' in json)) {
    return (json as { data: T }).data;
  }
  return json as T;
}
