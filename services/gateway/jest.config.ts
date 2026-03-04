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
      branches: 37,
      functions: 38,
      lines: 43,
      statements: 43,
    },
  },
  testEnvironment: 'node',
};

export default config;
