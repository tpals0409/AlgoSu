#!/usr/bin/env node
/**
 * @file  scripts/check-adr-conversion.mjs
 * @domain  ci
 * @layer  script
 * @related blog/src/lib/adr/parser.ts, scripts/check-doc-refs.mjs
 *
 * ADR 변환 self-test — docs/adr/ 전체 .md를 gray-matter로 파싱,
 * frontmatter 없는 영구 ADR fallback + 10 fixture 검증.
 *
 * blog/src/lib/adr/ TypeScript 파서를 직접 import할 수 없으므로
 * (CJS/ESM 호환) 핵심 로직을 독립 .mjs로 재구현한다.
 *
 * exit (직접 실행 시)
 *   0: 모든 fixture pass + 전체 파싱 성공
 *   1: 파싱 에러 (fixture 외 실패)
 *   2: fixture 실패
 *
 * 사용법:
 *   node scripts/check-adr-conversion.mjs
 */
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, join, basename, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = resolve(import.meta.dirname, '..');

/* gray-matter는 blog/node_modules에 설치됨 */
const blogRequire = createRequire(join(ROOT, 'blog', 'package.json'));
const matter = blogRequire('gray-matter');

/** 직접 실행 여부 (entry point guard) */
const __selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] === __selfPath) {
  runMain();
}

// ──────────────────────────────────────────────────────────────────
// CLI entry point
// ──────────────────────────────────────────────────────────────────

/**
 * 직접 실행 시 호출되는 메인 로직.
 * fixture 검증 → 전체 ADR 파싱 → 통계 출력.
 */
function runMain() {
  const allFiles = collectAdrFiles();
  console.log(`[INFO] ADR conversion self-test — checking ${allFiles.length} files in docs/adr/`);

  /* ① fixture 검증 */
  const fixtureResult = runFixtures();
  if (!fixtureResult.ok) {
    console.error(`[FAIL] Fixture: ${fixtureResult.pass} pass / ${fixtureResult.fail} fail`);
    for (const msg of fixtureResult.errors) {
      console.error(`       ${msg}`);
    }
    process.exit(2);
  }
  console.log(`[INFO] Fixture: ${fixtureResult.pass} pass / ${fixtureResult.fail} fail`);

  /* ② 전체 ADR 파싱 */
  const stats = { total: 0, permanent: 0, topic: 0, sprint: 0 };
  const warnings = [];
  let parseErrors = 0;

  for (const filePath of allFiles) {
    const result = parseAdrFile(filePath);
    if (!result.ok) {
      parseErrors++;
      console.error(`[FAIL] parse error: ${relative(ROOT, filePath)} — ${result.error}`);
      continue;
    }
    stats.total++;
    stats[result.kind]++;
    if (!result.hasFrontmatter) {
      warnings.push(relative(ROOT, filePath));
    }
  }

  console.log(
    `[INFO] All ADRs: ${stats.total} total (permanent=${stats.permanent}, topic=${stats.topic}, sprint=${stats.sprint})`,
  );
  console.log(`[INFO] Warnings: ${warnings.length} (no-frontmatter=${warnings.length})`);

  if (parseErrors > 0) {
    console.error(`[FAIL] ${parseErrors} file(s) failed to parse`);
    process.exit(1);
  }

  console.log('[OK]   All checks passed');
  process.exit(0);
}

// ──────────────────────────────────────────────────────────────────
// ADR file collector
// ──────────────────────────────────────────────────────────────────

/**
 * docs/adr/ 하위 모든 .md 파일을 재귀 수집한다.
 * README.md는 제외한다 (ADR 문서가 아님).
 *
 * @returns {string[]} 절대 경로 배열
 */
export function collectAdrFiles() {
  const adrRoot = resolve(ROOT, 'docs', 'adr');
  const files = [];
  collectRecursive(adrRoot, files);
  return files.filter((f) => basename(f) !== 'README.md');
}

/**
 * 디렉토리를 재귀 순회하며 .md 파일을 수집한다.
 *
 * @param {string} dir  현재 디렉토리 절대 경로
 * @param {string[]} out  결과 배열 (mutate)
 */
function collectRecursive(dir, out) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      collectRecursive(full, out);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      out.push(full);
    }
  }
}

// ──────────────────────────────────────────────────────────────────
// ADR kind classifier
// ──────────────────────────────────────────────────────────────────

/**
 * 파일 경로로부터 ADR 종류를 분류한다.
 *
 * @param {string} absPath  절대 경로
 * @returns {'permanent'|'sprint'|'topic'}
 */
function classifyKind(absPath) {
  const rel = relative(resolve(ROOT, 'docs', 'adr'), absPath);
  if (rel.startsWith('sprints/') || rel.startsWith('sprints\\')) return 'sprint';
  if (rel.startsWith('topics/') || rel.startsWith('topics\\')) return 'topic';
  return 'permanent';
}

// ──────────────────────────────────────────────────────────────────
// Frontmatter fallback — 영구 ADR 대응
// ──────────────────────────────────────────────────────────────────

/**
 * frontmatter 없는 영구 ADR에서 상태를 fallback 추출한다.
 * ADR-001: `## 상태` H2 직후 한 줄
 * ADR-002~028: `- **상태**: ...` dash-list
 *
 * @param {string} body  frontmatter 제거 후 본문
 * @returns {string|undefined}
 */
function extractFallbackStatus(body) {
  const h2Match = body.match(/^##\s*상태\s*\n+(.+)/m);
  if (h2Match) return h2Match[1].trim();

  const dashMatch = body.match(/^-\s*\*{2}상태\*{2}\s*:\s*(.+)/m);
  if (dashMatch) return dashMatch[1].trim();

  return undefined;
}

/**
 * H1 텍스트에서 title을 추출한다.
 *
 * @param {string} body  본문
 * @returns {string|undefined}
 */
function extractH1Title(body) {
  const match = body.match(/^#\s+(.+)/m);
  return match ? match[1].trim() : undefined;
}

/**
 * 상태 문자열에서 sprint 번호를 추출한다.
 * 예: "구현 완료 (Implemented) — 2026-03-18 승인, 2026-03-20 Sprint 51 구현 완료"
 *
 * @param {string} raw  상태 문자열
 * @returns {number|undefined}
 */
function extractSprintFromStatus(raw) {
  const match = raw.match(/sprint\s+(\d+)/i);
  return match ? parseInt(match[1], 10) : undefined;
}

// ──────────────────────────────────────────────────────────────────
// Single file parser
// ──────────────────────────────────────────────────────────────────

/**
 * 단일 ADR 파일을 파싱하여 결과를 반환한다.
 *
 * @param {string} absPath  절대 경로
 * @returns {{ok:boolean, kind?:string, hasFrontmatter?:boolean,
 *            title?:string, status?:string, sprint?:number,
 *            date?:string, hasDecisions?:boolean, error?:string}}
 */
export function parseAdrFile(absPath) {
  let raw;
  try {
    raw = readFileSync(absPath, 'utf-8');
  } catch (err) {
    return { ok: false, error: `read failed: ${err.message}` };
  }

  let fm, body;
  try {
    const parsed = matter(raw);
    fm = parsed.data;
    body = parsed.content;
  } catch (err) {
    return { ok: false, error: `gray-matter parse failed: ${err.message}` };
  }

  const kind = classifyKind(absPath);
  const hasFrontmatter = Object.keys(fm).length > 0;

  /* title 해결: frontmatter > H1 > 파일명 */
  const title = (typeof fm.title === 'string' && fm.title.length > 0)
    ? fm.title
    : extractH1Title(body) ?? basename(absPath, '.md');

  /* status 해결: frontmatter > body fallback */
  const rawStatus = typeof fm.status === 'string'
    ? fm.status
    : extractFallbackStatus(body) ?? undefined;

  /* date 해결: frontmatter date 또는 period */
  const date = typeof fm.date === 'string'
    ? fm.date
    : (typeof fm.period === 'string' ? fm.period : undefined);

  /* sprint 번호: frontmatter > slug 파싱 */
  let sprint;
  if (typeof fm.sprint === 'number') {
    sprint = fm.sprint;
  } else if (kind === 'sprint') {
    const slug = basename(absPath, '.md').replace(/^sprint-/, '');
    const num = parseInt(slug, 10);
    sprint = isNaN(num) ? undefined : num;
  } else if (rawStatus) {
    sprint = extractSprintFromStatus(rawStatus);
  }

  /* Decisions 섹션 존재 여부 */
  const hasDecisions = /^#{2,3}\s*(Decisions|결정)/im.test(body);

  return {
    ok: true,
    kind,
    hasFrontmatter,
    title,
    status: rawStatus,
    sprint,
    date,
    hasDecisions,
  };
}

// ──────────────────────────────────────────────────────────────────
// Fixture definitions (F1~F10)
// ──────────────────────────────────────────────────────────────────

/**
 * 10 fixture 검증을 실행한다.
 *
 * @returns {{ok:boolean, pass:number, fail:number, errors:string[]}}
 */
export function runFixtures() {
  const adrRoot = resolve(ROOT, 'docs', 'adr');
  let pass = 0;
  let fail = 0;
  const errors = [];

  /**
   * 개별 fixture 실행 헬퍼.
   *
   * @param {string} label  fixture 라벨
   * @param {function():boolean} fn  검증 함수 (true=pass)
   * @param {string} summary  요약 출력 문자열
   */
  function check(label, fn, summary) {
    try {
      if (fn()) {
        pass++;
        console.log(`[OK]   ${label}: ${summary}`);
      } else {
        fail++;
        errors.push(`${label}: assertion failed — ${summary}`);
        console.error(`[FAIL] ${label}: ${summary}`);
      }
    } catch (err) {
      fail++;
      errors.push(`${label}: exception — ${err.message}`);
      console.error(`[FAIL] ${label}: ${err.message}`);
    }
  }

  /* F1: ADR-001 frontmatter 없음, ## 상태 fallback */
  check('F1', () => {
    const f = join(adrRoot, 'ADR-001-gateway-identity-db-separation.md');
    const r = parseAdrFile(f);
    return r.ok && !r.hasFrontmatter && typeof r.status === 'string' && r.status.length > 0;
  }, 'ADR-001 frontmatter fallback (H2 상태)');

  /* F2: ADR-002 dash-list 상태 추출 */
  check('F2', () => {
    const f = join(adrRoot, 'ADR-002-outbox-pattern.md');
    const r = parseAdrFile(f);
    return r.ok && !r.hasFrontmatter && typeof r.status === 'string' && /보류|deferred/i.test(r.status);
  }, 'ADR-002 dash-list status (보류/Deferred)');

  /* F3: ADR-028 복합 상태 문자열 존재 */
  check('F3', () => {
    const f = join(adrRoot, 'ADR-028-dev-cluster-separation.md');
    const r = parseAdrFile(f);
    return r.ok && typeof r.status === 'string' && r.status.length > 20;
  }, 'ADR-028 compound status string');

  /* F4: sprint-62 영문 Decisions 섹션 존재 */
  check('F4', () => {
    const f = join(adrRoot, 'sprints', 'sprint-62.md');
    const r = parseAdrFile(f);
    return r.ok && r.hasDecisions === true;
  }, 'sprint-62 ## Decisions section');

  /* F5: sprint-110 date 또는 period 필드 존재 */
  check('F5', () => {
    const f = join(adrRoot, 'sprints', 'sprint-110.md');
    const r = parseAdrFile(f);
    return r.ok && typeof r.date === 'string' && r.date.length > 0;
  }, 'sprint-110 date/period field');

  /* F6: sprint-75 frontmatter 파싱 성공 (related_adrs 빈 배열 정상) */
  check('F6', () => {
    const f = join(adrRoot, 'sprints', 'sprint-75.md');
    const r = parseAdrFile(f);
    return r.ok && r.hasFrontmatter === true;
  }, 'sprint-75 frontmatter parse (related_adrs OK)');

  /* F7: topics/ 디렉토리 파일 존재 + 파싱 성공 */
  check('F7', () => {
    const f = join(adrRoot, 'topics', 'sprint-95-programmers-dataset.md');
    if (!existsSync(f)) return false;
    const r = parseAdrFile(f);
    return r.ok && r.kind === 'topic';
  }, 'topics/sprint-95 exists + parse OK');

  /* F8: 가상 — sprint-9999 미존재 파일 edge */
  check('F8', () => {
    const f = join(adrRoot, 'sprints', 'sprint-9999.md');
    return !existsSync(f);
  }, 'sprint-9999 does not exist (edge case)');

  /* F9: sprint-156 최대 번호 검증 */
  check('F9', () => {
    const f = join(adrRoot, 'sprints', 'sprint-156.md');
    const r = parseAdrFile(f);
    return r.ok && r.sprint === 156;
  }, 'sprint-156 max sprint number (sprint=156)');

  /* F10: sprint-40 최저 번호 + 파싱 성공 */
  check('F10', () => {
    const f = join(adrRoot, 'sprints', 'sprint-40.md');
    const r = parseAdrFile(f);
    return r.ok && r.sprint === 40 && r.hasFrontmatter === true;
  }, 'sprint-40 lowest sprint (sprint=40)');

  return { ok: fail === 0, pass, fail, errors };
}
