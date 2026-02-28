// AlgoSu — Conventional Commits 강제 (ci-cd-rules.md §2)
module.exports = {
  extends: ['@commitlint/config-conventional'],
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
        'github-worker', 'ai-analysis', 'frontend',
        'infra', 'ci', 'docs', 'deps', 'security',
      ],
    ],
    'scope-empty': [1, 'never'],
    'subject-max-length': [2, 'always', 100],
  },
};
