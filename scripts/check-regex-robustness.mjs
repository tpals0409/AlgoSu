#!/usr/bin/env node
/**
 * @file scripts/check-regex-robustness.mjs
 * @domain ci
 * @layer script
 * @related docs/runbook/regex-robustness.md, scripts/check-grafana-metrics.mjs
 *
 * RUNBOOK §2.1~2.4의 4종 regex 강건성 체크리스트를 정적 분석으로 자동화.
 * Sprint 145~148 Critic R1/R2 P2 4건 누적 패턴 회귀 차단.
 *
 * Rule 1 — | 연산자 우선순위 (RUNBOOK §2.1)
 * Rule 2 — Character class 일관성 (RUNBOOK §2.2)
 * Rule 3 — Quantifier inner brace (RUNBOOK §2.3)
 * Rule 4 — Prefix anchoring / format suffix (RUNBOOK §2.4)
 *
 * 면제: 해당 라인 끝에 `// regex-lint: allow-rule-N` 주석 추가 (N = 1,2,3,4)
 * 사용법: node scripts/check-regex-robustness.mjs
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');

const TARGET_FILES = [
  'scripts/check-grafana-metrics.mjs',
  'scripts/check-prometheus-rules.mjs',
  'scripts/check-mock-coverage.mjs',
  'scripts/check-coverage.mjs',
];

// ──────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────

const allViolations = [];

for (const relPath of TARGET_FILES) {
  const violations = analyzeFile(resolve(ROOT, relPath), relPath);
  allViolations.push(...violations);
}

const fixtureResult = runRegressionFixtures();
if (!fixtureResult.ok) {
  console.error(`[FAIL] Self-test failed: ${fixtureResult.message}`);
  process.exit(2);
}
console.log(`[OK]   regression fixtures: ${fixtureResult.count} sprint seeds, all detected`);

if (allViolations.length > 0) {
  console.error(`\n[FAIL] ${allViolations.length} regex robustness violation(s):`);
  for (const v of allViolations) {
    console.error(`  [${v.rule}] ${v.file}:${v.line} — ${v.message}`);
    console.error(`         ${v.detail}`);
  }
  console.error('\nSee docs/runbook/regex-robustness.md for fix guidance.');
  process.exit(1);
}

console.log('[OK]   regex robustness: no violations');
process.exit(0);

// ──────────────────────────────────────────────────────────────────
// File analyzer
// ──────────────────────────────────────────────────────────────────

function analyzeFile(absPath, relPath) {
  const content = readFileSync(absPath, 'utf-8');
  const lines = content.split('\n');
  const violations = [];

  // Rule 3: 파일 전체 분석
  const r3 = checkRule3(content);
  if (r3) violations.push({ rule: 'Rule-3', file: relPath, line: 0, message: r3, detail: '(file-level)' });

  let inBlockComment = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNo = i + 1;

    // 블록 주석(/** */ / /* */) 내부 라인 skip
    if (line.includes('/*')) inBlockComment = true;
    if (inBlockComment) {
      if (line.includes('*/')) inBlockComment = false;
      continue;
    }
    // 단일 라인 주석 skip
    if (/^\s*\/\//.test(line)) continue;

    const allowedRules = parseAllowDirective(line);
    const regexes = extractRegexLiterals(line);

    for (const pattern of regexes) {
      if (!allowedRules.has('1')) {
        const msg = checkRule1(pattern);
        if (msg) violations.push({ rule: 'Rule-1', file: relPath, line: lineNo, message: msg, detail: `/${pattern}/` });
      }
      if (!allowedRules.has('2')) {
        const msg = checkRule2(pattern, lines, i);
        if (msg) violations.push({ rule: 'Rule-2', file: relPath, line: lineNo, message: msg, detail: `/${pattern}/` });
      }
      if (!allowedRules.has('4')) {
        const msg = checkRule4(pattern, line);
        if (msg) violations.push({ rule: 'Rule-4', file: relPath, line: lineNo, message: msg, detail: `/${pattern}/` });
      }
    }
  }

  return violations;
}

// ──────────────────────────────────────────────────────────────────
// Regex literal extractor
// ──────────────────────────────────────────────────────────────────

/**
 * 단일 라인에서 regex literal /.../flags source 배열 반환.
 * 앞에 연산자/구두점이 오는 경우만 regex로 간주 (나누기 연산자 오인 방지).
 */
function extractRegexLiterals(line) {
  const results = [];
  const re = /(?:=\s*|[|(,;:[\s]\s*)\/((?:[^/\\\n]|\\.)+)\/[gimsuy]*/g;
  let m;
  while ((m = re.exec(line)) !== null) {
    results.push(m[1]);
  }
  return results;
}

function parseAllowDirective(line) {
  const m = line.match(/\/\/\s*regex-lint:\s*allow-rule-([\d,]+)/);
  if (!m) return new Set();
  return new Set(m[1].split(',').map((s) => s.trim()));
}

/** 문자 클래스 [...] 내부 제거 (연산자 우선순위 분석용) */
function stripCharacterClasses(pattern) {
  return pattern.replace(/\[[^\]]*\]/g, '');
}

/**
 * 최상위 depth(그룹 외부)에서 | 기준으로 alternatives 분리.
 * 이스케이프(\x)와 그룹 depth를 추적하여 그룹 내부의 |는 분리 기준에서 제외.
 */
function splitAtTopLevel(pattern) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === '\\') { current += ch + (pattern[i + 1] ?? ''); i++; continue; }
    if (ch === '(') { depth++; current += ch; continue; }
    if (ch === ')') { depth--; current += ch; continue; }
    if (ch === '|' && depth === 0) { parts.push(current); current = ''; continue; }
    current += ch;
  }
  if (current) parts.push(current);
  return parts;
}

/**
 * alternative가 안전한 anchor를 가지는지 확인.
 * 안전 anchor: \b, ^, \$, ${, \{, (, (?:
 * → word boundary / line anchor / dollar / brace / group 시작
 */
function hasAnchor(alt) {
  const t = alt.trim();
  return (
    t.startsWith('\\b') ||   // word boundary
    t.startsWith('^') ||      // line start
    t.startsWith('\\$') ||    // $ escape
    t.startsWith('${') ||     // grafana variable $ prefix
    t.startsWith('\\{') ||    // \{ selector
    t.startsWith('(?:') ||    // non-capturing group
    t.startsWith('(')         // capturing group
  );
}

// ──────────────────────────────────────────────────────────────────
// Rule 1 — | 연산자 우선순위 (RUNBOOK §2.1)
// ──────────────────────────────────────────────────────────────────

/**
 * depth-0에서 | 기준으로 alternatives를 분리하고,
 * 하나라도 anchor 없는 alternative가 있으면 위험으로 판정.
 *
 * 안전 예: /(?:foo|bar)/, /^\bfoo\b|\bbar\b/
 * 위험 예: /algosu:.*availability|success_rate/
 */
function checkRule1(pattern) {
  const stripped = stripCharacterClasses(pattern);
  const parts = splitAtTopLevel(stripped);
  if (parts.length <= 1) return null; // depth-0 | 없음 — 안전

  const unsafe = parts.filter((p) => !hasAnchor(p));
  if (unsafe.length === 0) return null;

  return `| 연산자에 anchor 없는 alternative 존재: [${unsafe.map((u) => `'${u.trim()}'`).join(', ')}] — prefix 없는 alternative가 의도치 않은 전역 매칭 위험 (RUNBOOK §2.1)`;
}

// ──────────────────────────────────────────────────────────────────
// Rule 2 — Character class 일관성 (RUNBOOK §2.2)
// ──────────────────────────────────────────────────────────────────

/**
 * `metricNamePattern`, `metricPattern`, `__name__` 이 포함된 라인 컨텍스트(±3)에서
 * digit [0-9] 누락 alpha-only character class 검출.
 * false positive 방지를 위해 컨텍스트를 명시적 Prometheus metric 이름 관련 식별자로 제한.
 */
function checkRule2(pattern, lines, lineIdx) {
  // Prometheus metric name 명세 [a-zA-Z_][a-zA-Z0-9_]* 는 정확히 두 character class의
  // **인접 결합** 패턴 (leading anchor + name continuation). 따라서:
  //   - 첫 alpha-only class 직후가 quantifier(*/+/?)만 사이에 두고 digit class 인접 → 안전
  //   - 그 외 alpha-only class 단독 또는 사이에 다른 토큰(_status_ 등)이 들어간 비-인접 형태 → 위반
  // (Critic R1 P2 fix: 첫 class만 검사 시 valid 패턴 false positive 해소)
  // (Critic R2 P2 fix: 무관 digit class로 면제 시 false negative — 예: /[a-z_]+_status_[0-9]{3}/)
  const allClasses = [...pattern.matchAll(/\[[^\]]+\]/g)];
  // negated class([^...])는 검사 대상 외 (예: [^{}]는 selector wrapper용)
  const firstAlphaIdx = allClasses.findIndex(
    (m) => !m[0].startsWith('[^') && !/[0-9]/.test(m[0]),
  );
  if (firstAlphaIdx === -1) return null; // alpha-only class 없음 → skip

  const firstAlpha = allClasses[firstAlphaIdx];
  const next = allClasses[firstAlphaIdx + 1];
  if (next) {
    const between = pattern.slice(firstAlpha.index + firstAlpha[0].length, next.index);
    // 인접 + 직후 class가 alphanumeric (alpha 와 digit 동시 포함) → Prometheus 명세 매칭 → 안전.
    // digit-only [0-9]는 명세 [a-zA-Z0-9_] 매칭 아님 → 여전히 metric-name continuation 미매칭 위험
    // (Critic R3 P2: digit-only 직후 class도 면제 처리 시 /algosu_[a-z_]+[0-9]{3}/ false negative).
    const isAlnumContinuation = /[a-zA-Z]/.test(next[0]) && /[0-9]/.test(next[0]);
    if (/^[?*+]?$/.test(between) && isAlnumContinuation) return null;
  }

  // 좁은 컨텍스트: 현재 라인에 명시적 Prometheus metric name 관련 식별자 존재 필수.
  // ±3라인 범위로 넓히면 __name__ 가드 코드(if m[1] === '__name__')가 있는 근처 라인에서
  // label 추출 regex가 false positive로 검출됨.
  const currentLine = lines[lineIdx];
  if (!/metricNamePattern|metricPattern|__name__/.test(currentLine)) return null;

  return 'Prometheus metric name 컨텍스트에서 character class에 digit [0-9] 누락 — algosu_..._2xx_total 등 숫자 포함 metric 미매칭 위험 (RUNBOOK §2.2)';
}

// ──────────────────────────────────────────────────────────────────
// Rule 3 — Quantifier inner brace (RUNBOOK §2.3)
// ──────────────────────────────────────────────────────────────────

/**
 * 파일 전체에서 selector wrapper [^{}]* + quantifier {N} 공존 + normalize 헬퍼 없음 → 위험.
 */
function checkRule3(content) {
  if (!content.includes('[^{}]*')) return null;
  if (!/\{(\d+)(?:,\d*)?\}/.test(content)) return null;
  if (/normalizeExprForSelectorParse|__QUANTIFIER__|__GRAFANA_VAR__/.test(content)) return null;

  return '[^{}]* selector wrapper와 {N} quantifier 공존 — normalize 헬퍼 없으면 inner brace로 selector 추출 끊김 위험 (RUNBOOK §2.3)';
}

// ──────────────────────────────────────────────────────────────────
// Rule 4 — Prefix anchoring / format suffix (RUNBOOK §2.4)
// ──────────────────────────────────────────────────────────────────

/**
 * Rule 4-A: Grafana variable 추출 정규식에 :format optional capture 누락
 *   위험: \$\{([a-zA-Z_][a-zA-Z0-9_]*)\}  ← :format suffix 미인식
 *   안전: \$\{([...])(?::[^}]*)?\}  또는  \$\{[^{}]+\} (전체 치환, no capture)
 *
 *   false positive 방지: `name:` 키워드가 같은 라인에 있으면 JS template literal
 *   내부의 service metric 이름 정의이므로 skip.
 *
 * Rule 4-B: wildcard .+ 에 metric 컨텍스트에서 prefix anchor 없음
 */
function checkRule4(pattern, line) {
  // Rule 4-A
  if (pattern.includes('\\$\\{') || pattern.includes('\\$\\/\\{')) {
    const hasCapture = /\([^)]+\)/.test(pattern);
    const hasFormatOptional = pattern.includes('(?::[^}]') || pattern.includes('(?::[^\\}]');
    const isFullReplace = pattern.includes('[^{}]');

    // service metric name 정의 라인은 JS template literal — skip
    const isMetricNameDef = /\bname\s*:/.test(line);

    if (hasCapture && !hasFormatOptional && !isFullReplace && !isMetricNameDef) {
      return 'Grafana variable 추출 정규식에 :format optional capture 누락 — ${var:format} 구문 false negative 위험 (RUNBOOK §2.4)';
    }
  }

  // Rule 4-B
  const stripped = stripCharacterClasses(pattern);
  if (stripped.includes('.+')) {
    const hasAnchorB = (
      pattern.startsWith('^') ||
      pattern.includes('algosu_') ||
      pattern.includes('\\balgosu') ||
      /^\^/.test(pattern)
    );
    if (!hasAnchorB) {
      const isMetricCtx = /metric|algosu|prometheus|dashboard|__name__/i.test(line);
      if (isMetricCtx) {
        return 'wildcard .+ 에 prefix anchor(^algosu_, ^, \\b) 없음 — KNOWN_SERVICE_PREFIXES expansion 미적용 시 false negative 위험 (RUNBOOK §2.4)';
      }
    }
  }

  return null;
}

// ──────────────────────────────────────────────────────────────────
// Regression fixtures (Sprint 145~148 P2 4건 baseline)
// ──────────────────────────────────────────────────────────────────

/**
 * Sprint 145~148 Critic P2 4건의 결함 패턴을 인라인 픽스처로 주입하여
 * 각 룰이 정확히 검출하는지 자체 검증.
 */
function runRegressionFixtures() {
  const failures = [];

  // Fixture 1: Sprint 147 P2-2 — Rule 1 (| 우선순위)
  // 원래 결함: /algosu:[a-z_:]*availability|success_rate/
  {
    const r = checkRule1('algosu:[a-z_:]*availability|success_rate');
    if (!r) failures.push('Sprint-147-P2-2: Rule-1 미검출 (| 우선순위)');
  }

  // Fixture 2: Sprint 145 P2 #208 — Rule 2 (char class digit 누락)
  // 원래 결함: const metricNamePattern = /[a-z_]+/
  {
    const lines = ['  const metricNamePattern = /[a-z_]+/;'];
    const r = checkRule2('[a-z_]+', lines, 0);
    if (!r) failures.push('Sprint-145-P2-208: Rule-2 미검출 (character class digit 누락)');
  }

  // Fixture 3: Sprint 146 P2 — Rule 3 (quantifier inner brace)
  // 원래 결함: [^{}]* selector + {2} quantifier, normalize 없음
  {
    const synthetic = 'const s = /\\{([^{}]*)\\}/g;\nconst c = /5[0-9]{2}/;\n';
    const r = checkRule3(synthetic);
    if (!r) failures.push('Sprint-146-P2: Rule-3 미검출 (quantifier inner brace)');
  }

  // Fixture 4: Sprint 147 P2 PR#219 — Rule 4-A (format suffix 누락)
  // 원래 결함: /\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g  ← :format 미인식
  {
    const line = '  const re = /\\$\\{([a-zA-Z_][a-zA-Z0-9_]*)\\}/g;';
    const r = checkRule4('\\$\\{([a-zA-Z_][a-zA-Z0-9_]*)\\}', line);
    if (!r) failures.push('Sprint-147-P2-219: Rule-4A 미검출 (format suffix 누락)');
  }

  // Sprint 148 P2 (YAML block scalar modifier): regex 외 영역 — 검출 범위 외.
  // check-grafana-metrics.mjs에서 modifier 전 6종 지원으로 해소됨.

  if (failures.length > 0) {
    return { ok: false, message: failures.join('; '), count: 0 };
  }

  return { ok: true, count: 4, message: 'all detected' };
}
