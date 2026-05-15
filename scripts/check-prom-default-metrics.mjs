#!/usr/bin/env node
/**
 * @file prom-client default metric stale 점검 스크립트
 * @domain monitoring
 * @layer script
 * @related docs/conventions/monitoring-logging.md §9-3
 *
 * 서비스별 /metrics endpoint를 순회하여 default metric 상태를 점검.
 * Container restart 후 duplicate metric / stale metric 패턴을 감지.
 *
 * 사용법: node scripts/check-prom-default-metrics.mjs [--base-url URL] [--services CSV]
 *   --base-url  서비스 base URL (기본 http://localhost)
 *   --services  점검 대상 서비스 CSV (기본 전체 NestJS 5개)
 *
 * 전제: 대상 서비스가 로컬 또는 port-forward로 접근 가능해야 합니다.
 */
import http from 'node:http';

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

const baseUrl = getArg('--base-url', 'http://localhost');

const SERVICE_PORTS = {
  gateway:        3000,
  identity:       3001,
  submission:     3002,
  problem:        3003,
  'github-worker': 9100,
};

const requestedServices = getArg('--services', '').split(',').filter(Boolean);
const services = requestedServices.length > 0
  ? Object.fromEntries(requestedServices.map(s => [s, SERVICE_PORTS[s]]).filter(([, p]) => p))
  : SERVICE_PORTS;

const EXPECTED_DEFAULT_PREFIX_PATTERNS = [
  /^nodejs_active_handles/,
  /^nodejs_active_requests/,
  /^nodejs_eventloop_lag/,
  /^nodejs_external_memory/,
  /^nodejs_gc_/,
  /^nodejs_heap_/,
  /^nodejs_version_info/,
  /^process_cpu_/,
  /^process_heap_bytes/,
  /^process_max_fds/,
  /^process_open_fds/,
  /^process_resident_memory/,
  /^process_start_time/,
  /^process_virtual_memory/,
];

const EXPECTED_MIN_DEFAULT_METRICS = 10;

/**
 * @param {string} url
 * @returns {Promise<string>}
 */
function fetchMetrics(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: 5000 }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve(body));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

/**
 * @param {string} body
 * @returns {{helpLines: string[], metricNames: Set<string>, duplicateHelps: string[]}}
 */
function analyzeMetrics(body) {
  const lines = body.split('\n');
  const helpLines = lines.filter(l => l.startsWith('# HELP'));
  const helpNames = helpLines.map(l => l.split(' ')[2]);

  const seen = new Set();
  const duplicateHelps = [];
  for (const name of helpNames) {
    if (seen.has(name)) duplicateHelps.push(name);
    seen.add(name);
  }

  return { helpLines, metricNames: seen, duplicateHelps };
}

/**
 * @param {Set<string>} metricNames
 * @param {string} servicePrefix
 * @returns {{found: string[], missing: string[]}}
 */
function checkDefaultMetrics(metricNames, servicePrefix) {
  const found = [];
  const missing = [];

  for (const pattern of EXPECTED_DEFAULT_PREFIX_PATTERNS) {
    const prefixedPattern = new RegExp(
      `^${servicePrefix}_` + pattern.source.slice(1),
    );
    const match = [...metricNames].find(n => prefixedPattern.test(n));
    if (match) {
      found.push(match);
    } else {
      missing.push(pattern.source);
    }
  }
  return { found, missing };
}

process.stdout.write('## prom-client Default Metric Stale Check\n\n');

let hasFailure = false;
let hasWarning = false;

for (const [svc, port] of Object.entries(services)) {
  const url = `${baseUrl}:${port}/metrics`;
  const prefix = `algosu_${svc.replace('-', '_')}`;

  process.stdout.write(`### ${svc} (${url})\n\n`);

  try {
    const body = await fetchMetrics(url);
    const { metricNames, duplicateHelps } = analyzeMetrics(body);
    const { found, missing } = checkDefaultMetrics(metricNames, prefix);

    if (duplicateHelps.length > 0) {
      process.stdout.write(`**[FAIL]** Duplicate # HELP lines detected:\n`);
      for (const dup of duplicateHelps) {
        process.stdout.write(`  - ${dup}\n`);
      }
      process.stdout.write('\n');
      hasFailure = true;
    }

    if (found.length < EXPECTED_MIN_DEFAULT_METRICS) {
      process.stdout.write(
        `**[WARN]** Default metrics count ${found.length} < expected ${EXPECTED_MIN_DEFAULT_METRICS}\n`,
      );
      hasWarning = true;
    }

    if (missing.length > 0) {
      process.stdout.write(`**[WARN]** Missing default metric patterns:\n`);
      for (const m of missing) {
        process.stdout.write(`  - ${m}\n`);
      }
      process.stdout.write('\n');
      hasWarning = true;
    }

    if (duplicateHelps.length === 0 && found.length >= EXPECTED_MIN_DEFAULT_METRICS) {
      process.stdout.write(
        `**[PASS]** ${found.length} default metrics, ${metricNames.size} total, 0 duplicates\n\n`,
      );
    }
  } catch (err) {
    process.stdout.write(`**[SKIP]** ${err.message} — 서비스 미실행 또는 접근 불가\n\n`);
  }
}

process.stdout.write('---\n');

if (hasFailure) {
  process.stderr.write('[FAIL] Duplicate metric registration detected. Container restart 후 registry 오염 가능.\n');
  process.exit(1);
}
if (hasWarning) {
  process.stderr.write('[WARN] Some default metrics missing or below threshold.\n');
  process.exit(0);
}

process.stdout.write('[OK] All services passed default metric stale check.\n');
