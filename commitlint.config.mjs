// AlgoSu — Conventional Commits 강제 (ci-cd-rules.md §2)
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
        'test', 'chore', 'ci', 'infra',
      ],
    ],
    'scope-enum': [
      2,
      'always',
      [
        'gateway', 'identity', 'submission', 'problem',
        'github-worker', 'ai-analysis', 'frontend', 'blog',
        'infra', 'ci', 'docs', 'deps', 'security', 'adr',
        'e2e', 'runbook',
      ],
    ],
    'scope-empty': [1, 'never'],
    'subject-max-length': [2, 'always', 100],
    'subject-case': [0],
  },
};
