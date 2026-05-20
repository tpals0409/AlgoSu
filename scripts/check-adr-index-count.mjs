#!/usr/bin/env node
/**
 * @file  scripts/check-adr-index-count.mjs
 * @domain  ci / docs
 * @layer  script
 * @related scripts/check-adr-en-coverage.mjs, scripts/check-doc-refs.mjs, docs/adr/README.md
 *
 * docs/adr/README.md 인덱스가 선언한 ADR 개수가 실제 파일 수와 일치하는지 점검한다.
 *
 * rebase/머지 과정에서 README의 누적 카운트(영구/토픽/sprint ADR 개수)가 실제 파일
 * 수와 어긋나는 사례(Sprint 157 #23)를 자동 차단한다. 기존에는 PR 템플릿의 수동
 * 체크리스트만 존재했으나, 본 스크립트로 CI hard gate 화한다(Sprint 176 #3).
 *
 * 카운트 기준 (README 현행 선언과 일치 — 비파괴적 드리프트 탐지기):
 *   - 영구 ADR:        docs/adr/ADR-*.md         (루트 ADR-* 접두 .md)
 *   - 토픽 ADR:        docs/adr/topics/*.md      (README.md 제외)
 *   - 회고형 sprint ADR: docs/adr/sprints/*.md    (README.md 제외, 표준/비표준 .md 전체)
 *
 * README 선언은 6곳(ASCII 트리 3 + 섹션 헤더 3)에 등장하며, 모든 선언값이 실제값과
 * 일치해야 PASS 한다. 1곳이라도 어긋나면 --strict 에서 차단한다.
 *
 * - 기본 모드: 통계만 출력하고 exit 0 (자료 수집용)
 * - --lint 모드: 불일치를 WARN으로 나열 (fail 아님)
 * - --strict 모드: 불일치가 1건이라도 있으면 exit 1 (CI hard gate 용)
 *
 * exit
 *   0: 점검 완료 (--strict 외에는 항상 0)
 *   1: --strict 모드에서 불일치 발견
 *   2: I/O 오류 / 디렉토리·README 없음 / 잘못된 옵션
 *
 * 사용법
 *   node scripts/check-adr-index-count.mjs            # 통계만
 *   node scripts/check-adr-index-count.mjs --lint     # WARN 출력
 *   node scripts/check-adr-index-count.mjs --strict   # 불일치 시 fail
 */
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(import.meta.dirname, '..');
const ADR_ROOT = resolve(ROOT, 'docs', 'adr');
const README_PATH = join(ADR_ROOT, 'README.md');

/** 카테고리 키 → README 표기 라벨 (출력·파싱 공용). */
const CATEGORY_LABELS = {
  permanent: '영구 ADR',
  topic: '토픽 ADR',
  sprint: '회고형 sprint ADR',
};

/** 직접 실행 여부 (entry point guard) */
const __selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] === __selfPath) {
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

  if (!existsSync(ADR_ROOT)) {
    console.error(`[FAIL] ADR 디렉토리 없음: ${relative(ROOT, ADR_ROOT)}`);
    process.exit(2);
  }
  if (!existsSync(README_PATH)) {
    console.error(`[FAIL] ADR 인덱스 없음: ${relative(ROOT, README_PATH)}`);
    process.exit(2);
  }

  const actual = countActualAdrs(ADR_ROOT);
  const declared = parseDeclaredCounts(readFileSync(README_PATH, 'utf-8'));
  const mismatches = diffCounts(actual, declared);

  console.log(
    `[INFO] ADR 인덱스 카운트: 영구 ${actual.permanent} / 토픽 ${actual.topic} / sprint ${actual.sprint} (실제 파일 수)`,
  );

  if (args.lint || args.strict) {
    if (mismatches.length === 0) {
      console.log('[OK]   README 선언 카운트가 실제 파일 수와 모두 일치합니다.');
      process.exit(0);
    }

    const level = args.strict ? 'FAIL' : 'WARN';
    console.log(`[${level}] ${mismatches.length}건 카운트 불일치:`);
    for (const m of mismatches) {
      const label = CATEGORY_LABELS[m.category];
      if (m.kind === 'missing') {
        console.log(
          `       - ${label}: README에 "(N개)" 선언이 없음 (실제 ${m.actual}개)`,
        );
      } else {
        console.log(
          `       - ${label}: README 선언 ${m.declared}개 ≠ 실제 ${m.actual}개`,
        );
      }
    }

    if (args.strict) {
      console.error('[FAIL] --strict 모드에서 카운트 불일치 → exit 1');
      console.error(
        `[INFO] docs/adr/README.md 의 "(N개)" 표기를 실제 파일 수로 보정하세요.`,
      );
      process.exit(1);
    }

    console.log(
      `[INFO] docs/adr/README.md 의 "(N개)" 표기를 실제 파일 수로 보정하세요.`,
    );
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
 * @returns {{lint:boolean, strict:boolean}}
 */
export function parseArgs(argv) {
  const result = { lint: false, strict: false };
  for (const token of argv) {
    if (token === '--lint') result.lint = true;
    else if (token === '--strict') result.strict = true;
    else if (token === '--help' || token === '-h') {
      console.log(
        '사용법: node scripts/check-adr-index-count.mjs [--lint] [--strict]',
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
// Actual file counting
// ──────────────────────────────────────────────────────────────────

/**
 * ADR 루트에서 카테고리별 실제 파일 수를 센다.
 *
 * @param {string} adrRoot  docs/adr 절대 경로
 * @returns {{permanent:number, topic:number, sprint:number}}
 */
export function countActualAdrs(adrRoot) {
  const permanent = readdirSync(adrRoot).filter((n) =>
    /^ADR-.*\.md$/.test(n),
  ).length;
  return {
    permanent,
    topic: countMarkdown(join(adrRoot, 'topics')),
    sprint: countMarkdown(join(adrRoot, 'sprints')),
  };
}

/**
 * 디렉토리 직속의 .md 파일 수를 센다 (README.md 제외).
 *
 * @param {string} dir
 * @returns {number}
 */
function countMarkdown(dir) {
  if (!existsSync(dir)) return 0;
  return readdirSync(dir).filter((n) => n.endsWith('.md') && n !== 'README.md')
    .length;
}

// ──────────────────────────────────────────────────────────────────
// README declared-count parsing
// ──────────────────────────────────────────────────────────────────

/**
 * README 본문에서 카테고리별 선언 카운트(모든 등장 위치)를 추출한다.
 * sprint 표기는 "(114개, Sprint 62~175)" 처럼 trailing 텍스트가 붙을 수 있어
 * 닫는 괄호를 요구하지 않는다.
 *
 * @param {string} readmeText
 * @returns {{permanent:number[], topic:number[], sprint:number[]}}
 */
export function parseDeclaredCounts(readmeText) {
  const grab = (re) => [...readmeText.matchAll(re)].map((m) => Number(m[1]));
  return {
    permanent: grab(/영구 ADR \((\d+)개\)/g),
    topic: grab(/토픽 ADR \((\d+)개\)/g),
    sprint: grab(/회고형 sprint ADR \((\d+)개/g),
  };
}

// ──────────────────────────────────────────────────────────────────
// Diff
// ──────────────────────────────────────────────────────────────────

/**
 * 실제 카운트와 선언 카운트를 비교해 불일치 목록을 만든다.
 * 카테고리별 선언이 하나도 없으면 missing, 선언값 중 실제와 다른 것이 있으면 mismatch.
 *
 * @param {{permanent:number, topic:number, sprint:number}} actual
 * @param {{permanent:number[], topic:number[], sprint:number[]}} declared
 * @returns {Array<{category:string, kind:'missing'|'mismatch', declared?:number, actual:number}>}
 */
export function diffCounts(actual, declared) {
  const mismatches = [];
  for (const category of Object.keys(CATEGORY_LABELS)) {
    const decls = declared[category];
    if (!decls || decls.length === 0) {
      mismatches.push({ category, kind: 'missing', actual: actual[category] });
      continue;
    }
    for (const d of decls) {
      if (d !== actual[category]) {
        mismatches.push({
          category,
          kind: 'mismatch',
          declared: d,
          actual: actual[category],
        });
      }
    }
  }
  return mismatches;
}
