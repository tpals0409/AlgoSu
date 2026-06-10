#!/usr/bin/env node
/**
 * @file GitHub Actions 서드파티 action SHA 핀 드리프트 가드
 * @domain ci
 * @layer script
 * @related .github/workflows/ci.yml, .github/workflows/dependabot-automerge.yml
 *
 * 공급망 하드닝: `.github/workflows` + `.github/actions` 하위 action.yml의
 * 모든 `uses:` 참조를 스캔하여, 1st-party(actions·github owner)가 아닌
 * 서드파티 action이 40-hex commit SHA로 핀되어 있는지 검증한다.
 * 태그(`@v4`)·브랜치 핀이 남아 있으면 exit 1로 CI를 실패시킨다.
 *
 * 배경: Sprint 243 [A] S-7 (ADR-030). 태그는 가변(force-push 가능)이므로
 * 공급망 공격에 노출된다. SHA 핀은 불변이며, Dependabot이 `# vX.Y.Z` 주석을
 * 추적해 갱신한다. 본 가드는 신규 워크플로우 추가 시 핀 누락을 자동 차단한다.
 *
 * 사용법: node scripts/check-action-pins.mjs
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const WORKFLOWS_DIR = join(ROOT, '.github', 'workflows');
const ACTIONS_DIR = join(ROOT, '.github', 'actions');

/** 1st-party owner — SHA 핀 면제 (태그 유지). */
const FIRST_PARTY_OWNERS = ['actions', 'github'];

/** 40-hex commit SHA 패턴. */
const SHA_PIN = /^[0-9a-f]{40}$/;

/**
 * 디렉토리를 재귀 순회하며 `action.yml`/`action.yaml`을 전수 수집한다.
 * 중첩 composite action(`.github/actions/a/b/action.yml`)까지 커버한다.
 * @param {string} dir 탐색 시작 디렉토리(절대 경로)
 * @param {string[]} acc 누적 배열
 * @returns {string[]} 발견된 action 매니페스트 절대 경로 배열
 */
function collectActionManifests(dir, acc) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      collectActionManifests(path, acc);
    } else if (entry.name === 'action.yml' || entry.name === 'action.yaml') {
      acc.push(path);
    }
  }
  return acc;
}

/**
 * 스캔 대상 파일 목록을 수집한다.
 * @returns {string[]} 절대 경로 배열
 */
function collectFiles() {
  const files = [];

  if (existsSync(WORKFLOWS_DIR)) {
    for (const entry of readdirSync(WORKFLOWS_DIR)) {
      if (entry.endsWith('.yml') || entry.endsWith('.yaml')) {
        files.push(join(WORKFLOWS_DIR, entry));
      }
    }
  }

  if (existsSync(ACTIONS_DIR)) {
    collectActionManifests(ACTIONS_DIR, files);
  }

  return files;
}

/**
 * 한 줄에서 `uses:` 참조 문자열을 추출한다.
 * @param {string} line
 * @returns {string|null} `owner/repo@ref` 또는 `./local` 또는 null
 */
function extractUses(line) {
  const match = line.match(/^\s*(?:-\s*)?uses:\s*(['"]?)([^'"#\s]+)\1/);
  return match ? match[2] : null;
}

/**
 * 서드파티 action 참조가 SHA 핀인지 판정한다.
 * @param {string} ref `owner/repo@sha` 형식
 * @returns {boolean}
 */
function isShaPinned(ref) {
  const atIdx = ref.lastIndexOf('@');
  if (atIdx === -1) return false;
  return SHA_PIN.test(ref.slice(atIdx + 1));
}

let exitCode = 0;
let scanned = 0;
const violations = [];

for (const file of collectFiles()) {
  const content = readFileSync(file, 'utf-8');
  const rel = file.slice(ROOT.length + 1);

  content.split('\n').forEach((line, idx) => {
    const ref = extractUses(line);
    if (!ref) return;

    // 로컬 action 참조(`./` `../`)는 핀 대상 아님
    if (ref.startsWith('./') || ref.startsWith('../')) return;

    const owner = ref.split('/')[0];
    // 1st-party는 태그 유지 허용
    if (FIRST_PARTY_OWNERS.includes(owner)) return;

    scanned++;
    if (!isShaPinned(ref)) {
      violations.push({ file: rel, line: idx + 1, ref });
      exitCode = 1;
    }
  });
}

if (exitCode === 0) {
  console.log(`[OK] 모든 서드파티 action이 SHA 핀됨 (검사 ${scanned}건).`);
} else {
  console.error('[FAIL] SHA 핀되지 않은 서드파티 action 발견:');
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  uses: ${v.ref}`);
  }
  console.error(
    '\n조치: `gh api repos/<owner>/<repo>/git/ref/tags/<tag>`로 SHA를 확인 후',
  );
  console.error("      `uses: <owner>/<repo>@<40-hex-sha> # vX.Y.Z` 형식으로 핀하세요.");
}

process.exit(exitCode);
