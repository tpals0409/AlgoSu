#!/usr/bin/env node
/**
 * @file scripts/check-staging-integrity.mjs
 * @domain ci
 * @layer script
 * @related docs/runbook/pre-push-check.md, docs/runbook/doc-ref-lint.md
 *
 * Git pre-push hook: staging 무결성 검증.
 *
 * Sprint 154 교훈 #4 보강:
 *   "git ls-files 기반 lint는 untracked 파일을 검증 못 함"
 *   → push 직전 untracked .md broken ref를 잡아 CI 사각지대 제거.
 *
 * Sprint 153 Phase A/E 사고 직접 차단:
 *   Phase E: sed 결과 staged 누락 → main broken link 노출
 *   Phase A: stash drop 후 untracked ADR 손실 + broken ref 유입
 *
 * 검증 1: untracked .md broken ref
 *   - git ls-files --others --exclude-standard "*.md"로 미추적 .md 수집
 *   - check-doc-refs.mjs의 validateRef / extractMarkdownLinks /
 *     extractBareDocPaths / stripInlineCode 재사용
 *   - 면제: 라인 끝 <!-- staging-check: ignore --> 또는 <!-- doc-ref-lint: ignore -->
 *
 * 검증 2: commit 누락 의심
 *   - git status --porcelain에서 worktree 수정 파일(Y='M') 검출
 *   - staged 안 된 수정이 있으면 push 전 경고
 *
 * regression fixture (runRegressionFixtures):
 *   - Sprint 153 Phase E: old runbook slug 참조 → broken ref 검출
 *   - Sprint 154 PR #246: home 경로 참조(~/.claude/...) → broken ref 검출
 *   - self-test 미통과 시 exit 2 (fail-safe)
 *
 * exit code:
 *   0 = 정상
 *   1 = commit 누락 의심 (unstaged modified files)
 *   2 = broken ref (untracked .md) 또는 self-test 실패
 *
 * 사용법:
 *   node scripts/check-staging-integrity.mjs   (pre-push hook에서 자동 실행)
 *   git push --no-verify                        (hook 우회, 긴급 시)
 */

import { readFileSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { execSync } from 'node:child_process';
import {
  validateRef,
  extractMarkdownLinks,
  extractBareDocPaths,
  stripInlineCode,
} from './check-doc-refs.mjs';

const ROOT = resolve(import.meta.dirname, '..');

// ──────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────

main();

/**
 * pre-push 검증 메인 로직.
 * 순서: self-test → untracked broken ref → unstaged modifications
 */
function main() {
  // ① Self-test (fail-safe: 스크립트 로직 오류 즉시 검출)
  const fixtureResult = runRegressionFixtures();
  if (!fixtureResult.ok) {
    console.error('[FAIL] staging-integrity self-test 실패:');
    console.error(`       ${fixtureResult.message}`);
    console.error('       check-staging-integrity.mjs 로직을 점검하세요.');
    process.exit(2);
  }
  console.log(
    `[OK]   self-test: ${fixtureResult.detected} / ${fixtureResult.expected} scenarios validated`,
  );

  // ② Untracked .md broken ref check
  const untrackedFiles = collectUntrackedMarkdown();
  const untrackedViolations = [];
  for (const relPath of untrackedFiles) {
    const violations = analyzeUntrackedFile(relPath);
    untrackedViolations.push(...violations);
  }

  if (untrackedViolations.length > 0) {
    console.error(
      `\n[FAIL] untracked .md ${untrackedFiles.length}개 중 broken ref ${untrackedViolations.length}건:`,
    );
    for (const v of untrackedViolations) {
      console.error(`  ${v.file}:${v.line} — ${v.kind}`);
      console.error(`    target:   ${v.target}`);
      if (v.resolved) console.error(`    resolved: ${v.resolved}`);
    }
    console.error('\n수정 방법:');
    console.error('  1) broken ref 수정 후 git add → git commit');
    console.error('  2) 의도적 경로면 라인 끝에 <!-- staging-check: ignore --> 추가');
    console.error('  3) 긴급 시 git push --no-verify (비권장)');
    console.error('  docs/runbook/doc-ref-lint.md 참조');
  } else if (untrackedFiles.length > 0) {
    console.log(
      `[OK]   untracked .md check: ${untrackedFiles.length}개 스캔, broken ref 없음`,
    );
  } else {
    console.log('[OK]   untracked .md check: 미추적 .md 없음');
  }

  // ③ Unstaged modifications check
  const unstagedFiles = detectUnstagedModifications();
  if (unstagedFiles.length > 0) {
    console.warn(`\n[WARN] staged 안 된 수정 파일 ${unstagedFiles.length}개:`);
    for (const f of unstagedFiles) {
      console.warn(`  ${f}`);
    }
    console.warn('\n이 변경사항은 push할 commit에 포함되지 않습니다.');
    console.warn('의도적이면 계속해도 됩니다. 아니라면 stage → commit 후 재시도.');
    console.warn('docs/runbook/git-staging-checklist.md §2 참조');
  } else {
    console.log('[OK]   staging check: unstaged 수정 없음');
  }

  // Exit code 결정 (broken ref > unstaged > 정상)
  if (untrackedViolations.length > 0) process.exit(2);
  if (unstagedFiles.length > 0) process.exit(1);
  process.exit(0);
}

// ──────────────────────────────────────────────────────────────────
// Untracked file collector
// ──────────────────────────────────────────────────────────────────

/**
 * git 미추적 .md 파일 목록 수집 (root 기준 상대경로).
 * .gitignore 적용, 실제 파일 존재 검증 포함.
 *
 * @returns {string[]}
 */
function collectUntrackedMarkdown() {
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
    // git 명령 실패 시 안전하게 빈 목록 반환 (push 차단 않음)
    return [];
  }
}

// ──────────────────────────────────────────────────────────────────
// Untracked file analyzer
// ──────────────────────────────────────────────────────────────────

/**
 * untracked .md 파일 한 개에서 broken ref 추출.
 * check-doc-refs.mjs의 분석 로직을 재사용하되,
 * staging-check: ignore 면제 디렉티브를 추가 지원.
 *
 * @param {string} relPath repo root 기준 상대 경로
 * @returns {Array<{file:string,line:number,kind:string,target:string,resolved?:string}>}
 */
function analyzeUntrackedFile(relPath) {
  const absPath = resolve(ROOT, relPath);
  let content;
  try {
    content = readFileSync(absPath, 'utf-8');
  } catch {
    return []; // 읽기 실패 시 스킵
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

    // 면제 디렉티브 (staging-check 또는 doc-ref-lint 둘 다 허용)
    if (/<!--\s*staging-check:\s*ignore\s*-->/.test(line)) continue;
    if (/<!--\s*doc-ref-lint:\s*ignore\s*-->/.test(line)) continue;

    // 인라인 코드 영역 제거
    const stripped = stripInlineCode(line);

    // 1) markdown link [text](path)
    for (const target of extractMarkdownLinks(stripped)) {
      const v = validateRef(target, fileDir, relPath, lineNo, 'markdown link');
      if (v) violations.push(v);
    }

    // 2) 텍스트 내 docs/...*.md bare path 참조
    for (const target of extractBareDocPaths(stripped)) {
      const v = validateRef(target, fileDir, relPath, lineNo, 'bare doc path');
      if (v) violations.push(v);
    }
  }

  return violations;
}

// ──────────────────────────────────────────────────────────────────
// Unstaged modifications detector
// ──────────────────────────────────────────────────────────────────

/**
 * staged 안 된 워킹트리 수정 파일 목록 반환.
 * git status --porcelain 포맷: XY filepath
 *   X = index 상태, Y = worktree 상태
 *   Y === 'M' → worktree에 수정 있음 (staged 여부 무관)
 *
 * @returns {string[]} 파일 경로 목록
 */
function detectUnstagedModifications() {
  try {
    const out = execSync('git status --porcelain', {
      cwd: ROOT,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return out
      .split('\n')
      .filter(Boolean)
      .filter((l) => l.length >= 2 && l[1] === 'M')
      .map((l) => l.substring(3).trim());
  } catch {
    return []; // git 실패 시 안전하게 빈 목록
  }
}

// ──────────────────────────────────────────────────────────────────
// Self-test fixtures
// ──────────────────────────────────────────────────────────────────

/**
 * regression fixture 자체 검증.
 *
 * 시나리오 1 — Sprint 153 Phase E 재현:
 *   sed로 갱신된 runbook cross-ref가 staged 누락으로 commit 제외.
 *   untracked .md가 이전 경로(docs/runbook-*.md) 참조 → broken ref 적발.
 *
 * 시나리오 2 — Sprint 154 PR #246 재현:
 *   untracked sprint-XXX.md가 home 경로(~/.claude/...) 참조 → broken ref 적발.
 *   (실제 사건: sprint-153.md:119,120 두 줄, 면제 디렉티브로 해소)
 *
 * self-test 미통과 시 exit 2 — 스크립트 로직 오류를 push 전 즉시 감지.
 *
 * @returns {{ok:boolean,detected:number,expected:number,message?:string}}
 */
function runRegressionFixtures() {
  const scenarios = [
    {
      /** Sprint 153 Phase E: runbook 이동 후 old slug 참조 잔존 */
      name: 'Sprint153-PhaseE: old runbook slug in untracked .md',
      // docs/runbook-monitoring-log-rules.md → docs/runbook/monitoring-logging.md 로 이동됨
      lines: ['[runbook 참조](docs/runbook-monitoring-log-rules.md)'],
      relPath: 'docs/adr/sprints/fixture-153e.md',
      expectViolations: 1,
    },
    {
      /** Sprint 154 PR #246: home 경로(~/ prefix)를 markdown link로 기재한 케이스 */
      name: 'Sprint154-PR246: home path broken ref in untracked sprint-XXX.md',
      // ~/ 는 shell 확장이므로 validateRef에서 상대 경로로 처리 → 존재하지 않는 경로 → violation
      lines: [
        '[MEMORY](~/.claude/projects/-Users-leokim-Desktop-leo-kim-AlgoSu/memory/sprint-999.md)',
      ],
      relPath: 'docs/adr/sprints/fixture-154.md',
      expectViolations: 1,
    },
  ];

  let detected = 0;
  const failures = [];

  for (const s of scenarios) {
    const fileDir = dirname(resolve(ROOT, s.relPath));
    const violations = [];
    let inFence = false;

    for (let i = 0; i < s.lines.length; i++) {
      const line = s.lines[i];

      if (/^\s*```/.test(line)) {
        inFence = !inFence;
        continue;
      }
      if (inFence) continue;
      if (/<!--\s*staging-check:\s*ignore\s*-->/.test(line)) continue;
      if (/<!--\s*doc-ref-lint:\s*ignore\s*-->/.test(line)) continue;

      const stripped = stripInlineCode(line);

      for (const target of extractMarkdownLinks(stripped)) {
        const v = validateRef(target, fileDir, s.relPath, i + 1, 'markdown link');
        if (v) violations.push(v);
      }
      for (const target of extractBareDocPaths(stripped)) {
        const v = validateRef(target, fileDir, s.relPath, i + 1, 'bare doc path');
        if (v) violations.push(v);
      }
    }

    if (violations.length === s.expectViolations) {
      detected++;
    } else {
      failures.push(
        `[${s.name}] expect ${s.expectViolations} violation(s), got ${violations.length}`,
      );
    }
  }

  if (failures.length > 0) {
    return {
      ok: false,
      message: failures.join('; '),
      detected,
      expected: scenarios.length,
    };
  }
  return { ok: true, detected, expected: scenarios.length };
}
