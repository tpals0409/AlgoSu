#!/usr/bin/env node
/**
 * @file  scripts/check-adr-en-coverage.mjs
 * @domain  ci / docs
 * @layer  script
 * @related scripts/translate-adr.mjs, docs/adr-en/README.md
 *
 * docs/adr/ 의 모든 KR ADR에 대해 docs/adr-en/<same-path> 영문판이 존재하는지 점검한다.
 *
 * - 기본 모드: 통계만 출력하고 exit 0 (자료 수집용)
 * - --lint 모드: 누락 항목을 WARN으로 나열 + 누락 비율 출력 (현재는 strict fail 아님, Sprint 158+에서 강제 활성화 예정)
 * - --strict 모드: 누락이 1건이라도 있으면 exit 1 (CI hard gate 용)
 *
 * exit
 *   0: 점검 완료 (--strict 외에는 항상 0)
 *   1: --strict 모드에서 누락 발견
 *   2: I/O 오류 / 디렉토리 없음
 *
 * 사용법
 *   node scripts/check-adr-en-coverage.mjs            # 통계만
 *   node scripts/check-adr-en-coverage.mjs --lint     # WARN 출력
 *   node scripts/check-adr-en-coverage.mjs --strict   # 1건이라도 누락 시 fail
 */
import { readdirSync, existsSync, statSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(import.meta.dirname, '..');
const KR_BASE = resolve(ROOT, 'docs', 'adr');
const EN_BASE = resolve(ROOT, 'docs', 'adr-en');

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

  if (!existsSync(KR_BASE)) {
    console.error(`[FAIL] KR ADR 디렉토리 없음: ${relative(ROOT, KR_BASE)}`);
    process.exit(2);
  }

  const krFiles = collectAdrFiles(KR_BASE);
  const missing = [];
  const present = [];

  for (const kr of krFiles) {
    const rel = relative(KR_BASE, kr);
    const en = join(EN_BASE, rel);
    if (existsSync(en)) present.push(rel);
    else missing.push(rel);
  }

  const total = krFiles.length;
  const covered = present.length;
  const ratio = total > 0 ? ((covered / total) * 100).toFixed(1) : '0.0';

  console.log(`[INFO] ADR EN coverage: ${covered}/${total} (${ratio}%)`);

  if (args.lint || args.strict) {
    if (missing.length === 0) {
      console.log('[OK]   모든 KR ADR이 영문판을 보유합니다.');
      process.exit(0);
    }

    const level = args.strict ? 'FAIL' : 'WARN';
    console.log(`[${level}] ${missing.length}건 영문판 누락:`);
    for (const m of missing) {
      console.log(`       - docs/adr/${m}  →  docs/adr-en/${m} 미생성`);
    }

    if (args.strict) {
      console.error('[FAIL] --strict 모드에서 누락 발견 → exit 1');
      process.exit(1);
    }

    console.log(
      '[INFO] 자동 번역: `node scripts/translate-adr.mjs --target docs/adr/<path>` 실행 (ANTHROPIC_API_KEY 필요)',
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
        '사용법: node scripts/check-adr-en-coverage.mjs [--lint] [--strict]',
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
// File collector
// ──────────────────────────────────────────────────────────────────

/**
 * 지정 디렉토리 하위의 .md 파일을 재귀 수집한다. README.md는 제외한다.
 *
 * @param {string} base  기준 디렉토리
 * @returns {string[]} 절대 경로 배열
 */
export function collectAdrFiles(base) {
  const out = [];
  walk(base, out);
  return out.filter((p) => !p.endsWith('README.md'));
}

/**
 * 디렉토리를 재귀 순회하며 .md 파일을 수집한다.
 *
 * @param {string} dir
 * @param {string[]} out
 */
function walk(dir, out) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && entry.name.endsWith('.md')) out.push(full);
  }
}
