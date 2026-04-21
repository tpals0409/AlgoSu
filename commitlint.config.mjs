/**
 * @file commitlint.config.mjs
 * @domain ci
 * @layer config
 * @related docs/ci-cd-rules.md, docs/runbook-git-hooks.md
 *
 * AlgoSu — Conventional Commits 강제 (ci-cd-rules.md §2)
 *
 * scope-enum 동적 생성: services/ 하위 디렉토리를 런타임에 스캔하여
 * 서비스 추가/제거 시 수동 유지 비용을 제거한다. (Sprint 105 [C])
 */
import { readdirSync } from 'node:fs';

/**
 * services/ 디렉토리를 스캔하여 서비스 이름 배열을 동적으로 생성한다.
 * @returns {string[]} 서비스 디렉토리 이름 목록
 */
const services = readdirSync('./services', { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

/**
 * 서비스 외 공통 scope 목록 (정적 유지)
 * @type {string[]}
 */
const staticScopes = [
  'adr', 'blog', 'ci', 'deps', 'docs',
  'e2e', 'frontend', 'infra', 'runbook', 'security',
];

export default {
  extends: ['@commitlint/config-conventional'],
  // 정책적 예외: Dependabot 커밋은 GitHub 봇이 생성하며
  // subject-case("Bump" 대문자), body-max-line-length(URL) 제어 불가
  ignores: [(commit) => commit.includes('Signed-off-by: dependabot[bot]')],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat', 'fix', 'perf', 'refactor', 'docs',
        'test', 'chore', 'ci', 'infra', 'style',
      ],
    ],
    // 한글 커밋 본문은 100자 초과 빈번 → 완전 비활성화
    'body-max-line-length': [0, 'always', 100],
    // services/ 동적 스캔 + 정적 scope 합산 (알파벳 정렬)
    'scope-enum': [
      2,
      'always',
      [...services, ...staticScopes].sort(),
    ],
    'scope-empty': [1, 'never'],
    'subject-max-length': [2, 'always', 100],
    'subject-case': [0],
  },
};
