#!/usr/bin/env node
/**
 * @file Grafana dashboard expr ↔ service metric 정의 cross-check 스크립트
 * @domain ci
 * @layer script
 * @related infra/k3s/monitoring/grafana-{cb,service,slo}-dashboard.yaml,
 *          services/{gateway,identity,submission,problem,github-worker}/.../metrics.{ts,service.ts},
 *          services/ai-analysis/src/metrics.py
 *
 * 3개 Grafana dashboard ConfigMap에서 사용되는 algosu_* / algosu:* metric 이름이
 * service 코드에 정의되어 있는지 (또는 prom-client/prometheus_client default 목록에 있는지) 검증.
 * service rename·metric 제거 시 dashboard 미갱신 회귀를 자동 검출.
 *
 * 배경: prometheus-rules.yaml은 alert/recording 정의만 담아 metric SSOT 역할 못 함.
 * service 코드가 metric 노출의 진짜 SSOT — 본 script는 service 코드 정적 분석으로
 * 정의 metric set을 구성하고 dashboard와 cross-check.
 *
 * 사용법: node scripts/check-grafana-metrics.mjs
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');

/**
 * NestJS 4 service의 metrics.service.ts 매핑 (SERVICE_NAME default 검증용)
 * gateway/identity/submission/problem 동일 패턴: collectDefaultMetrics + 4개 HTTP metric.
 */
const NESTJS_HTTP_SERVICES = [
  { name: 'gateway',    file: 'services/gateway/src/common/metrics/metrics.service.ts' },
  { name: 'identity',   file: 'services/identity/src/common/metrics/metrics.service.ts' },
  { name: 'submission', file: 'services/submission/src/common/metrics/metrics.service.ts' },
  { name: 'problem',    file: 'services/problem/src/common/metrics/metrics.service.ts' },
];

/**
 * github-worker는 별도 패턴 (SERVICE_NAME 환경변수 미사용, PREFIX 상수 하드코딩).
 * collectDefaultMetrics + 직접 정의 metric 다수.
 */
const GITHUB_WORKER_FILES = [
  'services/github-worker/src/metrics.ts',
  'services/github-worker/src/circuit-breaker.ts',
];

/**
 * submission/problem은 metrics.service.ts 외에 추가 metric 정의 파일 보유.
 */
const ADDITIONAL_TS_FILES = [
  'services/submission/src/common/circuit-breaker/circuit-breaker.service.ts',
  'services/problem/src/database/dual-write.service.ts',
];

const AI_ANALYSIS_FILE = 'services/ai-analysis/src/metrics.py';

const DASHBOARDS = [
  { file: 'infra/k3s/monitoring/grafana-cb-dashboard.yaml',      key: 'algosu-cb' },
  { file: 'infra/k3s/monitoring/grafana-service-dashboard.yaml', key: 'algosu-service-debug' },
  { file: 'infra/k3s/monitoring/grafana-slo-dashboard.yaml',     key: 'algosu-slo' },
];

const PROMETHEUS_RULES_FILE = 'infra/k3s/monitoring/prometheus-rules.yaml';

/**
 * `__name__=~"<pattern>"` regex 매칭에서 service prefix를 union으로 enumerate할 때 사용.
 * NESTJS_HTTP_SERVICES + github_worker + ai_analysis (모두 underscore 형태).
 */
const KNOWN_SERVICE_PREFIXES = [
  'gateway', 'identity', 'submission', 'problem', 'github_worker', 'ai_analysis',
];

/**
 * prom-client v15.x default metrics 목록.
 * collectDefaultMetrics 호출 시 service prefix가 자동 prepend됨.
 * 출처: https://github.com/siimon/prom-client/blob/v15.1.0/lib/metrics
 */
const PROM_CLIENT_DEFAULTS = [
  'process_cpu_user_seconds_total', 'process_cpu_system_seconds_total',
  'process_cpu_seconds_total', 'process_start_time_seconds',
  'process_resident_memory_bytes', 'process_virtual_memory_bytes',
  'process_heap_bytes', 'process_open_fds', 'process_max_fds',
  'nodejs_eventloop_lag_seconds', 'nodejs_eventloop_lag_min_seconds',
  'nodejs_eventloop_lag_max_seconds', 'nodejs_eventloop_lag_mean_seconds',
  'nodejs_eventloop_lag_stddev_seconds', 'nodejs_eventloop_lag_p50_seconds',
  'nodejs_eventloop_lag_p90_seconds', 'nodejs_eventloop_lag_p99_seconds',
  'nodejs_active_handles_total', 'nodejs_active_resources_total',
  'nodejs_active_requests_total', 'nodejs_heap_size_total_bytes',
  'nodejs_heap_size_used_bytes', 'nodejs_external_memory_bytes',
  'nodejs_heap_space_size_total_bytes', 'nodejs_heap_space_size_used_bytes',
  'nodejs_heap_space_size_available_bytes', 'nodejs_version_info',
  'nodejs_gc_duration_seconds',
];

/** Prometheus Histogram이 자동 생성하는 suffix metric. */
const HISTOGRAM_SUFFIXES = ['_bucket', '_count', '_sum'];

/**
 * Prometheus / kubernetes_sd / prom-client default metric에 자동 부여되는 라벨.
 * dashboard selector에서 이 라벨을 사용해도 source code 정의 검증 대상에서 제외.
 *   - job/instance: prometheus.yml scrape config 부여
 *   - pod/namespace/node/container/service: kubernetes_sd 자동
 *   - le/quantile: Histogram/Summary 자동 차원
 *   - kind/version: prom-client default metric 자체 라벨
 */
const AUTO_LABELS = new Set([
  '__name__', 'job', 'instance',
  'pod', 'namespace', 'node', 'container', 'service',
  'le', 'quantile',
  'kind', 'version',
]);

const definedMetrics = new Set();
/** source code 정의 metric → 등록된 라벨 set. prom-client default + recording rule은 등록 안 함. */
const metricLabels = new Map();

addNestjsHttpServiceMetrics();
addGithubWorkerMetrics();
addAdditionalTsMetrics();
addAiAnalysisMetrics();
addPrometheusRecordingRules();

const { strict, leastOneGroups, labelUsages } = collectDashboardMetrics();

const missingStrict = [...strict].filter((m) => !definedMetrics.has(m)).sort();
const missingLeastOne = leastOneGroups.filter((g) => !g.metrics.some((m) => definedMetrics.has(m)));
const missingLabels = checkLabelUsages(labelUsages);

console.log(`[OK]   defined metrics: ${definedMetrics.size}`);
console.log(`[OK]   dashboard strict metrics: ${strict.size}`);
console.log(`[OK]   dashboard wildcard groups: ${leastOneGroups.length}`);
console.log(`[OK]   dashboard label usages: ${labelUsages.length}`);

if (missingStrict.length > 0 || missingLeastOne.length > 0 || missingLabels.length > 0) {
  if (missingStrict.length > 0) {
    console.error(`\n[FAIL] ${missingStrict.length} strict metric(s) not defined in service code:`);
    for (const m of missingStrict) console.error(`  - ${m}`);
  }
  if (missingLeastOne.length > 0) {
    console.error(`\n[FAIL] ${missingLeastOne.length} wildcard pattern(s) match no defined service:`);
    for (const g of missingLeastOne) console.error(`  - pattern '${g.pattern}' (no match in any of: ${g.metrics.join(', ')})`);
  }
  if (missingLabels.length > 0) {
    console.error(`\n[FAIL] ${missingLabels.length} dashboard selector(s) use label not registered on metric:`);
    for (const u of missingLabels) {
      console.error(`  - [${u.dashKey}] ${u.metric}{${u.label}=...} (selector: ${u.source}) — defined labels: [${[...(metricLabels.get(u.metric) ?? [])].join(', ') || '(none)'}]`);
    }
  }
  console.error('\nPossible causes:');
  console.error('  1. service code rename·metric 제거 후 dashboard 미갱신');
  console.error('  2. dashboard metric 이름 오타');
  console.error('  3. service code에서 labelNames/labelnames 변경 후 dashboard selector 미갱신');
  console.error('  4. 신규 default metric (prom-client/prometheus_client 버전 업)');
  console.error('     → 위 PROM_CLIENT_DEFAULTS 목록을 갱신');
  console.error('  5. AUTO_LABELS skip list 갱신 필요 (Prometheus/k8s_sd/exporter 신규 자동 라벨)');
  process.exit(1);
}

console.log('\nAll dashboard metrics + labels are defined in service code.');
process.exit(0);

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

/**
 * NestJS 4 service의 metrics.service.ts에서 prefix + HTTP metric + default metric 등록.
 * SERVICE_NAME default 값을 service 디렉토리 이름과 비교 검증.
 */
function addNestjsHttpServiceMetrics() {
  for (const svc of NESTJS_HTTP_SERVICES) {
    const content = readFileSync(resolve(ROOT, svc.file), 'utf-8');
    const envMatch = content.match(/process\.env\[['"]SERVICE_NAME['"]\]\s*\?\?\s*['"](\w+)['"]/);
    if (!envMatch || envMatch[1] !== svc.name) {
      throw new Error(`SERVICE_NAME default mismatch in ${svc.file} (expected '${svc.name}')`);
    }
    const prefix = `algosu_${svc.name}`;
    const httpMetricMatches = [...content.matchAll(/name:\s*`\$\{prefix\}_([a-zA-Z0-9_]+)`/g)];
    for (let i = 0; i < httpMetricMatches.length; i++) {
      const m = httpMetricMatches[i];
      const metric = `${prefix}_${m[1]}`;
      addMetricWithHistogramSuffixes(metric, m[1]);
      registerMetricLabels(metric, extractLabelsFromBlock(content, m.index, httpMetricMatches[i + 1]?.index));
    }
    if (content.includes('collectDefaultMetrics')) {
      for (const dm of PROM_CLIENT_DEFAULTS) definedMetrics.add(`${prefix}_${dm}`);
    }
  }
}

/**
 * github-worker의 metrics.ts + circuit-breaker.ts 정의 metric 등록.
 * PREFIX 상수 하드코딩 패턴.
 */
function addGithubWorkerMetrics() {
  const prefix = 'algosu_github_worker';
  let hasDefaults = false;
  for (const file of GITHUB_WORKER_FILES) {
    const content = readFileSync(resolve(ROOT, file), 'utf-8');
    if (content.includes('collectDefaultMetrics')) hasDefaults = true;
    const tplMatches = [...content.matchAll(/name:\s*`\$\{PREFIX\}_([a-zA-Z0-9_]+)`/g)];
    for (let i = 0; i < tplMatches.length; i++) {
      const m = tplMatches[i];
      const metric = `${prefix}_${m[1]}`;
      addMetricWithHistogramSuffixes(metric, m[1]);
      registerMetricLabels(metric, extractLabelsFromBlock(content, m.index, tplMatches[i + 1]?.index));
    }
    addLiteralMetrics(content, prefix);
  }
  if (hasDefaults) {
    for (const dm of PROM_CLIENT_DEFAULTS) definedMetrics.add(`${prefix}_${dm}`);
  }
}

/**
 * submission/circuit-breaker, problem/dual-write 등 추가 TS 정의 파일 처리.
 * 패턴: name: 'algosu_xxx' literal.
 */
function addAdditionalTsMetrics() {
  for (const file of ADDITIONAL_TS_FILES) {
    const content = readFileSync(resolve(ROOT, file), 'utf-8');
    addLiteralMetrics(content, null);
  }
}

/**
 * ai-analysis/metrics.py — Python prometheus_client name="algosu_ai_analysis_xxx" 패턴.
 * Python default metric은 prefix 없이 등록되어 dashboard 검증 대상 외.
 */
function addAiAnalysisMetrics() {
  const content = readFileSync(resolve(ROOT, AI_ANALYSIS_FILE), 'utf-8');
  const matches = [...content.matchAll(/name=["'](algosu_[a-zA-Z0-9_]+)["']/g)];
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const isHistogram = checkHistogramContext(content, m.index);
    addMetricWithHistogramSuffixes(m[1], isHistogram ? 'histogram' : '');
    registerMetricLabels(m[1], extractLabelsFromBlock(content, m.index, matches[i + 1]?.index));
  }
}

/**
 * prometheus-rules.yaml의 recording rules(`record:` field) → algosu:* metric을 정의 set에 추가.
 * 본 스크립트는 service code SSOT 원칙을 따르나, recording rule은 prometheus-rules.yaml이 정의 SSOT.
 * dashboard가 recording rule을 참조해도 false positive가 발생하지 않도록 함.
 */
function addPrometheusRecordingRules() {
  const content = readFileSync(resolve(ROOT, PROMETHEUS_RULES_FILE), 'utf-8');
  const matches = content.matchAll(/^\s*-\s*record:\s*(\S+)\s*$/gm);
  for (const m of matches) definedMetrics.add(m[1]);
}

/**
 * 'algosu_xxx' literal 패턴 추출 — Counter/Histogram/Gauge 컨텍스트 감지하여 suffix 처리.
 */
function addLiteralMetrics(content, expectedPrefix) {
  const matches = [...content.matchAll(/name:\s*['"](algosu_[a-zA-Z0-9_]+)['"]/g)];
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    if (expectedPrefix && !m[1].startsWith(expectedPrefix)) continue;
    const isHistogram = checkHistogramContext(content, m.index);
    addMetricWithHistogramSuffixes(m[1], isHistogram ? 'histogram' : '');
    registerMetricLabels(m[1], extractLabelsFromBlock(content, m.index, matches[i + 1]?.index));
  }
}

/**
 * Histogram일 경우 _bucket/_count/_sum 자동 등록.
 * suffixHint가 'histogram' 또는 metric 이름이 *_seconds(duration) 형태면 Histogram으로 간주.
 */
function addMetricWithHistogramSuffixes(metric, suffixHint) {
  definedMetrics.add(metric);
  if (suffixHint === 'histogram' || metric.endsWith('_duration_seconds')) {
    for (const sfx of HISTOGRAM_SUFFIXES) definedMetrics.add(`${metric}${sfx}`);
  }
}

/**
 * 주어진 위치 직전의 컨텍스트(±300자)에서 Histogram 키워드 감지.
 */
function checkHistogramContext(content, idx) {
  const start = Math.max(0, idx - 300);
  const ctx = content.slice(start, idx);
  return /\bnew\s+Histogram\b|\bHistogram\s*\(/.test(ctx);
}

/**
 * 3개 dashboard YAML에서 ConfigMap inline JSON을 추출하여 algosu metric 수집.
 */
/**
 * dashboard에서 사용하는 metric 후보를 두 가지 모드로 수집.
 *   - strict: 모두 정의되어야 함 (literal metric 참조 + exact __name__ + union __name__=~)
 *   - leastOneGroups: 그룹 중 적어도 1개가 정의되면 OK (wildcard __name__=~"algosu_.+_xxx")
 *
 * wildcard pattern을 strict로 다루면 일부 service가 metric을 노출하지 않는 정상 케이스도
 * fail 처리됨 (예: github-worker는 일반 HTTP 처리 안 함, ai-analysis는 Python이라 nodejs metric 없음).
 * dashboard 의도("있는 service의 metric만 보여줘") 보존을 위해 least-one 모드 채택.
 */
function collectDashboardMetrics() {
  const strict = new Set();
  const leastOneGroups = [];
  const labelUsages = [];
  for (const dash of DASHBOARDS) {
    const content = readFileSync(resolve(ROOT, dash.file), 'utf-8');
    const json = extractInlineBlock(content, `${dash.key}.json`);
    if (!json) {
      console.error(`[FAIL] could not extract ${dash.key}.json from ${dash.file}`);
      process.exit(1);
    }
    const obj = JSON.parse(json);
    const exprs = [];
    walkExprs(obj, exprs);
    for (const expr of exprs) {
      const normalized = normalizeExprForSelectorParse(expr);
      collectNameSelectorMetrics(normalized, strict, leastOneGroups, labelUsages, dash.key);
      collectLiteralMetricsAndLabels(normalized, strict, labelUsages, dash.key);
    }
  }
  return { strict, leastOneGroups, labelUsages };
}

/**
 * `{__name__=<op>"<pattern>", ...}` selector를 처리하여 strict / leastOneGroups에 추가.
 *   - exact `="x"` / `!="x"` → strict
 *   - union `=~"algosu_(a|b|c)_xxx"` → 3개 모두 strict (모든 service가 metric을 노출해야 함)
 *   - wildcard `=~"algosu_.+_xxx"` → leastOneGroup (1+ service만 노출하면 OK)
 *   - 기타 정규식 패턴 → 무시 (false positive 회피)
 */
function collectNameSelectorMetrics(expr, strict, leastOneGroups, labelUsages, dashKey) {
  const matches = expr.matchAll(/\{([^{}]*__name__\s*(?:=~|!~|=|!=)\s*"[^"]+"[^{}]*)\}/g);
  for (const m of matches) {
    const selectorBody = m[1];
    const nameMatch = selectorBody.match(/__name__\s*(=~|!~|=|!=)\s*"([^"]+)"/);
    if (!nameMatch) continue;
    const op = nameMatch[1];
    const pattern = nameMatch[2];

    let referencedMetrics = [];
    if (op === '=' || op === '!=') {
      strict.add(pattern);
      referencedMetrics = [pattern];
    } else {
      const expansion = expandRegexMetricPattern(pattern);
      if (expansion.kind === 'union') {
        for (const e of expansion.metrics) strict.add(e);
        referencedMetrics = expansion.metrics;
      } else if (expansion.kind === 'wildcard') {
        leastOneGroups.push({ pattern, metrics: expansion.metrics });
        referencedMetrics = expansion.metrics;
      }
    }

    const labels = extractSelectorLabels(selectorBody);
    for (const metric of referencedMetrics) {
      for (const label of labels) {
        labelUsages.push({ metric, label, dashKey, source: `__name__${op}"${pattern}"` });
      }
    }
  }
}

/**
 * dashboard expr 안의 literal `algosu_xxx{labels}` (또는 라벨 없이 `algosu_xxx`) 패턴 수집.
 * `__name__=~` selector 형태는 collectNameSelectorMetrics에서 처리하므로 본 함수는 literal만 처리.
 *   - `algosu_xxx_total{name=~"$name"}` → strict=`algosu_xxx_total` + labelUsage{ metric, label='name' }
 *   - `algosu_xxx_total` → strict=`algosu_xxx_total` (라벨 사용 0건)
 */
function collectLiteralMetricsAndLabels(expr, strict, labelUsages, dashKey) {
  const matches = expr.matchAll(/\b(algosu[_:][a-zA-Z0-9_:]+)(\{([^{}]*)\})?/g);
  for (const m of matches) {
    const metric = m[1];
    strict.add(metric);
    if (!m[3]) continue;
    if (m[3].includes('__name__')) continue;
    const labels = extractSelectorLabels(m[3]);
    for (const label of labels) {
      labelUsages.push({ metric, label, dashKey, source: `${metric}{...}` });
    }
  }
}

/**
 * Prometheus selector body에서 사용된 라벨 이름 set 추출.
 *   - `name=~"$name", status_code=~"5..", job="gateway"` → ['name', 'status_code', 'job']
 *   - `__name__=~"..."` 자체는 metric 이름 selector이므로 제외
 *   - 연산자: `=`, `!=`, `=~`, `!~`
 */
function extractSelectorLabels(selectorBody) {
  const labels = new Set();
  const re = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*(=~|!~|=|!=)\s*"[^"]*"/g;
  for (const m of selectorBody.matchAll(re)) {
    if (m[1] === '__name__') continue;
    labels.add(m[1]);
  }
  return labels;
}

/**
 * dashboard label 사용 usage를 source code 정의 라벨과 cross-check.
 *   - usage.metric이 metricLabels에 등록되어 있고 (즉 source code 정의 metric)
 *   - usage.label이 metric의 등록 라벨 set에 없으며
 *   - usage.label이 AUTO_LABELS skip list에도 없으면 → missing
 * prom-client default metric(metricLabels 미등록) + recording rule + algosu prefix 외 metric은 검증 skip.
 */
function checkLabelUsages(labelUsages) {
  const seen = new Set();
  const missing = [];
  for (const u of labelUsages) {
    if (AUTO_LABELS.has(u.label)) continue;
    if (!metricLabels.has(u.metric)) continue;
    const defined = metricLabels.get(u.metric);
    if (defined.has(u.label)) continue;
    const dedupKey = `${u.metric}|${u.label}|${u.dashKey}`;
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);
    missing.push(u);
  }
  return missing;
}

/**
 * source code 정의 metric에 라벨 set 등록.
 * Histogram의 `_bucket`/`_count`/`_sum` suffix metric에도 동일 라벨 등록 (Prometheus 시리즈 차원 일관).
 */
function registerMetricLabels(metric, labels) {
  if (labels.size === 0 && !metricLabels.has(metric)) {
    metricLabels.set(metric, new Set());
  }
  if (labels.size > 0) {
    if (!metricLabels.has(metric)) metricLabels.set(metric, new Set());
    for (const l of labels) metricLabels.get(metric).add(l);
    for (const sfx of HISTOGRAM_SUFFIXES) {
      const suffixed = `${metric}${sfx}`;
      if (definedMetrics.has(suffixed)) {
        if (!metricLabels.has(suffixed)) metricLabels.set(suffixed, new Set());
        for (const l of labels) metricLabels.get(suffixed).add(l);
      }
    }
  }
}

/**
 * metric `name:` 매치 위치부터 다음 metric 정의 시작 직전까지(또는 +800자) 슬라이스에서
 * `labelNames: ['a', 'b']` (TS) / `labelnames=["a", "b"]` (Python) 추출.
 * 추출 실패 시 빈 set 반환 (라벨 없는 metric, 예: Gauge 단일 차원).
 */
/**
 * Grafana 변수/PromQL regex quantifier가 selector wrapper 매칭 정규식 `[^{}]*`의
 * 경계를 끊어 selector 추출이 누락되는 false negative를 차단한다 (Critic R1 P2):
 *   - `${var}` Grafana variable의 inner `}` (예: `job="${service}"`)
 *   - quoted regex value 내부 brace (예: `status_code=~"5[0-9]{2}"`)
 *
 * 두 케이스 모두 selector wrapper 외부 brace와 의미적으로 분리되어 있으므로
 * placeholder/대체문자로 normalize 후 파싱한다. 라벨 name 추출은 따옴표 외부에서만
 * 일어나므로 quoted value 내부의 brace를 `_`로 치환해도 검증 정확도 영향 없음.
 *   - `{__name__=~"x", job="${svc}", status_code=~"5[0-9]{2}"}`  ← 원본
 *   - `{__name__=~"x", job="__GRAFANA_VAR__", status_code=~"5[0-9]_2_"}` ← 치환
 */
function normalizeExprForSelectorParse(expr) {
  return expr
    .replace(/\$\{[^{}]+\}/g, '__GRAFANA_VAR__')
    .replace(/"([^"]*)"/g, (_match, inner) => `"${inner.replace(/[{}]/g, '_')}"`);
}

function extractLabelsFromBlock(content, startIdx, nextMetricIdx) {
  const end = nextMetricIdx ?? Math.min(content.length, startIdx + 800);
  const block = content.slice(startIdx, end);
  const tsMatch = block.match(/labelNames\s*:\s*\[([^\]]*)\]/);
  const pyMatch = block.match(/labelnames\s*=\s*\[([^\]]*)\]/);
  const arrayBody = tsMatch?.[1] ?? pyMatch?.[1];
  if (!arrayBody) return new Set();
  const labels = new Set();
  for (const m of arrayBody.matchAll(/['"]([a-zA-Z_][a-zA-Z0-9_]*)['"]/g)) {
    labels.add(m[1]);
  }
  return labels;
}

/**
 * Prometheus regex metric 패턴을 service prefix로 expansion.
 *   - `algosu_(a|b|c)_xxx` → kind='union', 3개 metric (모두 정의되어야 함)
 *   - `algosu_.+_xxx` → kind='wildcard', KNOWN_SERVICE_PREFIXES 6개 (1+ 정의되면 OK)
 *   - 기타 → kind='none', 빈 배열 (검증 skip)
 */
function expandRegexMetricPattern(pattern) {
  const unionMatch = pattern.match(/^algosu_\(([a-z_|]+)\)_(.+)$/);
  if (unionMatch) {
    return {
      kind: 'union',
      metrics: unionMatch[1].split('|').map((s) => `algosu_${s}_${unionMatch[2]}`),
    };
  }
  const wildcardMatch = pattern.match(/^algosu_\.\+_(.+)$/);
  if (wildcardMatch) {
    return {
      kind: 'wildcard',
      metrics: KNOWN_SERVICE_PREFIXES.map((s) => `algosu_${s}_${wildcardMatch[1]}`),
    };
  }
  return { kind: 'none', metrics: [] };
}

/**
 * ConfigMap data section의 `<key>: |` block에서 inline 본문(yaml/json)을 indent strip하여 반환.
 */
function extractInlineBlock(content, key) {
  const lines = content.split('\n');
  const startIdx = lines.findIndex((l) => l.includes(`${key}: |`));
  if (startIdx === -1) return null;
  const baseIndent = '    ';
  const out = [];
  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith(baseIndent)) out.push(line.slice(baseIndent.length));
    else if (line.trim() === '') out.push('');
    else break;
  }
  return out.join('\n');
}

/**
 * dashboard JSON 트리를 순회하며 expr/definition/query 문자열 수집.
 */
function walkExprs(node, out) {
  if (Array.isArray(node)) {
    for (const item of node) walkExprs(item, out);
    return;
  }
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if ((k === 'expr' || k === 'definition') && typeof v === 'string') out.push(v);
      else if (k === 'query') {
        if (typeof v === 'string') out.push(v);
        else if (v && typeof v === 'object' && typeof v.query === 'string') out.push(v.query);
      }
      walkExprs(v, out);
    }
  }
}
