/**
 * @file app.module.init.spec.ts — Gateway AppModule 라이프사이클 부트스트랩 스모크 테스트
 * @domain common
 * @layer test
 * @related app.module.ts, app.module.spec.ts, rate-limit/redis-throttler.storage.ts
 *
 * app.module.spec.ts(.compile())가 DI 그래프 빌드만 검증하는 데 비해, 본 스펙은
 * moduleRef.init()으로 onModuleInit + onApplicationBootstrap 라이프사이클 훅까지
 * 실행하여 부트스트랩 동등 수준에서 throw를 포착한다.
 * Sprint 199: Sprint 197(.compile() 한정)을 .init()/.close()로 확장.
 *
 * .init()이 실행하는 라이프사이클:
 * - MetricsService.onModuleInit: collectDefaultMetrics (커스텀 Registry)
 * - ScheduleModule onApplicationBootstrap: event-log/notification/deadline-reminder @Cron 타이머 등록
 *
 * Gateway는 TypeORM이 없고 다수 provider가 compile 시점에 `new Redis()`를 직접 실행하므로
 * ioredis 모듈 자체를 mock한다. forceExit가 없으므로 .init()이 등록한 cron 타이머를
 * 반드시 .close()로 정리해야 테스트가 행(hang)하지 않는다.
 */
// jest.mock은 호이스팅된다 — DI 경유가 아닌 직접 `new Redis()`를 차단(app.module.spec.ts와 동일).
jest.mock('ioredis', () =>
  jest.fn().mockImplementation(() => ({
    on: jest.fn().mockReturnThis(),
    once: jest.fn().mockReturnThis(),
    duplicate: jest.fn().mockReturnThis(),
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    quit: jest.fn(),
    disconnect: jest.fn(),
    ping: jest.fn(),
    publish: jest.fn(),
    subscribe: jest.fn(),
  })),
);

import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from './app.module';

describe('AppModule (라이프사이클 부트스트랩 스모크)', () => {
  const ORIGINAL_ENV = process.env;

  beforeAll(() => {
    // 생성자/팩토리 시점에 getOrThrow로 요구되는 env(app.module.spec.ts와 동일).
    process.env = {
      ...ORIGINAL_ENV,
      JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long',
      OAUTH_CALLBACK_URL: 'http://localhost:3000/auth/oauth',
      INTERNAL_API_KEY: 'test-internal-key',
      INTERNAL_KEY_SUBMISSION: 'test-submission-key',
      INTERNAL_KEY_PROBLEM: 'test-problem-key',
      INTERNAL_KEY_AI_ANALYSIS: 'test-ai-key',
      SUBMISSION_SERVICE_URL: 'http://localhost:3003',
      PROBLEM_SERVICE_URL: 'http://localhost:3002',
      IDENTITY_SERVICE_URL: 'http://localhost:3004',
      REDIS_URL: 'redis://localhost:6379',
      ALLOWED_ORIGINS: 'http://localhost:3001',
    };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('전체 DI 그래프가 onModuleInit/bootstrap 라이프사이클까지 부트스트랩된다 (ProxyModule CatchAll 포함)', async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    // onModuleInit + onApplicationBootstrap 실행 (HTTP 어댑터 없이 라이프사이클만).
    await moduleRef.init();
    expect(moduleRef).toBeDefined();

    // forceExit 없음 — ScheduleModule cron 타이머 + Redis(mock)를 .close()로 정리한다.
    await moduleRef.close();
  });
});
