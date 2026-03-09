import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { diagnostics: false }],
  },
  collectCoverageFrom: [
    '**/*.(t|j)s',
    '!**/*.module.ts',
    '!**/main.ts',
    '!**/*.entity.ts',
    '!**/*.dto.ts',
  ],
  coverageDirectory: '../coverage',
  coverageThreshold: {
    global: {
      branches: 95,
      functions: 97,
      lines: 98,
      statements: 98,
    },
  },
  testEnvironment: 'node',
};

export default config;
