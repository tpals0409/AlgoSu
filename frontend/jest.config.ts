/**
 * @file Jest 설정 — Next.js 15 + React 19 호환
 * @domain common
 * @layer config
 */
import type { Config } from 'jest';

const config: Config = {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.jest.json',
      },
    ],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transformIgnorePatterns: [
    '/node_modules/(?!lucide-react)',
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: {
      statements: 88,
      branches: 79,
      functions: 87,
      lines: 90,
    },
  },
  collectCoverageFrom: [
    'src/lib/**/*.ts',
    'src/components/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
  ],
};

export default config;
