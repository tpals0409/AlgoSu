/**
 * @file 게스트 샘플 3 — 부서별 급여 순위 (실버, SQL)
 * @domain guest
 * @layer data
 * @related GuestSample, /guest/preview/sql-window
 *
 * Sprint 108~109 SQL 학습 경로 노출용 정적 픽스처.
 */

import type { GuestSample } from '../index';

// ─── OPTIMIZED CODE ──────────────────────────

const OPTIMIZED_CODE =
  'WITH ranked AS (\n' +
  '  SELECT\n' +
  '    employee_id,\n' +
  '    department,\n' +
  '    salary,\n' +
  '    RANK() OVER (\n' +
  '      PARTITION BY department\n' +
  '      ORDER BY salary DESC\n' +
  '    ) AS dept_rank,\n' +
  '    ROUND(\n' +
  '      AVG(salary) OVER (PARTITION BY department),\n' +
  '      2\n' +
  '    ) AS dept_avg_salary\n' +
  '  FROM employees\n' +
  ')\n' +
  'SELECT *\n' +
  'FROM ranked\n' +
  'ORDER BY department, dept_rank;';

// ─── FEEDBACK JSON ────────────────────────────

/** parseFeedback() 파싱용 AI 분석 결과 JSON 문자열 */
const FEEDBACK_JSON = JSON.stringify({
  totalScore: 85,
  summary:
    '윈도우 함수를 활용한 부서별 급여 집계 쿼리로 기본 구조가 올바릅니다. ' +
    'CTE로 리팩터링하면 가독성과 재사용성이 크게 향상됩니다.',
  timeComplexity: 'O(n log n)',
  spaceComplexity: 'O(n)',
  codeLines: 10,
  optimizedCode: OPTIMIZED_CODE,
  categories: [
    {
      name: 'correctness',
      score: 88,
      comment: 'PARTITION BY와 ORDER BY를 올바르게 사용하여 부서별 정확한 순위를 산출합니다.',
      highlights: [{ startLine: 4, endLine: 7 }],
    },
    {
      name: 'efficiency',
      score: 82,
      comment:
        '윈도우 함수는 GROUP BY 대비 원본 행과 집계를 함께 반환하므로 적절한 선택입니다. ' +
        'department, salary 복합 인덱스 추가를 권장합니다.',
      highlights: [{ startLine: 3, endLine: 8 }],
    },
    {
      name: 'readability',
      score: 88,
      comment: '컬럼명과 별칭이 명확하고 들여쓰기가 일관적입니다. CTE로 감싸면 재사용성이 높아집니다.',
      highlights: [{ startLine: 1, endLine: 10 }],
    },
    {
      name: 'bestPractice',
      score: 80,
      comment:
        'WITH(CTE)를 사용하면 서브쿼리를 이름으로 참조할 수 있어 복잡한 분석 쿼리의 유지보수성이 향상됩니다.',
      highlights: [{ startLine: 1, endLine: 2 }],
    },
  ],
});

// ─── SAMPLE ──────────────────────────────────

export const SQL_WINDOW_SAMPLE: GuestSample = {
  id: 'sql-window',
  slug: 'sql-window',
  problem: {
    title: '부서별 급여 순위',
    description:
      'employees 테이블에서 각 부서 내 직원들의 급여 순위(RANK)와 부서 평균 급여를 함께 조회하세요. ' +
      '결과는 부서별, 순위순으로 정렬되어야 합니다. ' +
      '테이블 컬럼: employee_id, department, salary, hire_date',
    difficulty: 'SILVER',
    source: 'Programmers SQL',
    sourceUrl: 'https://school.programmers.co.kr/learn/courses/30/parts/17042',
    tags: ['윈도우 함수', 'RANK', 'PARTITION BY'],
  },
  submission: {
    language: 'sql',
    code:
      'SELECT\n' +
      '  employee_id,\n' +
      '  department,\n' +
      '  salary,\n' +
      '  RANK() OVER (\n' +
      '    PARTITION BY department\n' +
      '    ORDER BY salary DESC\n' +
      '  ) AS dept_rank,\n' +
      '  AVG(salary) OVER (PARTITION BY department) AS dept_avg\n' +
      'FROM employees\n' +
      'ORDER BY department, dept_rank;',
  },
  analysis: {
    score: 85,
    feedback: FEEDBACK_JSON,
    optimizedCode: OPTIMIZED_CODE,
    analysisStatus: 'completed',
    categoryScores: { correctness: 88, efficiency: 82, readability: 88, bestPractice: 80 },
  },
};
