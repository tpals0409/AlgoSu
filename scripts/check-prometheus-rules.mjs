#!/usr/bin/env node
/**
 * @file Prometheus alert/recording rules syntax 검증 스크립트
 * @domain ci
 * @layer script
 * @related aether-gitops algosu/base/monitoring/prometheus-rules.yaml (MONITORING_SRC)
 *
 * 운영 SSOT(aether-gitops)의 `prometheus-rules.yaml`(ConfigMap inline yaml)에서
 * `data['algosu-alerts.yml']` 본문을 추출하여 `promtool check rules`로 검증한다.
 * 검증 경로는 MONITORING_SRC env로 주입(ADR-029).
 *
 * 배경: rules.yaml 자체 syntax/구조 결함이 운영 stack 적용 시점까지 발견되지 않는 부채.
 * Sprint 143 회고에서 식별된 monitoring stack 정합성 부채 — 본 검증으로 회귀 차단.
 *
 * 사용법: node scripts/check-prometheus-rules.mjs
 * 사전 요구: promtool (Prometheus binary)이 PATH에 있어야 함. CI에서는 install step이 선행됨.
 */
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

const ROOT = resolve(import.meta.dirname, '..');
// 검증 대상은 운영 SSOT(aether-gitops). CI는 MONITORING_SRC로 aether monitoring 경로 주입.
// 미설정 시 로컬 폴백(레포 내 미러). ADR-029: 미러 폐기 후엔 MONITORING_SRC 필수.
const MONITORING_SRC = process.env.MONITORING_SRC ?? resolve(ROOT, 'infra/k3s/monitoring');
const RULES_PATH = resolve(MONITORING_SRC, 'prometheus-rules.yaml');
const RULES_KEY = 'algosu-alerts.yml';

let exitCode = 0;
let tmpFile = null;

try {
  const content = readFileSync(RULES_PATH, 'utf-8');
  const extracted = extractInlineYaml(content, RULES_KEY);

  if (!extracted) {
    console.error(`[FAIL] ${RULES_KEY} block not found in ${RULES_PATH}`);
    process.exit(1);
  }

  console.log(`[OK]   extracted ${extracted.split('\n').length} lines from ${RULES_KEY}`);

  tmpFile = resolve(tmpdir(), `prometheus-rules-${process.pid}.yml`);
  writeFileSync(tmpFile, extracted, 'utf-8');

  const result = spawnSync('promtool', ['check', 'rules', tmpFile], {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.error) {
    console.error(`[FAIL] failed to spawn promtool: ${result.error.message}`);
    console.error('       hint: install Prometheus binary or run via CI step');
    exitCode = 1;
  } else {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.status !== 0) {
      console.error(`[FAIL] promtool check rules exited with status ${result.status}`);
      exitCode = 1;
    } else {
      console.log('[OK]   promtool check rules: SUCCESS');
    }
  }
} finally {
  if (tmpFile) {
    try { unlinkSync(tmpFile); } catch { /* ignore cleanup errors */ }
  }
}

if (exitCode === 0) {
  console.log('\nPrometheus rules syntax validation passed.');
} else {
  console.error('\nPrometheus rules syntax validation failed. See errors above.');
}

process.exit(exitCode);

/**
 * ConfigMap의 `data['<key>']: |` block에서 inline yaml 본문을 추출한다.
 * 4-space indent를 strip하여 standalone yaml로 변환.
 *
 * @param {string} content ConfigMap yaml 전체
 * @param {string} key data section의 inline yaml 키 (e.g. 'algosu-alerts.yml')
 * @returns {string | null} indent-stripped yaml 본문, 키 부재 시 null
 */
function extractInlineYaml(content, key) {
  const lines = content.split('\n');
  const startIdx = lines.findIndex((line) => line.includes(`${key}: |`));
  if (startIdx === -1) return null;

  const baseIndent = '    ';
  const out = [];
  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith(baseIndent)) {
      out.push(line.slice(baseIndent.length));
    } else if (line.trim() === '') {
      out.push('');
    } else {
      break;
    }
  }
  return out.join('\n');
}
