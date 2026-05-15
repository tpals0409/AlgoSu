#!/usr/bin/env node
/**
 * @file Coverage Gate 우회 부채 점검 스크립트
 * @domain ci
 * @layer script
 * @related .github/workflows/ci.yml, scripts/check-coverage.mjs
 *
 * 최근 N 커밋의 CI run에서 coverage-gate가 SKIPPED 처리된 비율을 분석.
 * paths filter로 변경 없는 서비스의 threshold 검증이 우회되는 패턴 감지.
 *
 * 사용법: node scripts/check-coverage-gate-bypass.mjs [--commits N] [--threshold PCT]
 *   --commits   분석 대상 최근 커밋 수 (기본 10)
 *   --threshold SKIPPED 허용 비율 % (기본 50, 초과 시 exit 1)
 *
 * 필요 환경변수: GITHUB_TOKEN (gh auth 또는 GH_TOKEN)
 */
import { execSync } from 'node:child_process';

const args = process.argv.slice(2);

/**
 * @param {string} flag
 * @param {string} fallback
 * @returns {string}
 */
function getArg(flag, fallback) {
  const idx = args.indexOf(flag);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : fallback;
}

const commitCount = Number(getArg('--commits', '10'));
const warnThreshold = Number(getArg('--threshold', '50'));

const SERVICES = [
  'gateway', 'identity', 'submission', 'problem',
  'github-worker', 'ai-analysis', 'frontend',
];

const COVERAGE_JOBS = ['test-node', 'test-ai-analysis', 'test-frontend', 'coverage-gate'];

/**
 * @param {string} cmd
 * @returns {string}
 */
function run(cmd) {
  return execSync(cmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }).trim();
}

/**
 * @returns {string} owner/repo
 */
function getRepo() {
  const remote = run('git remote get-url origin');
  const match = remote.match(/github\.com[:/](.+?)(?:\.git)?$/);
  if (!match) {
    process.stderr.write(`Cannot parse repo from remote: ${remote}\n`);
    process.exit(2);
  }
  return match[1];
}

/**
 * @param {string} repo
 * @param {number} limit
 * @returns {Array<{sha: string, conclusion: string, id: number, jobs: Array}>}
 */
function fetchRecentRuns(repo, limit) {
  const raw = run(
    `gh api "repos/${repo}/actions/workflows/ci.yml/runs?branch=main&per_page=${limit}&status=completed" --jq '.workflow_runs | map({sha: .head_sha[0:7], conclusion, id: .id})'`
  );
  return JSON.parse(raw);
}

/**
 * @param {string} repo
 * @param {number} runId
 * @returns {Array<{name: string, conclusion: string}>}
 */
function fetchJobs(repo, runId) {
  const raw = run(
    `gh api "repos/${repo}/actions/runs/${runId}/jobs?per_page=100" --jq '.jobs | map({name, conclusion})'`
  );
  return JSON.parse(raw);
}

const repo = getRepo();
process.stdout.write(`Analyzing ${commitCount} recent CI runs for ${repo}...\n\n`);

const runs = fetchRecentRuns(repo, commitCount);

if (runs.length === 0) {
  process.stdout.write('No completed CI runs found.\n');
  process.exit(0);
}

let totalJobs = 0;
let skippedJobs = 0;
const serviceSkipCount = Object.fromEntries(SERVICES.map(s => [s, 0]));

for (const ciRun of runs) {
  const jobs = fetchJobs(repo, ciRun.id);

  for (const jobName of COVERAGE_JOBS) {
    const matched = jobs.filter(j => j.name.toLowerCase().includes(jobName.replace('-', ' ')));
    for (const job of matched) {
      totalJobs++;
      if (job.conclusion === 'skipped') {
        skippedJobs++;
        for (const svc of SERVICES) {
          if (job.name.toLowerCase().includes(svc.replace('-', ' '))) {
            serviceSkipCount[svc]++;
          }
        }
      }
    }
  }
}

const skipPct = totalJobs > 0 ? Math.round((skippedJobs / totalJobs) * 100) : 0;

process.stdout.write(`## Coverage Gate Bypass Analysis\n\n`);
process.stdout.write(`| Metric | Value |\n`);
process.stdout.write(`|--------|-------|\n`);
process.stdout.write(`| CI runs analyzed | ${runs.length} |\n`);
process.stdout.write(`| Coverage-related jobs | ${totalJobs} |\n`);
process.stdout.write(`| SKIPPED jobs | ${skippedJobs} (${skipPct}%) |\n`);
process.stdout.write(`| Warn threshold | ${warnThreshold}% |\n\n`);

process.stdout.write(`### Service Skip Frequency\n\n`);
process.stdout.write(`| Service | Skipped |\n`);
process.stdout.write(`|---------|--------:|\n`);
for (const [svc, count] of Object.entries(serviceSkipCount)) {
  const marker = count > runs.length / 2 ? ' ⚠' : '';
  process.stdout.write(`| ${svc} | ${count}/${runs.length}${marker} |\n`);
}

process.stdout.write('\n');

if (skipPct > warnThreshold) {
  process.stderr.write(
    `[WARN] SKIPPED rate ${skipPct}% exceeds threshold ${warnThreshold}%.\n` +
    `Run weekly full validation: gh workflow run ci-full-validation.yml\n`
  );
  process.exit(1);
}

process.stdout.write(`[OK] SKIPPED rate ${skipPct}% within threshold ${warnThreshold}%.\n`);
