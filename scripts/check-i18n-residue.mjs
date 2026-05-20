#!/usr/bin/env node
/**
 * @file  scripts/check-i18n-residue.mjs
 * @domain  ci / docs
 * @layer  script
 * @related scripts/check-adr-en-coverage.mjs, scripts/translate-adr.mjs, docs/adr-en/README.md
 *
 * docs/adr-en/ 영문판 ADR에 번역되지 않은 한국어(Hangul) 잔재가 남아있는지 점검한다.
 *
 * en-coverage 가 "영문판 파일 존재"(i18n 계층 2)를 보장한다면, 본 스크립트는
 * "그 영문판이 실제로 번역되었는가"(i18n 계층 3 — 번역 품질)를 게이트한다.
 * blog SSG 의 /en 페이지 ADR 본문은 docs/adr-en/ 를 그대로 렌더링하므로
 * (blog/src/lib/adr/loader.ts readLocalized), 소스에서 한국어 잔재를 차단하면
 * 빌드 산출물(out/en/**)의 한국어 잔재도 shift-left 로 차단된다.
 *
 * 측정 방식: 코드펜스(```...```)와 인라인 코드(`...`)를 제거한 prose 영역에서만
 * Hangul 비율을 센다. 코드/로그/커밋 메시지에 한국어가 들어가는 것은 정당하므로 제외한다.
 * 고유명사 등 산발적 한국어를 허용하기 위해 비율 임계값(기본 8%)과 절대 하한(10자)을
 * 동시에 만족할 때만 위반으로 본다.
 *
 * - 기본 모드: 통계만 출력하고 exit 0 (자료 수집용)
 * - --lint 모드: 임계 초과 파일을 WARN으로 나열 (fail 아님)
 * - --strict 모드: 임계 초과가 1건이라도 있으면 exit 1 (CI hard gate 용)
 * - --max-ratio=N: 비율 임계값 override (0~1, 기본 0.08)
 *
 * exit
 *   0: 점검 완료 (--strict 외에는 항상 0)
 *   1: --strict 모드에서 잔재 발견
 *   2: I/O 오류 / 디렉토리 없음 / 잘못된 옵션
 *
 * 사용법
 *   node scripts/check-i18n-residue.mjs                    # 통계만
 *   node scripts/check-i18n-residue.mjs --lint             # WARN 출력
 *   node scripts/check-i18n-residue.mjs --strict           # 임계 초과 시 fail
 *   node scripts/check-i18n-residue.mjs --strict --max-ratio=0.1
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectAdrFiles } from './check-adr-en-coverage.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const EN_BASE = resolve(ROOT, 'docs', 'adr-en');

/** 비율 임계값 기본값 (prose 중 Hangul 비율). 현재 EN 코퍼스 최대치 약 2.2% 대비 안전 여유. */
const DEFAULT_MAX_RATIO = 0.08;

/** 절대 하한 — 짧은 문서의 산발적 한국어를 위반으로 오판하지 않도록 최소 Hangul 글자 수. */
const MIN_HANGUL = 10;

/** 코드펜스 (```...```) — 한국어 로그/커밋 예시가 정당하게 들어갈 수 있어 제외 대상. */
const CODE_FENCE_RE = /```[\s\S]*?```/g;

/** 인라인 코드 (`...`) — 식별자/명령 인용으로 제외 대상. */
const INLINE_CODE_RE = /`[^`]*`/g;

/** Hangul 음절 블록. */
const HANGUL_RE = /[가-힣]/g;

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

  if (!existsSync(EN_BASE)) {
    console.error(`[FAIL] EN ADR 디렉토리 없음: ${relative(ROOT, EN_BASE)}`);
    process.exit(2);
  }

  const files = collectAdrFiles(EN_BASE);
  const stats = files
    .map((abs) => ({ rel: relative(EN_BASE, abs), ...measureFile(abs) }))
    .sort((a, b) => b.ratio - a.ratio);

  const violations = stats.filter((s) => isViolation(s, args.maxRatio));
  const top = stats[0];
  const topPct = top ? (top.ratio * 100).toFixed(2) : '0.00';

  console.log(
    `[INFO] EN ADR i18n 잔재 점검: ${files.length}개 파일, 최대 prose Hangul 비율 ${topPct}% (임계 ${(args.maxRatio * 100).toFixed(1)}%)`,
  );

  if (args.lint || args.strict) {
    if (violations.length === 0) {
      console.log('[OK]   임계값을 초과하는 한국어 잔재가 없습니다.');
      process.exit(0);
    }

    const level = args.strict ? 'FAIL' : 'WARN';
    console.log(`[${level}] ${violations.length}건 한국어 잔재 임계 초과:`);
    for (const v of violations) {
      console.log(
        `       - docs/adr-en/${v.rel}  (Hangul ${v.hangul}자 / prose ${v.nonws}자 = ${(v.ratio * 100).toFixed(2)}%)`,
      );
    }

    if (args.strict) {
      console.error('[FAIL] --strict 모드에서 잔재 발견 → exit 1');
      console.error(
        '[INFO] 재번역: `node scripts/translate-adr.mjs --target docs/adr/<path> --force` (ANTHROPIC_API_KEY 필요)',
      );
      process.exit(1);
    }

    console.log(
      '[INFO] 재번역: `node scripts/translate-adr.mjs --target docs/adr/<path> --force` (ANTHROPIC_API_KEY 필요)',
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
 * @returns {{lint:boolean, strict:boolean, maxRatio:number}}
 */
export function parseArgs(argv) {
  const result = { lint: false, strict: false, maxRatio: DEFAULT_MAX_RATIO };
  for (const token of argv) {
    if (token === '--lint') result.lint = true;
    else if (token === '--strict') result.strict = true;
    else if (token === '--help' || token === '-h') {
      console.log(
        '사용법: node scripts/check-i18n-residue.mjs [--lint] [--strict] [--max-ratio=N]',
      );
      process.exit(0);
    } else if (token.startsWith('--max-ratio=')) {
      const raw = Number(token.slice('--max-ratio='.length));
      if (!Number.isFinite(raw) || raw <= 0 || raw > 1) {
        console.error(`[FAIL] --max-ratio 는 0~1 사이여야 합니다: ${token}`);
        process.exit(2);
      }
      result.maxRatio = raw;
    } else {
      console.error(`[FAIL] 알 수 없는 옵션: ${token}`);
      process.exit(2);
    }
  }
  return result;
}

// ──────────────────────────────────────────────────────────────────
// Measurement
// ──────────────────────────────────────────────────────────────────

/**
 * 파일을 읽어 prose Hangul 통계를 계산한다.
 *
 * @param {string} absPath  파일 절대 경로
 * @returns {{hangul:number, nonws:number, ratio:number}}
 */
function measureFile(absPath) {
  return hangulProseRatio(readFileSync(absPath, 'utf-8'));
}

/**
 * 마크다운 원문에서 코드 영역을 제거한 prose 의 Hangul 비율을 계산한다.
 *
 * @param {string} raw  마크다운 원문
 * @returns {{hangul:number, nonws:number, ratio:number}}
 */
export function hangulProseRatio(raw) {
  const prose = raw.replace(CODE_FENCE_RE, '').replace(INLINE_CODE_RE, '');
  const hangul = (prose.match(HANGUL_RE) || []).length;
  const nonws = (prose.match(/\S/g) || []).length;
  const ratio = nonws > 0 ? hangul / nonws : 0;
  return { hangul, nonws, ratio };
}

/**
 * 통계가 위반(번역 미흡)인지 판정한다.
 * 비율 임계 초과 AND 절대 Hangul 하한 충족을 동시에 만족해야 위반이다.
 *
 * @param {{hangul:number, ratio:number}} stat
 * @param {number} maxRatio  비율 임계값
 * @returns {boolean}
 */
export function isViolation(stat, maxRatio) {
  return stat.ratio > maxRatio && stat.hangul >= MIN_HANGUL;
}
