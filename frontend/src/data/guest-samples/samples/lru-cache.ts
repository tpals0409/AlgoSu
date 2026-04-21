/**
 * @file 게스트 샘플 2 — LRU Cache (골드, Python)
 * @domain guest
 * @layer data
 * @related GuestSample, /guest/preview/lru-cache
 *
 * 정적 픽스처: LLM 호출 없음. 모범 답안 + 분석문 사람이 작성.
 */

import type { GuestSample } from '../index';

// ─── OPTIMIZED CODE ──────────────────────────

const OPTIMIZED_CODE =
  'from collections import OrderedDict\n\n' +
  'class LRUCache:\n' +
  "    __slots__ = ('capacity', 'cache')\n\n" +
  '    def __init__(self, capacity: int) -> None:\n' +
  '        self.capacity = capacity\n' +
  '        self.cache: OrderedDict[int, int] = OrderedDict()\n\n' +
  '    def get(self, key: int) -> int:\n' +
  '        """키 조회 — 존재하면 최신으로 갱신 후 반환."""\n' +
  '        if key not in self.cache:\n' +
  '            return -1\n' +
  '        self.cache.move_to_end(key)\n' +
  '        return self.cache[key]\n\n' +
  '    def put(self, key: int, value: int) -> None:\n' +
  '        """키-값 삽입 — 용량 초과 시 LRU 항목 제거."""\n' +
  '        if key in self.cache:\n' +
  '            self.cache.move_to_end(key)\n' +
  '        self.cache[key] = value\n' +
  '        if len(self.cache) > self.capacity:\n' +
  '            self.cache.popitem(last=False)';

// ─── FEEDBACK JSON ────────────────────────────

/** parseFeedback() 파싱용 AI 분석 결과 JSON 문자열 */
const FEEDBACK_JSON = JSON.stringify({
  totalScore: 88,
  summary:
    'OrderedDict를 활용한 Python 표준 라이브러리 기반 구현으로 간결하고 효율적입니다. ' +
    '타입 힌트와 __slots__를 추가하면 코드 품질이 더욱 향상됩니다.',
  timeComplexity: 'O(1)',
  spaceComplexity: 'O(capacity)',
  codeLines: 14,
  optimizedCode: OPTIMIZED_CODE,
  categories: [
    {
      name: 'correctness',
      score: 90,
      comment:
        'get/put 연산이 LRU 정책을 정확히 구현합니다. 용량 초과 시 가장 오래된 항목을 올바르게 제거합니다.',
      highlights: [
        { startLine: 8, endLine: 10 },
        { startLine: 12, endLine: 16 },
      ],
    },
    {
      name: 'efficiency',
      score: 95,
      comment:
        'OrderedDict의 move_to_end와 popitem이 O(1)이므로 get/put 모두 O(1) 시간복잡도를 달성합니다.',
      highlights: [
        { startLine: 9, endLine: 9 },
        { startLine: 15, endLine: 15 },
      ],
    },
    {
      name: 'readability',
      score: 85,
      comment: '클래스 구조가 명확하지만 메서드에 docstring을 추가하면 가독성이 향상됩니다.',
      highlights: [{ startLine: 1, endLine: 5 }],
    },
    {
      name: 'bestPractice',
      score: 80,
      comment:
        'OrderedDict[int, int] 타입 힌트를 명시하고 __slots__를 사용하면 메모리 효율이 개선됩니다.',
      highlights: [{ startLine: 3, endLine: 4 }],
    },
  ],
});

// ─── SAMPLE ──────────────────────────────────

export const LRU_CACHE_SAMPLE: GuestSample = {
  id: 'lru-cache',
  slug: 'lru-cache',
  problem: {
    title: 'LRU Cache',
    description:
      'LRU(Least Recently Used) 캐시를 설계하세요. ' +
      'capacity 크기의 캐시로 get(key)과 put(key, value) 연산을 각각 O(1)에 수행해야 합니다. ' +
      '캐시 용량이 초과되면 가장 오래 사용되지 않은 항목을 제거합니다.',
    difficulty: 'GOLD',
    source: 'LeetCode #146',
    sourceUrl: 'https://leetcode.com/problems/lru-cache/',
    tags: ['해시맵', '연결 리스트', '설계'],
  },
  submission: {
    language: 'python',
    code:
      'from collections import OrderedDict\n\n' +
      'class LRUCache:\n' +
      '    def __init__(self, capacity: int):\n' +
      '        self.capacity = capacity\n' +
      '        self.cache = OrderedDict()\n\n' +
      '    def get(self, key: int) -> int:\n' +
      '        if key not in self.cache:\n' +
      '            return -1\n' +
      '        self.cache.move_to_end(key)\n' +
      '        return self.cache[key]\n\n' +
      '    def put(self, key: int, value: int) -> None:\n' +
      '        if key in self.cache:\n' +
      '            self.cache.move_to_end(key)\n' +
      '        self.cache[key] = value\n' +
      '        if len(self.cache) > self.capacity:\n' +
      '            self.cache.popitem(last=False)',
  },
  analysis: {
    score: 88,
    feedback: FEEDBACK_JSON,
    optimizedCode: OPTIMIZED_CODE,
    analysisStatus: 'completed',
    categoryScores: { correctness: 90, efficiency: 95, readability: 85, bestPractice: 80 },
  },
};
