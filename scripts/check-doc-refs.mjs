#!/usr/bin/env node
/**
 * @file scripts/check-doc-refs.mjs
 * @domain ci
 * @layer script
 * @related docs/runbook/doc-ref-lint.md, docs/runbook/regex-robustness.md
 *
 * 마크다운 cross-ref 무결성 정적 검증.
 * Sprint 153 Phase G에서 5종 슬러그 23회 broken ref 적발 → 정기 lint로 부채 누적 차단.
 * Sprint 155: 함수 export + --include-untracked 옵션 + entry point guard 추가
 *             (check-staging-integrity.mjs에서 validateRef 등 재사용).
 *
 * 검사 항목
 * - markdown link `[text](path)` 의 path 존재 여부
 * - 텍스트 내 `docs/...*.md` 참조의 파일 존재 여부
 *
 * 면제
 * - 외부 URL (http://, https://, mailto:, #anchor-only) 자동 skip
 * - 코드 블록 펜스(```...```) 내부 자동 skip
 * - 인라인 코드 `` `...` `` 내부 자동 skip
 * - 라인 끝 `<!-- doc-ref-lint: ignore -->` 디렉티브
 *
 * exit (직접 실행 시)
 * - 0: 모든 ref 정상
 * - 1: broken ref 존재
 * - 2: self-test fixture 실패
 *
 * 사용법:
 *   node scripts/check-doc-refs.mjs                    # tracked 전용 (CI 기본)
 *   node scripts/check-doc-refs.mjs --include-untracked # tracked + untracked 합산
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve, relative, isAbsolute } from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(import.meta.dirname, '..');

/**
 * repo root 기준으로 resolve 하는 prefix SSOT.
 * validateRef 의 경로 resolve 분기와 extractBareDocPaths 의 bare 매칭 정규식이
 * **동일 출처**를 공유하여 prefix 비대칭(한쪽만 docs/ 만 매칭하던 갭)을 구조적으로 차단.
 * 신규 top-level 디렉토리 추가 시 본 배열만 갱신하면 양쪽 룰에 동시 반영.
 */
export const REPO_ROOT_PREFIXES = [
  'docs',
  'scripts',
  'blog',
  'frontend',
  'services',
  'infra',
  '.claude',
  '.github',
];

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
 * `--include-untracked` 옵션으로 untracked .md 파일도 합산 검사.
 */
function runMain() {
  const includeUntracked = process.argv.includes('--include-untracked');

  const fixtureResult = runRegressionFixtures();
  if (!fixtureResult.ok) {
    console.error(`[FAIL] Self-test failed: ${fixtureResult.message}`);
    process.exit(2);
  }
  console.log(
    `[OK]   regression fixtures: ${fixtureResult.detected} / ${fixtureResult.expected} expected broken refs detected`,
  );

  const trackedMd = collectTrackedMarkdown();
  const untrackedMd = includeUntracked ? collectUntrackedMarkdown() : [];
  // 중복 제거 (tracked + untracked 합산 시)
  const allFiles = [...new Set([...trackedMd, ...untrackedMd])];

  const allViolations = [];
  for (const relPath of allFiles) {
    const violations = analyzeFile(relPath);
    allViolations.push(...violations);
  }

  if (allViolations.length > 0) {
    console.error(`\n[FAIL] ${allViolations.length} broken doc reference(s):`);
    for (const v of allViolations) {
      console.error(`  ${v.file}:${v.line} — ${v.kind}`);
      console.error(`    target: ${v.target}`);
      if (v.resolved) console.error(`    resolved: ${v.resolved}`);
    }
    console.error('\nSee docs/runbook/doc-ref-lint.md for fix guidance.');
    process.exit(1);
  }

  const modeLabel =
    includeUntracked && untrackedMd.length > 0 ? ` (+${untrackedMd.length} untracked)` : '';
  console.log(`[OK]   doc-ref-lint: ${allFiles.length} files scanned${modeLabel}, no broken refs`);
  process.exit(0);
}

// ──────────────────────────────────────────────────────────────────
// File analyzer
// ──────────────────────────────────────────────────────────────────

/**
 * .md 파일 한 개에서 broken ref 추출.
 * tracked / untracked 모두 사용 가능 (relPath가 ROOT 기준이면 충분).
 *
 * @param {string} relPath repo root 기준 상대 경로
 * @returns {Array<{file:string,line:number,kind:string,target:string,resolved?:string}>}
 */
export function analyzeFile(relPath) {
  const absPath = resolve(ROOT, relPath);
  let content;
  try {
    content = readFileSync(absPath, 'utf-8');
  } catch {
    return [];
  }
  const lines = content.split('\n');
  const fileDir = dirname(absPath);
  const violations = [];

  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNo = i + 1;

    // 코드 블록 펜스 토글
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    // 라인 면제 디렉티브
    if (/<!--\s*doc-ref-lint:\s*ignore\s*-->/.test(line)) continue;

    // 인라인 코드 `...` 영역 제거 (single-line)
    const stripped = stripInlineCode(line);

    // 1) markdown link [text](path)
    for (const target of extractMarkdownLinks(stripped)) {
      const v = validateRef(target, fileDir, relPath, lineNo, 'markdown link');
      if (v) violations.push(v);
    }

    // 2) 텍스트 내 docs/.../*.md 참조 (link 외부 노출)
    for (const target of extractBareDocPaths(stripped)) {
      const v = validateRef(target, fileDir, relPath, lineNo, 'bare doc path');
      if (v) violations.push(v);
    }
  }

  return violations;
}

/**
 * ref 대상 검증. 존재하면 null, broken이면 violation 반환.
 * 외부 URL / mailto / anchor-only / 절대 외부 경로는 skip (null).
 *
 * @param {string} rawTarget  링크 target 원본
 * @param {string} fileDir    현재 파일의 디렉토리 절대 경로
 * @param {string} relPath    현재 파일의 repo 기준 상대 경로 (보고용)
 * @param {number} lineNo     라인 번호
 * @param {string} kind       'markdown link' | 'bare doc path'
 * @returns {object|null}
 */
export function validateRef(rawTarget, fileDir, relPath, lineNo, kind) {
  const target = rawTarget.trim();
  if (!target) return null;

  // skip: 외부 URL / mailto / anchor-only / template variable
  if (/^(https?:|mailto:|tel:|ftp:|file:)/i.test(target)) return null;
  if (target.startsWith('#')) return null;
  if (target.startsWith('<') || target.includes('{{') || target.includes('${')) return null;

  // anchor 분리: path#section → path만 검증
  const pathPart = target.split('#')[0].split('?')[0];
  if (!pathPart) return null; // anchor-only

  // .md 또는 docs/ prefix가 있는 경로만 검증
  if (!/\.md$/i.test(pathPart) && !pathPart.startsWith('docs/')) return null;

  // path resolve
  const decoded = decodeURIComponent(pathPart);
  let resolved;
  if (isAbsolute(decoded)) {
    // 절대경로: repo root 기준 (`/docs/...` → `docs/...`)
    resolved = resolve(ROOT, decoded.replace(/^\/+/, ''));
  } else if (REPO_ROOT_PREFIXES.some((p) => decoded.startsWith(`${p}/`))) {
    // repo root prefix (REPO_ROOT_PREFIXES SSOT)
    resolved = resolve(ROOT, decoded);
  } else {
    // 상대경로 (현재 파일 기준)
    resolved = resolve(fileDir, decoded);
  }

  if (existsSync(resolved)) return null;

  return {
    file: relPath,
    line: lineNo,
    kind,
    target,
    resolved: relative(ROOT, resolved),
  };
}

// ──────────────────────────────────────────────────────────────────
// Pattern extractors
// ──────────────────────────────────────────────────────────────────

/**
 * `[text](path)` 또는 `[text](path "title")` 의 path 부분 추출.
 * @param {string} line
 * @returns {string[]}
 */
export function extractMarkdownLinks(line) {
  const results = [];
  // [text](path) — text 안에 [], path 안에 () escape 미지원 (보수적)
  const re = /\[(?:[^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let m;
  while ((m = re.exec(line)) !== null) {
    results.push(m[1]);
  }
  return results;
}

/**
 * 텍스트 내 bare repo-path `.md` 참조 추출 (markdown link 외부 노출 형태).
 * REPO_ROOT_PREFIXES 의 8개 top-level prefix 를 모두 매칭 — 이전엔 `docs/` 만
 * 매칭하여 frontend/services/infra 등 bare 참조가 깨져도 미검출되던 비대칭을 해소.
 * validateRef 가 검증하는 범위(`.md` 또는 docs/)와 정렬되도록 확장자는 `.md` 로 한정.
 * @param {string} line
 * @returns {string[]}
 */
export function extractBareDocPaths(line) {
  const results = [];
  // 예: docs/foo/bar.md, frontend/README.md#anchor, .github/pull_request_template.md
  const alt = REPO_ROOT_PREFIXES.map((p) => p.replace(/\./g, '\\.')).join('|');
  const re = new RegExp(`(?<![[(\\w/.-])((?:${alt})\\/[\\w./-]+\\.md(?:#[\\w-]+)?)`, 'g');
  let m;
  while ((m = re.exec(line)) !== null) {
    results.push(m[1]);
  }
  return results;
}

/**
 * 인라인 코드 `..` 영역을 공백으로 치환 (single-line).
 * @param {string} line
 * @returns {string}
 */
export function stripInlineCode(line) {
  return line.replace(/`[^`]*`/g, (s) => ' '.repeat(s.length));
}

// ──────────────────────────────────────────────────────────────────
// File collectors
// ──────────────────────────────────────────────────────────────────

/**
 * git tracked .md 파일 목록 수집 (root 기준 상대경로).
 * @returns {string[]}
 */
export function collectTrackedMarkdown() {
  const out = execSync('git ls-files "*.md"', { cwd: ROOT, encoding: 'utf-8' });
  return out
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((p) => {
      // 실 존재 검사 (deleted but tracked 방어)
      try {
        return statSync(resolve(ROOT, p)).isFile();
      } catch {
        return false;
      }
    });
}

/**
 * git 미추적(untracked) .md 파일 목록 수집 (root 기준 상대경로).
 * --include-untracked 옵션 또는 check-staging-integrity.mjs에서 활용.
 * @returns {string[]}
 */
export function collectUntrackedMarkdown() {
  try {
    const out = execSync('git ls-files --others --exclude-standard "*.md"', {
      cwd: ROOT,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return out
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((p) => {
        try {
          return statSync(resolve(ROOT, p)).isFile();
        } catch {
          return false;
        }
      });
  } catch {
    return [];
  }
}

// ──────────────────────────────────────────────────────────────────
// Self-test fixtures (Sprint 153 Phase G 5종 슬러그 + Sprint 182 non-docs prefix)
// ──────────────────────────────────────────────────────────────────

/**
 * 해소 이전 형태의 슬러그가 모두 검출되는지 inline fixture로 검증.
 * 어떤 룰이 너무 좁아지거나 면제가 과도해지면 self-test가 즉시 fail.
 * Sprint 182: docs/ 외 top-level prefix 의 bare .md 깨진 참조도 잡는지 dogfood.
 *
 * @returns {{ok:boolean,detected:number,expected:number,message?:string}}
 */
export function runRegressionFixtures() {
  const fixtures = [
    { target: 'docs/runbook-monitoring-log-rules.md', sprintSeed: 'Sprint 153 Phase G #1' },
    { target: 'docs/runbook-ci-cd-rules.md', sprintSeed: 'Sprint 153 Phase G #2' },
    { target: 'docs/runbook-annotation-dictionary.md', sprintSeed: 'Sprint 153 Phase G #3' },
    { target: 'docs/runbook-migration-rules.md', sprintSeed: 'Sprint 153 Phase G #4' },
    { target: 'docs/runbook-work-progress-guide.md', sprintSeed: 'Sprint 153 Phase G #5' },
    // Sprint 182 — bare-path 비대칭 보강: docs/ 외 prefix 의 bare .md 도 검출되어야 함.
    { target: 'frontend/__nonexistent-doc-ref__.md', sprintSeed: 'Sprint 182 broadened prefix (frontend)' },
    { target: 'services/gateway/__nonexistent-doc-ref__.md', sprintSeed: 'Sprint 182 broadened prefix (services)' },
    { target: '.github/__nonexistent-doc-ref__.md', sprintSeed: 'Sprint 182 broadened prefix (.github)' },
  ];

  let detected = 0;
  for (const f of fixtures) {
    // markdown link fixture
    const mdLine = `참조: [문서](${f.target})`;
    const mdLinks = extractMarkdownLinks(mdLine);
    const mdViolation =
      mdLinks.length > 0 && validateRef(mdLinks[0], ROOT, 'fixture.md', 0, 'markdown link');
    // bare path fixture
    const bareLine = `참조 ${f.target} 갱신 필요`;
    const bareLinks = extractBareDocPaths(bareLine);
    const bareViolation =
      bareLinks.length > 0 && validateRef(bareLinks[0], ROOT, 'fixture.md', 0, 'bare doc path');

    if (mdViolation && bareViolation) detected++;
  }

  if (detected !== fixtures.length) {
    return {
      ok: false,
      message: `expected ${fixtures.length} broken refs from regression fixtures, detected ${detected}`,
      detected,
      expected: fixtures.length,
    };
  }

  return { ok: true, detected, expected: fixtures.length };
}
