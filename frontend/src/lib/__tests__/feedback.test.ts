/**
 * @file feedback.ts 단위 테스트
 * @domain common
 * @layer lib
 * @related AnalysisPage, CodeReviewPage, SharedPage
 *
 * Sprint 106 [A-1]: branches 커버리지 상향 목표 (BRF:125 → 목표 30%+)
 * scoreToColor / scoreToGrade / extractComplexity / parseFeedback / parseReviewFeedback
 */

import {
  scoreToColor,
  scoreToGrade,
  extractComplexity,
  parseFeedback,
  parseReviewFeedback,
} from '../feedback';
import type { FeedbackCategory } from '../feedback';

// ═══════════════════════════════════════════════════
// 1. scoreToColor
// ═══════════════════════════════════════════════════

describe('scoreToColor', () => {
  it('80 이상이면 success를 반환한다', () => {
    expect(scoreToColor(80)).toBe('success');
    expect(scoreToColor(100)).toBe('success');
  });

  it('60 이상 80 미만이면 warning을 반환한다', () => {
    expect(scoreToColor(60)).toBe('warning');
    expect(scoreToColor(79)).toBe('warning');
  });

  it('60 미만이면 error를 반환한다', () => {
    expect(scoreToColor(59)).toBe('error');
    expect(scoreToColor(0)).toBe('error');
  });
});

// ═══════════════════════════════════════════════════
// 2. scoreToGrade
// ═══════════════════════════════════════════════════

describe('scoreToGrade', () => {
  it('90 이상이면 A를 반환한다', () => {
    expect(scoreToGrade(90)).toBe('A');
    expect(scoreToGrade(100)).toBe('A');
  });

  it('80 이상 90 미만이면 B를 반환한다', () => {
    expect(scoreToGrade(80)).toBe('B');
    expect(scoreToGrade(89)).toBe('B');
  });

  it('70 이상 80 미만이면 C를 반환한다', () => {
    expect(scoreToGrade(70)).toBe('C');
    expect(scoreToGrade(79)).toBe('C');
  });

  it('60 이상 70 미만이면 D를 반환한다', () => {
    expect(scoreToGrade(60)).toBe('D');
    expect(scoreToGrade(69)).toBe('D');
  });

  it('60 미만이면 F를 반환한다', () => {
    expect(scoreToGrade(59)).toBe('F');
    expect(scoreToGrade(0)).toBe('F');
  });
});

// ═══════════════════════════════════════════════════
// 3. extractComplexity
// ═══════════════════════════════════════════════════

describe('extractComplexity', () => {
  it('efficiency 카테고리가 없으면 { time: null, space: null }을 반환한다', () => {
    const categories: FeedbackCategory[] = [
      { name: 'readability', score: 80, comment: 'Good', highlights: [] },
    ];
    expect(extractComplexity(categories)).toEqual({ time: null, space: null });
  });

  it('efficiency 카테고리에 Big-O 없으면 { time: null, space: null }을 반환한다', () => {
    const categories: FeedbackCategory[] = [
      { name: 'efficiency', score: 70, comment: '효율적인 코드입니다.', highlights: [] },
    ];
    expect(extractComplexity(categories)).toEqual({ time: null, space: null });
  });

  it('Big-O 1개이면 time만 반환하고 space는 null이다', () => {
    const categories: FeedbackCategory[] = [
      {
        name: 'efficiency',
        score: 75,
        comment: '시간 복잡도는 O(n log n)입니다.',
        highlights: [],
      },
    ];
    expect(extractComplexity(categories)).toEqual({ time: 'O(n log n)', space: null });
  });

  it('Big-O 2개 이상이면 time, space 모두 반환한다', () => {
    const categories: FeedbackCategory[] = [
      {
        name: 'efficiency',
        score: 85,
        comment: '시간 복잡도는 O(n)이고 공간 복잡도는 O(1)입니다.',
        highlights: [],
      },
    ];
    expect(extractComplexity(categories)).toEqual({ time: 'O(n)', space: 'O(1)' });
  });

  it('빈 카테고리 배열이면 { time: null, space: null }을 반환한다', () => {
    expect(extractComplexity([])).toEqual({ time: null, space: null });
  });
});

// ═══════════════════════════════════════════════════
// 4. parseFeedback
// ═══════════════════════════════════════════════════

describe('parseFeedback', () => {
  it('feedback이 null이면 null을 반환한다', () => {
    expect(parseFeedback(null, 80, null)).toBeNull();
  });

  it('feedback이 빈 문자열이면 null을 반환한다', () => {
    expect(parseFeedback('', 80, null)).toBeNull();
  });

  it('유효한 JSON 피드백을 파싱한다', () => {
    const feedback = JSON.stringify({
      totalScore: 85,
      summary: '좋은 코드입니다.',
      categories: [
        { name: 'readability', score: 90, comment: '가독성이 높습니다.', highlights: [] },
      ],
      optimizedCode: null,
      timeComplexity: 'O(n)',
      spaceComplexity: 'O(1)',
      codeLines: null,
    });
    const result = parseFeedback(feedback, null, null);
    expect(result).not.toBeNull();
    expect(result!.totalScore).toBe(85);
    expect(result!.summary).toBe('좋은 코드입니다.');
    expect(result!.categories).toHaveLength(1);
    expect(result!.timeComplexity).toBe('O(n)');
    expect(result!.spaceComplexity).toBe('O(1)');
  });

  it('파싱 실패 시 fallback 구조를 반환한다', () => {
    const result = parseFeedback('invalid json }{', 75, 'code here');
    expect(result).not.toBeNull();
    expect(result!.totalScore).toBe(75);
    expect(result!.summary).toBe('invalid json }{');
    expect(result!.categories).toHaveLength(0);
    expect(result!.optimizedCode).toBe('code here');
    expect(result!.timeComplexity).toBeNull();
    expect(result!.spaceComplexity).toBeNull();
  });

  it('totalScore 없을 때 score 파라미터를 사용한다', () => {
    const feedback = JSON.stringify({
      summary: '요약',
      categories: [],
    });
    const result = parseFeedback(feedback, 72, null);
    expect(result!.totalScore).toBe(72);
  });

  it('score도 없을 때 totalScore가 0이다', () => {
    const feedback = JSON.stringify({ summary: '요약', categories: [] });
    const result = parseFeedback(feedback, null, null);
    expect(result!.totalScore).toBe(0);
  });

  it('optimizedCode를 feedback JSON에서 우선 추출한다', () => {
    const feedback = JSON.stringify({
      totalScore: 80,
      summary: '요약',
      categories: [],
      optimizedCode: 'def solution(): pass',
    });
    const result = parseFeedback(feedback, null, 'fallback code');
    expect(result!.optimizedCode).toBe('def solution(): pass');
  });

  it('feedback에 optimizedCode 없으면 파라미터 optimizedCode를 사용한다', () => {
    const feedback = JSON.stringify({
      totalScore: 80,
      summary: '요약',
      categories: [],
    });
    const result = parseFeedback(feedback, null, 'fallback code');
    expect(result!.optimizedCode).toBe('fallback code');
  });

  it('optimizedCode 기반 codeLines를 계산한다', () => {
    const code = 'line1\nline2\n\nline4';
    const feedback = JSON.stringify({ totalScore: 80, summary: '요약', categories: [] });
    const result = parseFeedback(feedback, null, code);
    // 비어있지 않은 줄 수: line1, line2, line4 = 3
    expect(result!.codeLines).toBe(3);
  });

  it('파드백에 codeLines 명시된 경우 해당 값을 사용한다', () => {
    const feedback = JSON.stringify({
      totalScore: 80,
      summary: '요약',
      categories: [],
      codeLines: 42,
    });
    const result = parseFeedback(feedback, null, null);
    expect(result!.codeLines).toBe(42);
  });

  it('optimizedCode가 없으면 codeLines가 null이다', () => {
    const feedback = JSON.stringify({ totalScore: 80, summary: '요약', categories: [] });
    const result = parseFeedback(feedback, null, null);
    expect(result!.codeLines).toBeNull();
  });

  it('마크다운 코드 블록 래핑 JSON을 파싱한다', () => {
    const feedback = '```json\n{"totalScore":90,"summary":"마크다운","categories":[]}\n```';
    const result = parseFeedback(feedback, null, null);
    expect(result).not.toBeNull();
    expect(result!.totalScore).toBe(90);
    expect(result!.summary).toBe('마크다운');
  });

  it('Claude hallucination: 숫자 뒤 따옴표 포함 JSON을 파싱한다', () => {
    const feedback = '{"totalScore":85"  ,"summary":"할루시네이션","categories":[]}';
    const result = parseFeedback(feedback, null, null);
    expect(result).not.toBeNull();
    expect(result!.totalScore).toBe(85);
  });

  it('efficiency 카테고리 있으면 extractComplexity를 통해 복잡도를 추출한다', () => {
    const feedback = JSON.stringify({
      totalScore: 80,
      summary: '요약',
      categories: [
        {
          name: 'efficiency',
          score: 80,
          comment: '시간 복잡도 O(n), 공간 복잡도 O(1).',
          highlights: [],
        },
      ],
    });
    const result = parseFeedback(feedback, null, null);
    expect(result!.timeComplexity).toBe('O(n)');
    expect(result!.spaceComplexity).toBe('O(1)');
  });

  it('JSON 뒤에 추가 텍스트가 있어도 첫 번째 JSON 객체를 추출한다', () => {
    const feedback = '{"totalScore":77,"summary":"추가텍스트","categories":[]} extra text here';
    const result = parseFeedback(feedback, null, null);
    expect(result).not.toBeNull();
    expect(result!.totalScore).toBe(77);
  });
});

// ═══════════════════════════════════════════════════
// 5. parseReviewFeedback
// ═══════════════════════════════════════════════════

describe('parseReviewFeedback', () => {
  it('feedbackStr이 null이면 빈 배열을 반환한다', () => {
    expect(parseReviewFeedback(null)).toEqual([]);
  });

  it('feedbackStr이 빈 문자열이면 빈 배열을 반환한다', () => {
    expect(parseReviewFeedback('')).toEqual([]);
  });

  it('categories 없는 JSON이면 빈 배열을 반환한다', () => {
    const feedback = JSON.stringify({ summary: '요약' });
    expect(parseReviewFeedback(feedback)).toEqual([]);
  });

  it('파싱 실패 시 빈 배열을 반환한다', () => {
    expect(parseReviewFeedback('{ broken json')).toEqual([]);
  });

  it('유효한 카테고리 배열을 파싱한다', () => {
    const feedback = JSON.stringify({
      categories: [
        {
          category: '가독성',
          score: 85,
          grade: 'B',
          color: 'success',
          comment: '가독성이 좋습니다.',
          lines: [1, 2, 3],
        },
      ],
    });
    const result = parseReviewFeedback(feedback);
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('가독성');
    expect(result[0].score).toBe(85);
    expect(result[0].grade).toBe('B');
    expect(result[0].color).toBe('success');
    expect(result[0].lines).toEqual([1, 2, 3]);
  });

  it('grade 없으면 scoreToGrade로 계산한다', () => {
    const feedback = JSON.stringify({
      categories: [{ category: '효율성', score: 92, comment: '우수', lines: [] }],
    });
    const result = parseReviewFeedback(feedback);
    expect(result[0].grade).toBe('A');
  });

  it('color 없으면 scoreToColor로 계산한다 (success)', () => {
    const feedback = JSON.stringify({
      categories: [{ category: '코드품질', score: 80, comment: '좋음', lines: [] }],
    });
    const result = parseReviewFeedback(feedback);
    expect(result[0].color).toBe('success');
  });

  it('color 없으면 scoreToColor로 계산한다 (warning)', () => {
    const feedback = JSON.stringify({
      categories: [{ category: '코드품질', score: 65, comment: '보통', lines: [] }],
    });
    const result = parseReviewFeedback(feedback);
    expect(result[0].color).toBe('warning');
  });

  it('color 없으면 scoreToColor로 계산한다 (error)', () => {
    const feedback = JSON.stringify({
      categories: [{ category: '코드품질', score: 40, comment: '미흡', lines: [] }],
    });
    const result = parseReviewFeedback(feedback);
    expect(result[0].color).toBe('error');
  });

  it('name 필드를 category 대체로 사용한다', () => {
    const feedback = JSON.stringify({
      categories: [{ name: '가독성', score: 75, comment: '보통', lines: [] }],
    });
    const result = parseReviewFeedback(feedback);
    expect(result[0].category).toBe('가독성');
  });

  it('lines 없고 highlights 있으면 라인 번호 배열을 생성한다', () => {
    const feedback = JSON.stringify({
      categories: [
        {
          category: '스타일',
          score: 70,
          comment: '하이라이트 테스트',
          highlights: [
            { startLine: 3, endLine: 5 },
            { startLine: 8, endLine: 9 },
          ],
        },
      ],
    });
    const result = parseReviewFeedback(feedback);
    expect(result[0].lines).toEqual([3, 4, 5, 8, 9]);
  });

  it('lines도 highlights도 없으면 빈 배열이다', () => {
    const feedback = JSON.stringify({
      categories: [{ category: '스타일', score: 70, comment: '없음' }],
    });
    const result = parseReviewFeedback(feedback);
    expect(result[0].lines).toEqual([]);
  });

  it('잘못된 color 값이면 scoreToColor로 대체한다', () => {
    const feedback = JSON.stringify({
      categories: [
        { category: '품질', score: 55, color: 'unknown', comment: '미흡', lines: [] },
      ],
    });
    const result = parseReviewFeedback(feedback);
    expect(result[0].color).toBe('error');
  });

  it('복수 카테고리를 모두 파싱한다', () => {
    const feedback = JSON.stringify({
      categories: [
        { category: '가독성', score: 90, comment: 'A', lines: [] },
        { category: '효율성', score: 65, comment: 'B', lines: [] },
        { category: '정확성', score: 45, comment: 'C', lines: [] },
      ],
    });
    const result = parseReviewFeedback(feedback);
    expect(result).toHaveLength(3);
    expect(result[0].color).toBe('success');
    expect(result[1].color).toBe('warning');
    expect(result[2].color).toBe('error');
  });
});
