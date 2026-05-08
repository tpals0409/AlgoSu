#!/usr/bin/env node
/**
 * @file ServiceClient mock 팩토리 커버리지 검증 스크립트
 * @domain ci
 * @layer script
 * @related services/submission/src/common/problem-service-client/problem-service-client.ts
 *
 * ServiceClient의 op union type에 정의된 모든 메서드가
 * 관련 spec 파일의 mock 팩토리에 포함되어 있는지 검증한다.
 * 누락 시 exit 1로 CI 실패 처리.
 *
 * 배경: Sprint 143 PR #200 R1 P1 — ProblemServiceClient.getProblemInfo() 추가 시
 * 3개 spec mock 팩토리 누락으로 컴파일은 통과하나 런타임 TypeError 발생.
 * Critic이 적발했으나 CI는 green이었음 -> 자동 검출 필요.
 *
 * 사용법: node scripts/check-mock-coverage.mjs
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');

/**
 * 검증 대상 목록.
 * 신규 ServiceClient 추가 시 여기에 항목을 추가하면 자동 검증 대상이 된다.
 */
const CHECKS = [
  {
    name: 'ProblemServiceClient',
    sourceFile: 'services/submission/src/common/problem-service-client/problem-service-client.ts',
    opTypePattern: /^export type ProblemOp\s*=\s*(.+);$/m,
    mockFactoryName: 'mockProblemServiceClient',
    specFiles: [
      'services/submission/src/saga/saga-orchestrator.service.spec.ts',
      'services/submission/src/submission/submission.service.spec.ts',
      'services/submission/src/submission/ai-satisfaction.spec.ts',
    ],
  },
];

let exitCode = 0;

for (const check of CHECKS) {
  const sourcePath = resolve(ROOT, check.sourceFile);
  const source = readFileSync(sourcePath, 'utf-8');
  const match = source.match(check.opTypePattern);

  if (!match) {
    console.error(`[FAIL] ${check.name}: op union type not found in ${check.sourceFile}`);
    exitCode = 1;
    continue;
  }

  const opLiterals = match[1].match(/'([^']+)'/g)?.map((s) => s.replace(/'/g, '')) ?? [];
  if (opLiterals.length === 0) {
    console.error(`[FAIL] ${check.name}: no op literals found in union type`);
    exitCode = 1;
    continue;
  }

  console.log(`[OK]   ${check.name}: ops = [${opLiterals.join(', ')}]`);

  for (const specFile of check.specFiles) {
    const specPath = resolve(ROOT, specFile);
    const specContent = readFileSync(specPath, 'utf-8');

    const startIdx = specContent.indexOf(`${check.mockFactoryName} = () => ({`);
    if (startIdx === -1) {
      console.error(`[FAIL] ${specFile}: ${check.mockFactoryName} factory not found`);
      exitCode = 1;
      continue;
    }

    const braceStart = specContent.indexOf('({', startIdx);
    let depth = 0;
    let endIdx = braceStart;
    for (let i = braceStart; i < specContent.length; i++) {
      if (specContent[i] === '(') depth++;
      else if (specContent[i] === ')') { depth--; if (depth === 0) { endIdx = i; break; } }
    }

    const factoryBody = specContent.slice(braceStart, endIdx + 1);
    const topLevelKeys = [];
    let braceDepth = 0;
    for (const line of factoryBody.split('\n')) {
      for (const ch of line) { if (ch === '{') braceDepth++; else if (ch === '}') braceDepth--; }
      if (braceDepth === 1) {
        const keyMatch = line.match(/^\s+(\w+)\s*:/);
        if (keyMatch) topLevelKeys.push(keyMatch[1]);
      }
    }
    const mockKeys = topLevelKeys;
    const missing = opLiterals.filter((op) => !mockKeys.includes(op));

    if (missing.length > 0) {
      console.error(`[FAIL] ${specFile}: missing mock methods [${missing.join(', ')}]`);
      exitCode = 1;
    } else {
      console.log(`  [OK] ${specFile}: all ops covered`);
    }
  }
}

if (exitCode === 0) {
  console.log('\nAll ServiceClient mock factories are complete.');
} else {
  console.error('\nSome mock factories are missing methods. See errors above.');
}

process.exit(exitCode);
