/**
 * @file cache.module.spec.ts — CacheModule DI 그래프 컴파일 회귀 테스트
 * @domain submission
 * @layer test
 * @related cache.module.ts, cache.constants.ts, stats-cache.service.ts
 *
 * 실제 CacheModule을 Test.createTestingModule에 import하여
 * NestJS DI 그래프가 순환 의존성 없이 컴파일되는지 검증한다.
 * Sprint 195: REDIS_CLIENT 토큰이 cache.module ↔ stats-cache.service 간
 * 양방향 import를 유발했던 순환 의존성의 재발을 방어한다.
 */
import { Test, TestingModule } from '@nestjs/testing';
import type { ConfigService } from '@nestjs/config';
import { CacheModule } from './cache.module';
import { REDIS_CLIENT } from './cache.constants';
import { StatsCacheService } from './stats-cache.service';
import { LoggerModule } from '../common/logger/logger.module';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';

// ioredis 모킹 — REDIS_CLIENT 팩토리 직접 호출 시 실제 연결 방지.
// DI 컴파일 테스트는 overrideProvider로 팩토리를 우회하므로 이 모킹의 영향을 받지 않는다.
const redisHandlers: Record<string, (...args: unknown[]) => void> = {};
const mockRedisInstance: { on: jest.Mock } = {
  on: jest.fn((event: string, cb: (...args: unknown[]) => void): unknown => {
    redisHandlers[event] = cb;
    return mockRedisInstance;
  }),
};
jest.mock('ioredis', () => ({
  __esModule: true,
  default: jest.fn(() => mockRedisInstance),
}));

const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  scan: jest.fn(),
  del: jest.fn(),
};

describe('CacheModule (DI 그래프 컴파일)', () => {
  let moduleRef: TestingModule;

  afterEach(async () => {
    if (moduleRef) {
      await moduleRef.close();
    }
  });

  it('CacheModule이 순환 의존성 없이 컴파일된다', async () => {
    moduleRef = await Test.createTestingModule({
      imports: [LoggerModule, CacheModule],
    })
      .overrideProvider(REDIS_CLIENT)
      .useValue(mockRedis)
      .compile();

    expect(moduleRef).toBeDefined();
  });

  it('컴파일된 모듈에서 StatsCacheService를 resolve할 수 있다', async () => {
    moduleRef = await Test.createTestingModule({
      imports: [LoggerModule, CacheModule],
    })
      .overrideProvider(REDIS_CLIENT)
      .useValue(mockRedis)
      .compile();

    const service = moduleRef.get<StatsCacheService>(StatsCacheService);
    expect(service).toBeInstanceOf(StatsCacheService);
  });

  it('컴파일된 모듈에서 REDIS_CLIENT를 resolve할 수 있다', async () => {
    moduleRef = await Test.createTestingModule({
      imports: [LoggerModule, CacheModule],
    })
      .overrideProvider(REDIS_CLIENT)
      .useValue(mockRedis)
      .compile();

    const redis = moduleRef.get(REDIS_CLIENT);
    expect(redis).toBeDefined();
    expect(redis).toBe(mockRedis);
  });

  // ─── REDIS_CLIENT 팩토리 on("error") 콜백 ─────────────
  describe('REDIS_CLIENT 팩토리 Redis error 콜백', () => {
    it('on("error") 핸들러가 Error 객체를 구조화 로깅한다', () => {
      const errorSpy = jest
        .spyOn(StructuredLoggerService.prototype, 'error')
        .mockImplementation(() => undefined);

      // @Module 메타데이터에서 REDIS_CLIENT 팩토리 추출 후 직접 호출
      const providers = (Reflect.getMetadata('providers', CacheModule) ??
        []) as Array<{
        provide?: unknown;
        useFactory?: (cs: ConfigService) => unknown;
      }>;
      const redisProvider = providers.find((p) => p.provide === REDIS_CLIENT);
      expect(redisProvider?.useFactory).toBeDefined();

      const configService = {
        get: jest.fn((_key: string, defaultVal: string) => defaultVal),
      } as unknown as ConfigService;
      redisProvider!.useFactory!(configService);

      const handler = redisHandlers['error'];
      expect(handler).toBeDefined();
      // 표준 패턴: logger.error('메시지', err) — Error 객체를 2번째 인자로 전달
      const err = new Error('Redis down');
      handler(err);
      expect(errorSpy).toHaveBeenCalledWith('Redis 연결 오류', err);

      errorSpy.mockRestore();
    });
  });
});
