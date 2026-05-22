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
import { CacheModule } from './cache.module';
import { REDIS_CLIENT } from './cache.constants';
import { StatsCacheService } from './stats-cache.service';
import { LoggerModule } from '../common/logger/logger.module';

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
});
