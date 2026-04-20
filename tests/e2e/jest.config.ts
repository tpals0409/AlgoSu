/**
 * @file E2E 테스트 Jest 설정 — 프로그래머스 전 구간 플로우 검증
 * @domain e2e
 * @layer config
 *
 * 모듈 해석 전략:
 * - @octokit/* : github-worker/node_modules 고정 (moduleNameMapper)
 *   → 테스트 파일과 github-push.service.ts 양쪽이 같은 경로로 resolve해야
 *     jest.mock 인터셉트가 정상 동작함. 두 node_modules에서 각각 resolve되면
 *     mock이 적용되지 않고 실제 패키지가 호출됨.
 */
import type { Config } from 'jest';
import * as path from 'path';

const GW_MODULES = path.resolve(
  __dirname,
  '../../services/github-worker/node_modules',
);

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': [
      'ts-jest',
      {
        tsconfig: path.resolve(__dirname, 'tsconfig.json'),
        diagnostics: {
          // cross-package 임포트 시 타입 경고 허용 (기능 오류는 catch)
          warnOnly: true,
          ignoreCodes: [2307, 2345, 2339],
        },
      },
    ],
  },
  testEnvironment: 'node',
  // @octokit/* 를 github-worker/node_modules에서 단일 해석
  // 이유: github-push.service.ts가 import하는 경로와 jest.mock 등록 경로가
  //        동일해야 mock 인터셉트가 동작함
  moduleNameMapper: {
    '^@octokit/rest$': `${GW_MODULES}/@octokit/rest`,
    '^@octokit/types$': `${GW_MODULES}/@octokit/types`,
    '^@octokit/(.*)$': `${GW_MODULES}/@octokit/$1`,
  },
  // 로컬 node_modules → github-worker node_modules 순서로 폴백
  modulePaths: [
    path.resolve(__dirname, 'node_modules'),
    GW_MODULES,
  ],
  // 테스트 타임아웃: 60초 (Python subprocess 포함)
  testTimeout: 60_000,
  verbose: true,
};

export default config;
