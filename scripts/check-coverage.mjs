#!/usr/bin/env node
/**
 * @file Coverage 글로벌 임계치 검증 스크립트
 * @domain ci
 * @layer script
 * @related .github/workflows/ci.yml
 *
 * lcov.info 파일들을 파싱하여 전체 lines/branches 커버리지를 계산하고
 * 지정 임계치(기본 60%) 미만 시 exit 1로 CI 실패 처리.
 *
 * 사용법: node scripts/check-coverage.mjs <coverage-dir> [threshold]
 * 예: node scripts/check-coverage.mjs ./coverage 60
 */
import { readFileSync, readdirSync, statSync, appendFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const coverageDir = resolve(process.argv[2] || './coverage');
const threshold = Number(process.argv[3] || '60');

/**
 * 디렉토리 내 모든 lcov.info 파일을 재귀 탐색
 * @param {string} dir - 탐색 디렉토리
 * @returns {string[]} lcov.info 파일 경로 배열
 */
function findLcovFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...findLcovFiles(full));
    } else if (entry === 'lcov.info') {
      files.push(full);
    }
  }
  return files;
}

/**
 * lcov 파일들을 파싱하여 서비스별 + 전체 커버리지 계산
 * @param {string[]} lcovFiles - lcov.info 경로 배열
 * @returns {{ services: Array<{name: string, linesHit: number, linesTotal: number, branchesHit: number, branchesTotal: number}>, totals: {linesHit: number, linesTotal: number, branchesHit: number, branchesTotal: number} }}
 */
function parseLcovFiles(lcovFiles) {
  let totalLH = 0, totalLF = 0, totalBRH = 0, totalBRF = 0;
  const services = [];

  for (const file of lcovFiles) {
    const content = readFileSync(file, 'utf8');
    let lh = 0, lf = 0, brh = 0, brf = 0;
    for (const line of content.split('\n')) {
      if (line.startsWith('LH:')) lh += Number(line.slice(3));
      if (line.startsWith('LF:')) lf += Number(line.slice(3));
      if (line.startsWith('BRH:')) brh += Number(line.slice(4));
      if (line.startsWith('BRF:')) brf += Number(line.slice(4));
    }
    // 서비스 이름 추출: coverage-{name}/coverage/lcov.info → {name}
    const parts = file.split('/');
    const idx = parts.findIndex(p => p.startsWith('coverage-'));
    const name = idx >= 0 ? parts[idx].replace('coverage-', '') : parts[parts.length - 3] || 'unknown';

    services.push({ name, linesHit: lh, linesTotal: lf, branchesHit: brh, branchesTotal: brf });
    totalLH += lh; totalLF += lf; totalBRH += brh; totalBRF += brf;
  }

  return { services, totals: { linesHit: totalLH, linesTotal: totalLF, branchesHit: totalBRH, branchesTotal: totalBRF } };
}

const lcovFiles = findLcovFiles(coverageDir);
if (lcovFiles.length === 0) {
  process.stdout.write('No lcov.info files found — skipping coverage gate.\n');
  process.exit(0);
}

const { services, totals } = parseLcovFiles(lcovFiles);
const linePct = totals.linesTotal > 0 ? (totals.linesHit / totals.linesTotal * 100) : 0;
const branchPct = totals.branchesTotal > 0 ? (totals.branchesHit / totals.branchesTotal * 100) : 0;

// Markdown 테이블 출력 (GITHUB_STEP_SUMMARY + stdout)
const rows = services.map(s => {
  const lp = s.linesTotal > 0 ? (s.linesHit / s.linesTotal * 100).toFixed(1) : 'N/A';
  const bp = s.branchesTotal > 0 ? (s.branchesHit / s.branchesTotal * 100).toFixed(1) : 'N/A';
  return `| ${s.name} | ${lp}% | ${bp}% |`;
}).join('\n');

const summary = `## Coverage Report

| Service | Lines | Branches |
|---------|-------|----------|
${rows}
| **Total** | **${linePct.toFixed(1)}%** | **${branchPct.toFixed(1)}%** |

Threshold: ${threshold}%`;

process.stdout.write(summary + '\n');

// GITHUB_STEP_SUMMARY 파일에도 출력
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + '\n');
}

// GITHUB_OUTPUT에 PR 코멘트용 body 출력
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `coverage-body<<COVERAGE_EOF\n${summary}\nCOVERAGE_EOF\n`);
}

// 임계치 검증
const pass = linePct >= threshold && branchPct >= threshold;
if (!pass) {
  process.stderr.write(`\nCoverage below ${threshold}%: lines=${linePct.toFixed(1)}%, branches=${branchPct.toFixed(1)}%\n`);
  process.exit(1);
}
process.stdout.write(`\nCoverage gate passed: lines=${linePct.toFixed(1)}%, branches=${branchPct.toFixed(1)}%\n`);
