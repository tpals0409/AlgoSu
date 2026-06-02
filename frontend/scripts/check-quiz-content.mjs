#!/usr/bin/env node
/**
 * @file  frontend/scripts/check-quiz-content.mjs
 * @domain  ci / quiz
 * @layer  script
 * @related frontend/src/data/quiz/types.ts, frontend/src/data/quiz/index.ts
 *
 * CS 퀴즈 문항 은행(frontend/src/data/quiz/*.ts)의 콘텐츠 품질을 점검한다.
 *
 * 문항 데이터는 TypeScript 소스라 .mjs 에서 직접 import 할 수 없으므로
 * (tsx/ts-node 미보장), 각 분야 .ts 파일을 텍스트로 읽어 객체 리터럴을
 * 파싱한 뒤 다음 7가지 무결성 규칙을 검사한다.
 *
 *   1. 중복 id            — 전체 문항에서 id 유일성
 *   2. id 네이밍          — `{prefix}-{NN}` (2자리 숫자, prefix ∈ ds/algo/net/os/db)
 *   3. acceptedAnswers    — 최소 1개 이상 (빈/누락 금지)
 *   4. ko/en 텍스트       — prompt.ko, prompt.en, explanation.ko, explanation.en 모두 비어있지 않음
 *   5. category enum 정합 — QuizCategory 5개 값 중 하나
 *   6. difficulty 허용값  — EASY / MEDIUM / HARD 중 하나
 *   7. 분야별 최소 문항 수 — 각 분야 최소 MIN_PER_CATEGORY(30)개
 *
 * - 기본(비-strict) 모드: 위반을 WARN으로 나열하되 exit 0 (자료 수집/로컬 점검용)
 * - --strict 모드: 위반이 1건이라도 있으면 exit 1 (CI hard gate 용)
 *
 * exit
 *   0: 점검 완료 (--strict 외에는 항상 0 / strict 에서 위반 없음)
 *   1: --strict 모드에서 위반 발견
 *   2: I/O 오류 / 디렉토리·파일 없음 / 잘못된 옵션
 *
 * 사용법
 *   node frontend/scripts/check-quiz-content.mjs            # WARN 출력, exit 0
 *   node frontend/scripts/check-quiz-content.mjs --strict   # 위반 시 fail
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(import.meta.url);
const ROOT = resolve(HERE, '..', '..'); // frontend/
const QUIZ_DIR = resolve(ROOT, 'src', 'data', 'quiz');

/** 분야별 최소 문항 수 게이트. */
const MIN_PER_CATEGORY = 30;

/** 허용 난이도 값. */
const ALLOWED_DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'];

/**
 * 단일('...') 또는 이중("...") 따옴표 문자열 리터럴 1개를 매칭하는 정규식 소스.
 * 이스케이프 시퀀스(\')를 허용하며, 내용은 캡처 그룹 1(작은따옴표) 또는 2(큰따옴표)에 담긴다.
 * (en 텍스트가 아포스트로피를 포함해 이중따옴표로 작성되는 경우 — 예: "Dijkstra's" — 를 흡수)
 */
const STRING_LITERAL = `(?:'((?:[^'\\\\]|\\\\.)*)'|"((?:[^"\\\\]|\\\\.)*)")`;

/** 허용 카테고리(QuizCategory enum 값) — types.ts SSOT 와 동기. */
const ALLOWED_CATEGORIES = [
  'DATA_STRUCTURE',
  'ALGORITHM',
  'NETWORK',
  'OS',
  'DATABASE',
];

/**
 * 분야 정의 — 파일명, 기대 카테고리, id 접두사.
 * id 접두사는 `{prefix}-{NN}` 네이밍 규칙(규칙 2) 검증에 쓰인다.
 */
const CATEGORY_FILES = [
  { file: 'data-structure.ts', category: 'DATA_STRUCTURE', idPrefix: 'ds' },
  { file: 'algorithm.ts', category: 'ALGORITHM', idPrefix: 'algo' },
  { file: 'network.ts', category: 'NETWORK', idPrefix: 'net' },
  { file: 'os.ts', category: 'OS', idPrefix: 'os' },
  { file: 'database.ts', category: 'DATABASE', idPrefix: 'db' },
];

/** 직접 실행 여부 (entry point guard) */
if (process.argv[1] === HERE) {
  runMain();
}

// ──────────────────────────────────────────────────────────────────
// CLI entry point
// ──────────────────────────────────────────────────────────────────

/**
 * 인자를 해석하고 점검을 실행한다.
 */
function runMain() {
  const args = parseArgs(process.argv.slice(2));

  if (!existsSync(QUIZ_DIR)) {
    console.error(`[FAIL] 퀴즈 데이터 디렉토리 없음: ${relative(ROOT, QUIZ_DIR)}`);
    process.exit(2);
  }

  const { questions, violations } = collectQuestions(CATEGORY_FILES, QUIZ_DIR);
  violations.push(...validateQuestions(questions, CATEGORY_FILES));

  printSummary(questions, CATEGORY_FILES);

  if (violations.length === 0) {
    console.log('[OK]   모든 퀴즈 문항이 콘텐츠 품질 규칙을 통과했습니다.');
    process.exit(0);
  }

  const level = args.strict ? 'FAIL' : 'WARN';
  console.log(`[${level}] ${violations.length}건 콘텐츠 품질 위반:`);
  for (const v of violations) {
    console.log(`       - ${v}`);
  }

  if (args.strict) {
    console.error('[FAIL] --strict 모드에서 위반 발견 → exit 1');
    process.exit(1);
  }

  process.exit(0);
}

// ──────────────────────────────────────────────────────────────────
// CLI argument parsing
// ──────────────────────────────────────────────────────────────────

/**
 * argv에서 CLI 옵션을 파싱한다.
 *
 * @param {string[]} argv
 * @returns {{strict:boolean}}
 */
export function parseArgs(argv) {
  const result = { strict: false };
  for (const token of argv) {
    if (token === '--strict') result.strict = true;
    else if (token === '--help' || token === '-h') {
      console.log(
        '사용법: node frontend/scripts/check-quiz-content.mjs [--strict]',
      );
      process.exit(0);
    } else {
      console.error(`[FAIL] 알 수 없는 옵션: ${token}`);
      process.exit(2);
    }
  }
  return result;
}

// ──────────────────────────────────────────────────────────────────
// Parsing — TypeScript 소스 텍스트에서 문항 객체 추출
// ──────────────────────────────────────────────────────────────────

/**
 * 분야 파일 목록을 읽어 모든 문항을 파싱한다.
 * 파일 부재/파싱 실패는 violation 으로 누적한다(throw 하지 않음).
 *
 * @param {Array<{file:string, category:string, idPrefix:string}>} categoryFiles
 * @param {string} quizDir  frontend/src/data/quiz 절대 경로
 * @returns {{questions:Array<object>, violations:string[]}}
 */
export function collectQuestions(categoryFiles, quizDir) {
  const questions = [];
  const violations = [];
  for (const { file } of categoryFiles) {
    const abs = resolve(quizDir, file);
    if (!existsSync(abs)) {
      violations.push(`${file}: 분야 데이터 파일이 존재하지 않습니다`);
      continue;
    }
    const raw = readFileSync(abs, 'utf-8');
    for (const q of parseQuestions(raw)) {
      questions.push({ ...q, file });
    }
  }
  return { questions, violations };
}

/**
 * 단일 .ts 소스 텍스트에서 문항 객체들을 파싱한다.
 * `id: '...'` 위치를 기준으로 각 문항 블록을 잘라, 필요한 필드를 정규식으로 추출한다.
 *
 * @param {string} raw  .ts 파일 원문
 * @returns {Array<{id:string, category:string|null, difficulty:string|null,
 *   acceptedAnswers:string[], promptKo:string|null, promptEn:string|null,
 *   explanationKo:string|null, explanationEn:string|null}>}
 */
export function parseQuestions(raw) {
  const idRe = /\bid:\s*'([^']*)'/g;
  const starts = [];
  let m;
  while ((m = idRe.exec(raw)) !== null) {
    starts.push({ id: m[1], index: m.index });
  }
  return starts.map((cur, i) => {
    const block = raw.slice(cur.index, starts[i + 1]?.index ?? raw.length);
    return {
      id: cur.id,
      category: matchCategory(block),
      difficulty: matchField(block, 'difficulty'),
      acceptedAnswers: matchAcceptedAnswers(block),
      promptKo: matchNested(block, 'prompt', 'ko'),
      promptEn: matchNested(block, 'prompt', 'en'),
      explanationKo: matchNested(block, 'explanation', 'ko'),
      explanationEn: matchNested(block, 'explanation', 'en'),
    };
  });
}

/**
 * `category: QuizCategory.XXX` 에서 enum 멤버명을 추출한다.
 *
 * @param {string} block
 * @returns {string|null}
 */
function matchCategory(block) {
  const m = block.match(/category:\s*QuizCategory\.([A-Z_]+)/);
  return m ? m[1] : null;
}

/**
 * `field: '값'` 또는 `field: "값"` 형태의 단순 문자열 필드를 추출한다.
 *
 * @param {string} block
 * @param {string} field
 * @returns {string|null}
 */
function matchField(block, field) {
  const m = block.match(new RegExp(`\\b${field}:\\s*${STRING_LITERAL}`));
  return m ? m[1] ?? m[2] : null;
}

/**
 * `parent: { ... key: '값' ... }` 형태의 중첩 문자열 필드를 추출한다.
 *
 * @param {string} block
 * @param {string} parent  부모 객체 키 (prompt | explanation)
 * @param {string} key     추출할 하위 키 (ko | en)
 * @returns {string|null}  미발견 시 null
 */
function matchNested(block, parent, key) {
  const parentRe = new RegExp(`${parent}:\\s*\\{([\\s\\S]*?)\\}`);
  const pm = block.match(parentRe);
  if (!pm) return null;
  const km = pm[1].match(new RegExp(`\\b${key}:\\s*${STRING_LITERAL}`));
  return km ? km[1] ?? km[2] : null;
}

/**
 * `acceptedAnswers: [...]` 배열의 문자열 항목들을 추출한다.
 *
 * @param {string} block
 * @returns {string[]}  배열 키가 없으면 빈 배열
 */
function matchAcceptedAnswers(block) {
  const m = block.match(/acceptedAnswers:\s*\[([\s\S]*?)\]/);
  if (!m) return [];
  const itemRe = new RegExp(STRING_LITERAL, 'g');
  return [...m[1].matchAll(itemRe)].map((x) => x[1] ?? x[2]);
}

// ──────────────────────────────────────────────────────────────────
// Validation
// ──────────────────────────────────────────────────────────────────

/**
 * 파싱된 문항 전체에 7가지 콘텐츠 품질 규칙을 적용해 위반 메시지를 모은다.
 *
 * @param {Array<object>} questions  collectQuestions 결과 문항 배열
 * @param {Array<{file:string, category:string, idPrefix:string}>} categoryFiles
 * @returns {string[]}  위반 메시지 목록 (빈 배열이면 통과)
 */
export function validateQuestions(questions, categoryFiles) {
  const violations = [];
  violations.push(...checkPerQuestion(questions, categoryFiles));
  violations.push(...checkDuplicateIds(questions));
  violations.push(...checkMinPerCategory(questions, categoryFiles));
  return violations;
}

/**
 * 문항 단위 규칙(2~6: id 네이밍, acceptedAnswers, ko/en, category, difficulty)을 검사한다.
 *
 * @param {Array<object>} questions
 * @param {Array<{file:string, category:string, idPrefix:string}>} categoryFiles
 * @returns {string[]}
 */
function checkPerQuestion(questions, categoryFiles) {
  const prefixByFile = new Map(categoryFiles.map((c) => [c.file, c.idPrefix]));
  const violations = [];
  for (const q of questions) {
    const where = `${q.file} (id: ${q.id || '<missing>'})`;

    // 규칙 2 — id 네이밍 {prefix}-{NN}
    const prefix = prefixByFile.get(q.file);
    if (prefix && !new RegExp(`^${prefix}-\\d{2}$`).test(q.id)) {
      violations.push(`${where}: id 네이밍 위반 — '${prefix}-NN'(2자리) 패턴이어야 함`);
    }

    // 규칙 3 — acceptedAnswers 최소 1개
    if (q.acceptedAnswers.length === 0 || q.acceptedAnswers.every(isBlank)) {
      violations.push(`${where}: acceptedAnswers 가 비어있음 (최소 1개 필요)`);
    }

    // 규칙 4 — ko/en 텍스트 누락
    for (const [field, value] of [
      ['prompt.ko', q.promptKo],
      ['prompt.en', q.promptEn],
      ['explanation.ko', q.explanationKo],
      ['explanation.en', q.explanationEn],
    ]) {
      if (isBlank(value)) {
        violations.push(`${where}: ${field} 텍스트 누락 또는 빈 문자열`);
      }
    }

    // 규칙 5 — category enum 정합
    if (!ALLOWED_CATEGORIES.includes(q.category)) {
      violations.push(
        `${where}: category 부정합 — '${q.category}' (허용: ${ALLOWED_CATEGORIES.join('/')})`,
      );
    }

    // 규칙 6 — difficulty 허용값
    if (!ALLOWED_DIFFICULTIES.includes(q.difficulty)) {
      violations.push(
        `${where}: difficulty 부정합 — '${q.difficulty}' (허용: ${ALLOWED_DIFFICULTIES.join('/')})`,
      );
    }
  }
  return violations;
}

/**
 * 규칙 1 — 전체 문항에서 중복 id를 검출한다.
 *
 * @param {Array<object>} questions
 * @returns {string[]}
 */
function checkDuplicateIds(questions) {
  const seen = new Map();
  for (const q of questions) {
    seen.set(q.id, (seen.get(q.id) ?? 0) + 1);
  }
  return [...seen.entries()]
    .filter(([, count]) => count > 1)
    .map(([id, count]) => `중복 id 발견 — '${id}' 가 ${count}회 등장`);
}

/**
 * 규칙 7 — 분야별 최소 문항 수(MIN_PER_CATEGORY)를 만족하는지 검사한다.
 *
 * @param {Array<object>} questions
 * @param {Array<{file:string, category:string, idPrefix:string}>} categoryFiles
 * @returns {string[]}
 */
function checkMinPerCategory(questions, categoryFiles) {
  const violations = [];
  for (const { category } of categoryFiles) {
    const count = questions.filter((q) => q.category === category).length;
    if (count < MIN_PER_CATEGORY) {
      violations.push(
        `${category}: 문항 수 부족 — ${count}개 (최소 ${MIN_PER_CATEGORY}개 필요)`,
      );
    }
  }
  return violations;
}

/**
 * 값이 비어있는지(null/공백 전용) 판정한다.
 *
 * @param {string|null|undefined} value
 * @returns {boolean}
 */
function isBlank(value) {
  return value == null || value.trim().length === 0;
}

// ──────────────────────────────────────────────────────────────────
// Output
// ──────────────────────────────────────────────────────────────────

/**
 * 분야별 카운트와 총계 요약을 출력한다.
 *
 * @param {Array<object>} questions
 * @param {Array<{file:string, category:string, idPrefix:string}>} categoryFiles
 */
function printSummary(questions, categoryFiles) {
  const parts = categoryFiles.map(({ category }) => {
    const count = questions.filter((q) => q.category === category).length;
    return `${category} ${count}`;
  });
  console.log(
    `[INFO] 퀴즈 문항 은행 점검: 총 ${questions.length}문항 — ${parts.join(' / ')} (분야별 최소 ${MIN_PER_CATEGORY})`,
  );
}
