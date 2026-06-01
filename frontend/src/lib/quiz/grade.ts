/**
 * @file CS 퀴즈 단답형 채점 엔진 (순수 함수)
 * @domain quiz
 * @layer lib
 * @related src/data/quiz/types.ts, src/lib/quiz/storage.ts
 */

/** 정규화 시 유지할 문자: 한글·영문·숫자 외 모두 제거. */
const NON_ALNUM_KO = /[^a-z0-9가-힣]+/g;

/**
 * 채점 비교를 위해 답안 문자열을 정규화한다.
 *
 * 절차: 소문자화 → 한글/영문/숫자 외 문자를 공백으로 치환 →
 * 연속 공백 단일화 → 양끝 공백 제거 → 남은 공백 제거.
 * 결과적으로 한글·영문·숫자만 이어 붙은 비교 키를 만든다.
 *
 * @param raw 원본 답안 문자열
 * @returns 정규화된 비교 키 (한글/영문/숫자만)
 */
export function normalizeAnswer(raw: string): string {
  return raw
    .toLowerCase()
    .replace(NON_ALNUM_KO, ' ')
    .trim()
    .replace(/\s+/g, '');
}

/**
 * 사용자 입력이 인정 답안 중 하나와 정규화 후 정확히 일치하는지 판정한다.
 * 빈 입력(공백/특수문자만 포함 포함)은 항상 오답으로 처리한다.
 *
 * @param input 사용자 입력 답안
 * @param acceptedAnswers 정답으로 인정되는 답안 목록
 * @returns 정답이면 true, 아니면 false
 */
export function gradeAnswer(input: string, acceptedAnswers: readonly string[]): boolean {
  const normalizedInput = normalizeAnswer(input);
  if (normalizedInput === '') {
    return false;
  }
  return acceptedAnswers.some((answer) => normalizeAnswer(answer) === normalizedInput);
}
