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
 * 절차: 유니코드 NFKC 정규화 → 소문자화 → 한글/영문/숫자 외 문자를
 * 공백으로 치환 → 연속 공백 단일화 → 양끝 공백 제거 → 남은 공백 제거.
 * 결과적으로 한글·영문·숫자만 이어 붙은 비교 키를 만든다.
 *
 * NFKC 단계는 전각(full-width) 영숫자·기호·공백(예 `ＳＱＬ`, `Ｏ（ｌｏｇ　ｎ）`)을
 * 반각으로 폴딩하고 호환·결합 문자를 정준화한다. 이를 toLowerCase보다 먼저
 * 수행해 전각 대문자가 반각 대문자를 거쳐 소문자화되도록 한다. 일반 ASCII와
 * 완성형 한글은 NFKC 영향을 받지 않으므로 기존 동작은 무회귀로 유지된다.
 *
 * @param raw 원본 답안 문자열
 * @returns 정규화된 비교 키 (한글/영문/숫자만)
 */
export function normalizeAnswer(raw: string): string {
  return raw
    .normalize('NFKC')
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
