/**
 * @file E2E 테스트 픽스처 — 프로그래머스 문제 데이터
 * @domain e2e
 * @layer fixture
 * @related tests/e2e/programmers-full-flow.spec.ts
 *
 * 외부 API 없이 사용할 수 있는 더미 데이터 정의
 * 커밋 시 실제 토큰/키 포함 금지
 */

// ─── 문제 픽스처 ───────────────────────────────────────

/** 프로그래머스 폰켓몬 (#1845) 테스트 문제 */
export const PROGRAMMERS_PHONEKEMON = {
  id: 'e2e-pgm-prob-1845',
  title: '폰켓몬',
  sourcePlatform: 'PROGRAMMERS' as const,
  sourceUrl: 'https://school.programmers.co.kr/learn/courses/30/lessons/1845',
  problemNumber: '1845',
  weekNumber: '3월1주차',
} as const;

/** BOJ 두 수의 합 (#1001) — 회귀 검증용 */
export const BOJ_TWO_SUM = {
  id: 'e2e-boj-prob-1001',
  title: '두 수의 합',
  sourcePlatform: 'BOJ' as const,
  sourceUrl: 'https://www.acmicpc.net/problem/1001',
  problemNumber: '1001',
  weekNumber: '3월1주차',
} as const;

// ─── 제출 픽스처 ───────────────────────────────────────

/** 프로그래머스 폰켓몬 Python 풀이 */
export const PROGRAMMERS_PHONEKEMON_SOLUTION = {
  language: 'python' as const,
  code: `def solution(nums):
    """폰켓몬 — 최대로 고를 수 있는 폰켓몬 종류 수"""
    return min(len(set(nums)), len(nums) // 2)`,
};

/** BOJ 두 수의 합 Python 풀이 — 회귀 검증용 */
export const BOJ_TWO_SUM_SOLUTION = {
  language: 'python' as const,
  code: `a, b = map(int, input().split())
print(a - b)`,
};

// ─── Push Input 팩토리 ────────────────────────────────

/** GitHubPushService.push() 입력 생성 헬퍼 */
export function makePushInput(
  problem: typeof PROGRAMMERS_PHONEKEMON | typeof BOJ_TWO_SUM,
  solution: typeof PROGRAMMERS_PHONEKEMON_SOLUTION | typeof BOJ_TWO_SUM_SOLUTION,
  overrides: Record<string, string | undefined> = {},
) {
  return {
    submissionId: `e2e-sub-${problem.problemNumber}-001`,
    userId: 'e2e-user-001',
    problemId: problem.id,
    language: solution.language,
    code: solution.code,
    githubUsername: 'e2e-test-user',
    /** E2E 테스트 전용 더미 토큰 — 실제 GitHub 토큰 아님 */
    githubToken: 'ghp_E2E_DUMMY_TOKEN_NOT_REAL_DO_NOT_USE',
    problemTitle: problem.title,
    weekNumber: problem.weekNumber,
    sourcePlatform: problem.sourcePlatform.toLowerCase(),
    sourceUrl: problem.sourceUrl,
    ...overrides,
  };
}

// ─── MQ 이벤트 픽스처 ─────────────────────────────────

/** AI Analysis MQ 이벤트 (sourcePlatform 포함) */
export function makeAiAnalysisEvent(
  sourcePlatform: 'PROGRAMMERS' | 'BOJ' | undefined,
) {
  return {
    submissionId: 'e2e-sub-pgm-001',
    studyId: 'e2e-study-001',
    timestamp: new Date().toISOString(),
    userId: 'e2e-user-001',
    sourcePlatform,
  };
}
