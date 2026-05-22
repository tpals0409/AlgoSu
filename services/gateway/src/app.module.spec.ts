/**
 * @file app.module.spec.ts — Gateway AppModule 부트스트랩 스모크 테스트
 * @domain common
 * @layer test
 * @related app.module.ts, rate-limit/redis-throttler.storage.ts
 *
 * 전체 AppModule을 Test.createTestingModule에 import하여 NestJS DI 그래프가
 * 순환 의존성·누락 provider 없이 컴파일되는지 부트스트랩 동등 수준에서 검증한다.
 * Sprint 197: Sprint 195 교훈을 AppModule 전체로 확장.
 *
 * Gateway는 TypeORM이 없고, 다수 provider 생성자(ThrottlerModule factory의
 * RedisThrottlerStorage 포함)가 compile 시점에 `new Redis()`를 즉시 실행한다.
 * 이는 DI 경유가 아니라 직접 생성이라 overrideProvider로 막을 수 없으므로
 * ioredis 모듈 자체를 mock하여 실 Redis 연결을 차단한다.
 */
// jest.mock은 hoist되지만 의도를 명확히 하기 위해 import보다 먼저 선언한다.
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

describe('AppModule (부트스트랩 스모크)', () => {
  const ORIGINAL_ENV = process.env;

  beforeAll(() => {
    // 생성자/팩토리 시점에 getOrThrow로 요구되는 env(JWT_SECRET, OAUTH_CALLBACK_URL,
    // INTERNAL_KEY_*). 메서드 내 getOrThrow(OAuth client id 등)는 compile 무관.
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

  it('전체 DI 그래프가 순환 의존성 없이 컴파일된다 (ProxyModule CatchAll 포함)', async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    expect(moduleRef).toBeDefined();
    // close()는 호출하지 않는다 — 모든 Redis 연결이 mock이고 RedisThrottlerStorage의
    // cleanup setInterval은 .unref() 처리되어 프로세스 종료를 막지 않는다.
    // 검증 목표는 compile()의 그래프 빌드 통과다.
  });
});
