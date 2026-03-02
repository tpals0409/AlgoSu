/**
 * @file 라우트 가드 유틸리티
 * @domain common
 * @layer util
 *
 * 2단계 라우트 가드 2단계: 페이지 컴포넌트에서 호출하는 권한 검증 함수.
 * API 호출을 통해 멤버십, 역할, 마감 여부를 검증한다.
 */

import { ApiError } from '@/lib/api';

const API_BASE =
  typeof process !== 'undefined' && process.env['NEXT_PUBLIC_API_BASE_URL']
    ? process.env['NEXT_PUBLIC_API_BASE_URL']
    : 'http://localhost:3000';

/** credentials 포함 fetch (httpOnly Cookie 자동 전송) */
async function guardFetch<T>(
  path: string,
  headers?: Record<string, string>,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers,
  });
  if (!res.ok) {
    throw new ApiError(
      `Guard check failed: ${res.status}`,
      res.status,
    );
  }
  const json = await res.json();
  if (json && typeof json === 'object' && 'data' in json && !('meta' in json)) {
    return (json as { data: T }).data;
  }
  return json as T;
}

/** 스터디 멤버십 검증 (403 → false) */
export async function verifyStudyMembership(
  studyId: string,
): Promise<boolean> {
  try {
    await guardFetch(`/api/studies/${studyId}`);
    return true;
  } catch (err: unknown) {
    if (err instanceof ApiError && (err.status === 403 || err.status === 404)) {
      return false;
    }
    throw err;
  }
}

/** ADMIN 권한 검증 */
export async function verifyAdminRole(
  studyId: string,
): Promise<boolean> {
  try {
    const study = await guardFetch<{ role: string }>(
      `/api/studies/${studyId}`,
    );
    return study.role === 'ADMIN';
  } catch (err: unknown) {
    if (err instanceof ApiError && (err.status === 403 || err.status === 404)) {
      return false;
    }
    throw err;
  }
}

/** 마감 전 타인 코드 열람 차단 (A1) */
export async function verifyDeadlinePassed(
  studyId: string,
  problemId: string,
): Promise<boolean> {
  try {
    const problem = await guardFetch<{ deadline: string }>(
      `/api/problems/${problemId}`,
      { 'X-Study-ID': studyId },
    );
    return new Date(problem.deadline) <= new Date();
  } catch (err: unknown) {
    if (err instanceof ApiError && err.status === 404) {
      return false;
    }
    throw err;
  }
}
