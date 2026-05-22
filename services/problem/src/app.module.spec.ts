/**
 * @file app.module.spec.ts — Problem AppModule 부트스트랩 스모크 테스트
 * @domain problem
 * @layer test
 * @related app.module.ts, database/dual-write.module.ts, cache/cache.module.ts
 *
 * 전체 AppModule을 Test.createTestingModule에 import하여 NestJS DI 그래프가
 * 순환 의존성·누락 provider 없이 컴파일되는지 부트스트랩 동등 수준에서 검증한다.
 * Sprint 197: Sprint 195 교훈(provider 수동 조립 spec은 그래프 throw 미포착)을
 * AppModule 전체로 확장.
 *
 * Problem은 DualWriteModule이 기본 연결 외에 named 연결(NEW_DB_CONNECTION)을
 * 추가로 만들므로 두 DataSource 토큰을 모두 override해야 실 DB 연결을 차단한다.
 * DUAL_WRITE_MODE를 미설정(=off)으로 두어 NEW_DATABASE_* 없이 구 DB 설정만 평가되게 한다.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getEntityManagerToken } from '@nestjs/typeorm';
import { AppModule } from './app.module';
import { NEW_DB_CONNECTION } from './database/dual-write.config';
import { REDIS_CLIENT } from './cache/cache.module';

const mockRepository = {
  find: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  delete: jest.fn(),
  createQueryBuilder: jest.fn(),
  manager: {},
};

const mockDataSource = {
  entityMetadatas: [],
  options: { type: 'postgres' },
  getRepository: jest.fn(() => mockRepository),
  getTreeRepository: jest.fn(),
  manager: { transaction: jest.fn() },
  createQueryBuilder: jest.fn(),
  transaction: jest.fn(),
  query: jest.fn(),
  isInitialized: true,
  destroy: jest.fn(),
};

const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  scan: jest.fn(),
  on: jest.fn().mockReturnThis(),
  quit: jest.fn(),
};

describe('AppModule (부트스트랩 스모크)', () => {
  const ORIGINAL_ENV = process.env;

  beforeAll(() => {
    // app.module + dual-write.module(OFF 분기)의 getOrThrow가 요구하는 구 DB env.
    // DUAL_WRITE_MODE는 'off'를 명시 — spread만으로는 환경/로컬 .env의
    // expand·switch-read 값이 남아 active 분기(NEW_DATABASE_* 요구)로 새기 때문.
    process.env = {
      ...ORIGINAL_ENV,
      DATABASE_HOST: 'localhost',
      DATABASE_NAME: 'test',
      DATABASE_USER: 'test',
      DATABASE_PASSWORD: 'test',
      DUAL_WRITE_MODE: 'off',
    };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('전체 DI 그래프가 순환 의존성 없이 컴파일된다 (이중 연결 포함)', async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(getDataSourceToken())
      .useValue(mockDataSource)
      .overrideProvider(getEntityManagerToken())
      .useValue(mockDataSource.manager)
      .overrideProvider(getDataSourceToken(NEW_DB_CONNECTION))
      .useValue(mockDataSource)
      .overrideProvider(getEntityManagerToken(NEW_DB_CONNECTION))
      .useValue(mockDataSource.manager)
      .overrideProvider(REDIS_CLIENT)
      .useValue(mockRedis)
      .compile();

    expect(moduleRef).toBeDefined();
    // close()는 호출하지 않는다 — TypeOrmCoreModule.onApplicationShutdown이 override된
    // DataSource를 재resolve하려다 teardown에서 실패하고, 모든 인프라가 mock이라
    // 정리할 실 핸들이 없다. 검증 목표는 compile()의 그래프 빌드 통과다.
  });
});
