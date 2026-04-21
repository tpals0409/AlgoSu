/**
 * @file 게스트 샘플 1 — Two Sum (브론즈, JavaScript)
 * @domain guest
 * @layer data
 * @related GuestSample, /guest/preview/two-sum
 *
 * 정적 픽스처: LLM 호출 없음. 모범 답안 + 분석문 사람이 작성.
 */

import type { GuestSample } from '../index';

// ─── OPTIMIZED CODE ──────────────────────────

const OPTIMIZED_CODE =
  'function twoSum(nums, target) {\n' +
  '  const map = new Map();\n' +
  '  for (let i = 0; i < nums.length; i++) {\n' +
  '    const complement = target - nums[i];\n' +
  '    if (map.has(complement)) {\n' +
  '      return [map.get(complement), i];\n' +
  '    }\n' +
  '    map.set(nums[i], i);\n' +
  '  }\n' +
  '  return [];\n' +
  '}';

// ─── FEEDBACK JSON ────────────────────────────

/** parseFeedback() 파싱용 AI 분석 결과 JSON 문자열 */
const FEEDBACK_JSON = JSON.stringify({
  totalScore: 92,
  summary:
    '해시맵을 활용한 O(n) 풀이로, 불필요한 중첩 반복을 제거한 효율적인 구현입니다. ' +
    'Map 자료구조로 교체하면 타입 안전성이 더욱 향상됩니다.',
  timeComplexity: 'O(n)',
  spaceComplexity: 'O(n)',
  codeLines: 8,
  optimizedCode: OPTIMIZED_CODE,
  categories: [
    {
      name: 'correctness',
      score: 95,
      comment: '모든 엣지 케이스를 올바르게 처리합니다. 항상 정확한 인덱스 쌍을 반환합니다.',
      highlights: [{ startLine: 3, endLine: 6 }],
    },
    {
      name: 'efficiency',
      score: 90,
      comment:
        'O(n) 시간복잡도와 O(n) 공간복잡도로 단일 패스 해시맵을 구축하여 최적에 가까운 성능입니다.',
      highlights: [{ startLine: 2, endLine: 7 }],
    },
    {
      name: 'readability',
      score: 92,
      comment: '변수명이 직관적이고 코드 흐름이 명확합니다. 주석을 추가하면 유지보수성이 더 높아집니다.',
      highlights: [{ startLine: 1, endLine: 1 }],
    },
    {
      name: 'bestPractice',
      score: 88,
      comment: '일반 객체 대신 Map을 사용하면 키 충돌 위험이 없고 타입 명확성이 향상됩니다.',
      highlights: [{ startLine: 2, endLine: 2 }],
    },
  ],
});

// ─── SAMPLE ──────────────────────────────────

export const TWO_SUM_SAMPLE: GuestSample = {
  id: 'two-sum',
  slug: 'two-sum',
  problem: {
    title: 'Two Sum',
    description:
      '정수 배열 nums와 정수 target이 주어질 때, 두 수의 합이 target이 되는 인덱스 쌍을 반환하세요. ' +
      '각 입력에 정확히 하나의 해가 존재하며, 동일한 원소를 두 번 사용할 수 없습니다.',
    difficulty: 'BRONZE',
    source: 'LeetCode #1',
    sourceUrl: 'https://leetcode.com/problems/two-sum/',
    tags: ['해시맵', '배열', '탐색'],
  },
  submission: {
    language: 'javascript',
    code:
      'function twoSum(nums, target) {\n' +
      '  const map = {};\n' +
      '  for (let i = 0; i < nums.length; i++) {\n' +
      '    const complement = target - nums[i];\n' +
      '    if (map[complement] !== undefined) {\n' +
      '      return [map[complement], i];\n' +
      '    }\n' +
      '    map[nums[i]] = i;\n' +
      '  }\n' +
      '  return [];\n' +
      '}',
  },
  analysis: {
    score: 92,
    feedback: FEEDBACK_JSON,
    optimizedCode: OPTIMIZED_CODE,
    analysisStatus: 'completed',
    categoryScores: { correctness: 95, efficiency: 90, readability: 92, bestPractice: 88 },
  },
};
