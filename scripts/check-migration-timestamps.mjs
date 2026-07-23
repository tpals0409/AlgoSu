#!/usr/bin/env node
/**
 * @file  scripts/check-migration-timestamps.mjs
 * @domain  ci / database
 * @layer  script
 * @related services (svc)/src/database/migrations, scripts/check-regex-robustness.mjs
 *
 * TypeORM 마이그레이션 파일명 앞 타임스탬프가 정확히 13자리(epoch-ms)인지 게이트한다.
 *
 * ── 왜 필요한가 (재발방지) ─────────────────────────────────────────
 * TypeORM MigrationExecutor 는 마이그레이션 실행 순서를 클래스명의 **뒤 13자리**로
 * 정한다: `parseInt(className.substr(-13))`. 따라서 타임스탬프가 14자리(예:
 * `20260715000000`)면 substr(-13) 이 `0260715000000`(≈2.6e11)로 잘려, 정상 13자리
 * 마이그레이션(`1709000017000` ≈ 1.7e12)보다 **앞으로 정렬**된다.
 * → 빈 DB fresh migrate 시 `ALTER TABLE`/`REFERENCES` 가 대상 테이블 CREATE 보다
 *   먼저 실행되어 마이그레이션이 실패할 수 있다(순서역전).
 *
 * 파일명 앞 타임스탬프(`<ts>-<Name>.ts`)는 이 위험을 판별하는 명확한 SSOT 다.
 * 클래스명 뒤 숫자만 보면 `...Enum9` 처럼 이름이 숫자로 끝나는 경우와 14자리
 * 타임스탬프를 구분할 수 없지만(오탐), 파일명 앞 숫자 그룹은 항상 타임스탬프다.
 *
 * ── 기존 파일(grandfather) ────────────────────────────────────────
 * 이미 prod 적용된 14자리 파일 7건은 rename 시 TypeORM 이 미실행 신규로 오인해
 * **재실행**하므로 수정 불가 → GRANDFATHERED 로 통과시킨다. 본 가드는 오직
 * **신규** 14자리 마이그레이션 유입만 차단한다(shift-left).
 *
 * 측정 방식: `services/<svc>/src/database/migrations/` 하위 `*.ts` 파일명 앞 `^(\d+)-` 그룹
 * 길이가 13이 아니면 위반. 부가로 클래스명 substr(-13) 이 파일명 타임스탬프와
 * 일치하는지(TypeORM 정렬 실측 재현) 교차검증한다.
 *
 * - 기본 모드: 통계만 출력하고 exit 0 (자료 수집용)
 * - --strict 모드: 위반이 1건이라도 있으면 exit 1 (CI hard gate 용)
 *
 * exit
 *   0: 점검 완료 (--strict 외에는 항상 0)
 *   1: --strict 모드에서 위반 발견
 *   2: I/O 오류 / 마이그레이션 디렉토리 없음 / 잘못된 옵션
 *
 * 사용법
 *   node scripts/check-migration-timestamps.mjs            # 통계만
 *   node scripts/check-migration-timestamps.mjs --strict   # 위반 시 fail
 */
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(import.meta.dirname, '..');
const SERVICES_DIR = resolve(ROOT, 'services');

/** TypeORM 정상 타임스탬프 자릿수 (epoch-ms). */
export const EXPECTED_TS_LEN = 13;

/**
 * 이미 prod 적용된 14자리 파일 — rename 불가하므로 통과(grandfather).
 * ⚠️ 이 목록에 **추가하지 말 것**. 신규 마이그레이션은 반드시 13자리여야 한다.
 * (Sprint: 마이그레이션 타임스탬프 정렬 결함 진단 — librarian)
 */
export const GRANDFATHERED = new Set([
  '20260408120000-SP61-CreateAiSatisfaction.ts',
  '20260422000000-FixIdempotencyKeyScope.ts',
  '20260508000000-AddProblemContextColumns.ts',
  '20260522120000-SP196-TagsAllowedLanguagesToJsonb.ts',
  '20260602000000-SP217-CreateQuizRecords.ts',
  '20260715000000-AddDifficultyLevelColumns.ts',
  '20260715000001-AddStructuredContentToProblems.ts',
]);

/** 파일명 앞 타임스탬프 추출: `<digits>-<rest>.ts` */
const LEADING_TS_RE = /^(\d+)-.+\.ts$/;

/** 클래스명 추출 (TypeORM 정렬 실측 재현용) */
const CLASS_RE = /export\s+class\s+([A-Za-z0-9_]+)/;

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

  if (!existsSync(SERVICES_DIR)) {
    console.error(`[FAIL] services 디렉토리 없음: ${relative(ROOT, SERVICES_DIR)}`);
    process.exit(2);
  }

  const files = collectMigrationFiles(SERVICES_DIR);
  const results = files.map((abs) => inspectMigration(abs));
  const violations = results.filter((r) => r.violation);
  const grandfathered = results.filter((r) => r.grandfathered);

  console.log(
    `[INFO] 마이그레이션 타임스탬프 점검: ${files.length}개 파일 (grandfather ${grandfathered.length}건 제외)`,
  );

  if (violations.length === 0) {
    console.log('[OK]   모든 신규 마이그레이션 타임스탬프가 13자리입니다.');
    process.exit(0);
  }

  const level = args.strict ? 'FAIL' : 'WARN';
  console.log(`[${level}] ${violations.length}건 타임스탬프 규약 위반:`);
  for (const v of violations) {
    console.log(`       - ${v.rel}  (${v.reason})`);
  }

  if (args.strict) {
    console.error('[FAIL] --strict 모드에서 위반 발견 → exit 1');
    console.error(
      '[INFO] 신규 마이그레이션 파일명은 `<13자리 epoch-ms>-<Name>.ts` 형식이어야 합니다 (예: 1784851200000-Foo.ts). Date.now() 값을 사용하세요.',
    );
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
      console.log('사용법: node scripts/check-migration-timestamps.mjs [--strict]');
      process.exit(0);
    } else {
      console.error(`[FAIL] 알 수 없는 옵션: ${token}`);
      process.exit(2);
    }
  }
  return result;
}

// ──────────────────────────────────────────────────────────────────
// Collection
// ──────────────────────────────────────────────────────────────────

/**
 * services/ 하위 모든 `<svc>/src/database/migrations/` 내 `.ts` 파일을 수집한다.
 *
 * @param {string} servicesDir  services 절대 경로
 * @returns {string[]}  마이그레이션 파일 절대 경로 배열
 */
export function collectMigrationFiles(servicesDir) {
  const out = [];
  for (const svc of readdirSync(servicesDir)) {
    const migDir = resolve(servicesDir, svc, 'src', 'database', 'migrations');
    if (!existsSync(migDir) || !statSync(migDir).isDirectory()) continue;
    for (const f of readdirSync(migDir)) {
      if (f.endsWith('.ts')) out.push(resolve(migDir, f));
    }
  }
  return out.sort();
}

// ──────────────────────────────────────────────────────────────────
// Inspection
// ──────────────────────────────────────────────────────────────────

/**
 * 단일 마이그레이션 파일의 타임스탬프 규약 준수 여부를 판정한다.
 *
 * @param {string} absPath  파일 절대 경로
 * @returns {{rel:string, file:string, grandfathered:boolean, violation:boolean, reason:string}}
 */
export function inspectMigration(absPath) {
  const file = basename(absPath);
  const rel = relative(ROOT, absPath);
  const base = { rel, file, grandfathered: false, violation: false, reason: '' };

  if (GRANDFATHERED.has(file)) {
    return { ...base, grandfathered: true };
  }

  const m = LEADING_TS_RE.exec(file);
  if (!m) {
    return { ...base, violation: true, reason: '파일명이 `<타임스탬프>-<Name>.ts` 형식이 아님' };
  }

  const ts = m[1];
  if (ts.length !== EXPECTED_TS_LEN) {
    return {
      ...base,
      violation: true,
      reason: `파일명 타임스탬프 ${ts.length}자리 (13자리여야 함): ${ts}`,
    };
  }

  // 부가 교차검증 — TypeORM 정렬 실측 재현: parseInt(className.substr(-13)) === ts
  const evaluated = evaluateClassSort(absPath, ts);
  if (evaluated) return { ...base, violation: true, reason: evaluated };

  return base;
}

/**
 * 클래스명 뒤 13자리(TypeORM 정렬 키)가 파일명 타임스탬프와 일치하는지 검증한다.
 * 불일치 시 위반 사유 문자열, 정상이면 null 을 반환한다.
 *
 * @param {string} absPath  파일 절대 경로
 * @param {string} ts       파일명 타임스탬프(13자리 문자열)
 * @returns {string|null}
 */
export function evaluateClassSort(absPath, ts) {
  let src;
  try {
    src = readFileSync(absPath, 'utf-8');
  } catch {
    return null; // 읽기 실패는 파일명 검사로 충분 — 정렬 교차검증만 건너뜀
  }
  const cm = CLASS_RE.exec(src);
  if (!cm) return null; // 클래스 선언 미발견 시 파일명 검사에 위임
  const className = cm[1];
  const sortKey = className.slice(-EXPECTED_TS_LEN);
  if (sortKey !== ts) {
    return `클래스명 정렬키(substr(-13)=${sortKey})가 파일명 타임스탬프(${ts})와 불일치 — TypeORM 실행순서 오류 위험`;
  }
  return null;
}
