/**
 * @file CS 퀴즈 미니게임 도메인 타입 정의 (SSOT)
 * @domain quiz
 * @layer data
 * @related src/data/quiz/index.ts, src/lib/quiz/grade.ts, src/lib/quiz/storage.ts
 */

/**
 * 퀴즈 문항이 속하는 CS 분야 카테고리.
 * 값은 UPPER_SNAKE_CASE 상수로 저장·전송된다.
 */
export enum QuizCategory {
  DATA_STRUCTURE = 'DATA_STRUCTURE',
  ALGORITHM = 'ALGORITHM',
  NETWORK = 'NETWORK',
  OS = 'OS',
  DATABASE = 'DATABASE',
}

/** 문항 난이도 — EASY/MEDIUM/HARD 3단계. */
export type QuizDifficulty = 'EASY' | 'MEDIUM' | 'HARD';

/** 한국어·영어 양방향 로컬라이즈 텍스트. */
export interface LocalizedText {
  /** 한국어 텍스트 */
  readonly ko: string;
  /** 영어 텍스트 */
  readonly en: string;
}

/**
 * 단답형 CS 퀴즈 문항.
 * `acceptedAnswers`는 정답 키워드와 그 동의어/대소문자 변형을 모두 포함한다.
 */
export interface QuizQuestion {
  /** 고유 식별자 (예: `ds-01`, `algo-01`) */
  readonly id: string;
  /** 문항 분야 */
  readonly category: QuizCategory;
  /** 질문 문구 (ko/en) */
  readonly prompt: LocalizedText;
  /** 정답으로 인정되는 답안 목록 (키워드 + 동의어 + 변형) */
  readonly acceptedAnswers: readonly string[];
  /** 해설 (ko/en) */
  readonly explanation: LocalizedText;
  /** 난이도 */
  readonly difficulty: QuizDifficulty;
}
