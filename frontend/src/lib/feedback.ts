/**
 * @file AI 피드백 JSON 파싱 유틸리티 (공통 모듈)
 * @domain common
 * @layer lib
 * @related AnalysisPage, CodeReviewPage, SharedPage
 *
 * AI 분석 결과 JSON을 파싱하여 카테고리별 점수/코멘트/하이라이트를 추출.
 * Claude hallucination 대응 (숫자 뒤 따옴표, 추가 텍스트 등) 포함.
 */

// ─── TYPES ────────────────────────────────

/** 분석 페이지용 전체 피드백 구조 */
export interface ParsedFeedback {
  totalScore: number;
  summary: string;
  categories: FeedbackCategory[];
  optimizedCode: string | null;
  timeComplexity: string | null;
  spaceComplexity: string | null;
  codeLines: number | null;
}

/** 카테고리 항목 (분석 페이지 / 공유 페이지용) */
export interface FeedbackCategory {
  name: string;
  score: number;
  comment: string;
  highlights: { startLine: number; endLine: number }[];
}

/** 리뷰 페이지용 카테고리 (color/grade 포함) */
export interface ReviewFeedbackCategory {
  category: string;
  score: number;
  grade: string;
  color: 'success' | 'warning' | 'error';
  comment: string;
  lines: number[];
}

// ─── HELPERS ──────────────────────────────

/** score -> color 변환 */
export function scoreToColor(score: number): 'success' | 'warning' | 'error' {
  if (score >= 80) return 'success';
  if (score >= 60) return 'warning';
  return 'error';
}

/** score -> grade 변환 */
export function scoreToGrade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

/** 효율성 카테고리에서 시간/공간 복잡도 추출 */
export function extractComplexity(categories: FeedbackCategory[]): { time: string | null; space: string | null } {
  const efficiency = categories.find((c) => c.name === 'efficiency');
  if (!efficiency) return { time: null, space: null };
  const bigOPattern = /O\([^)]+\)/g;
  const matches = efficiency.comment.match(bigOPattern);
  if (matches && matches.length >= 2) return { time: matches[0], space: matches[1] };
  if (matches && matches.length === 1) return { time: matches[0], space: null };
  return { time: null, space: null };
}

/** 코드 줄 수 카운트 */
function countCodeLines(code: string | null): number | null {
  if (!code) return null;
  return code.split('\n').filter((l) => l.trim().length > 0).length;
}

/**
 * 텍스트에서 첫 번째 유효 JSON 객체의 끝 인덱스를 찾는다 (string-aware).
 *
 * 백엔드 `_extract_first_json_object` (services/ai-analysis/src/claude_client.py:497~534)
 * 의 in_string + escape 추적 로직과 1:1 매핑.
 *
 * Sprint 159 핫픽스 — 문자열 내부 중괄호(예: `"optimizedCode": "def f(): return {1,2}"`)
 * 를 카운트하지 않도록 한다. 종전 단순 brace counter 는 백엔드와 robustness 불일치.
 *
 * @param text - JSON 객체가 시작되는 텍스트
 * @param start - 첫 `{` 의 인덱스
 * @returns 매칭되는 `}` 의 인덱스 (없으면 -1)
 */
function findJsonObjectEnd(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === '\\') {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * JSON 문자열에서 Claude hallucination 대응 + 첫 유효 JSON 객체 추출
 */
function cleanAndExtractJson(raw: string): Record<string, unknown> {
  // 마크다운 코드 블록 제거
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  // Claude hallucination 대응: 숫자 뒤 불필요한 따옴표 제거
  cleaned = cleaned.replace(/:\s*(\d+)"(\s*[,}\]])/g, ': $1$2');

  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    // JSON 뒤에 추가 텍스트가 있을 수 있음 — 첫 번째 유효 JSON 객체 추출
    const start = cleaned.indexOf('{');
    if (start === -1) throw new Error('No JSON found');
    const end = findJsonObjectEnd(cleaned, start);
    if (end === -1) throw new Error('No matching brace');
    return JSON.parse(cleaned.substring(start, end + 1)) as Record<string, unknown>;
  }
}

/**
 * 분석 페이지 / 공유 페이지용 피드백 파싱
 * feedback JSON -> ParsedFeedback 구조
 */
export function parseFeedback(
  feedback: string | null,
  score: number | null,
  optimizedCode: string | null,
): ParsedFeedback | null {
  if (!feedback) return null;
  try {
    const parsed = cleanAndExtractJson(feedback);
    const rawCategories = parsed.categories as Record<string, unknown>[] | undefined;
    const categories: FeedbackCategory[] = (rawCategories ?? []).map((c) => ({
      name: (c.name as string) ?? '',
      score: (c.score as number) ?? 0,
      comment: (c.comment as string) ?? '',
      highlights: (c.highlights as { startLine: number; endLine: number }[]) ?? [],
    }));
    const complexity = extractComplexity(categories);
    const resolvedOptimizedCode = (parsed.optimizedCode as string | null) ?? optimizedCode ?? null;
    return {
      totalScore: (parsed.totalScore as number | null) ?? score ?? 0,
      summary: (parsed.summary as string) ?? '',
      categories,
      optimizedCode: resolvedOptimizedCode,
      timeComplexity: (parsed.timeComplexity as string | null) ?? complexity.time,
      spaceComplexity: (parsed.spaceComplexity as string | null) ?? complexity.space,
      codeLines: (parsed.codeLines as number | null) ?? countCodeLines(resolvedOptimizedCode),
    };
  } catch {
    // Sprint 159 핫픽스 — raw feedback 텍스트를 summary 에 노출하지 않는다.
    // 근거: dh4m 제출 사례에서 백엔드 catch-all 폴백이 raw 마크다운/JSON 을
    // feedback 으로 저장 → 본 catch 블록이 summary=raw 로 그대로 렌더링.
    // 백엔드 envelope 핫픽스와 함께 2중 방어선을 구성한다.
    return {
      totalScore: score ?? 0,
      summary: 'AI 분석 결과를 표시할 수 없습니다. 잠시 후 다시 시도해주세요.',
      categories: [],
      optimizedCode: optimizedCode ?? null,
      timeComplexity: null,
      spaceComplexity: null,
      codeLines: null,
    };
  }
}

/**
 * 리뷰 페이지용 피드백 파싱
 * feedback JSON -> ReviewFeedbackCategory[] (color/grade/lines 포함)
 */
export function parseReviewFeedback(feedbackStr: string | null): ReviewFeedbackCategory[] {
  if (!feedbackStr) return [];
  try {
    const parsed = cleanAndExtractJson(feedbackStr) as {
      categories?: Array<{
        name?: string;
        category?: string;
        score: number;
        grade?: string;
        color?: string;
        comment: string;
        lines?: number[];
        highlights?: Array<{ startLine: number; endLine: number }>;
      }>;
    };
    if (!parsed.categories) return [];
    return parsed.categories.map((cat) => {
      const lines = cat.lines ?? (cat.highlights
        ? cat.highlights.flatMap((h) => {
            const result: number[] = [];
            for (let l = h.startLine; l <= h.endLine; l++) result.push(l);
            return result;
          })
        : []);
      return {
        category: cat.category ?? cat.name ?? '',
        score: cat.score,
        grade: cat.grade ?? scoreToGrade(cat.score),
        color: (cat.color === 'success' || cat.color === 'warning' || cat.color === 'error')
          ? cat.color
          : scoreToColor(cat.score),
        comment: cat.comment,
        lines,
      };
    });
  } catch {
    return [];
  }
}
