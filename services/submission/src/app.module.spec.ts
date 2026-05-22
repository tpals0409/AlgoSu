/**
 * @file app.module.spec.ts — Submission AppModule 부트스트랩 스모크 테스트
 * @domain submission
 * @layer test
 * @related app.module.ts, cache/cache.module.spec.ts
 *
 * 전체 AppModule을 Test.createTestingModule에 import하여 NestJS DI 그래프가
 * 순환 의존성·누락 provider 없이 컴파일되는지 부트스트랩 동등 수준에서 검증한다.
 * Sprint 197: Sprint 195(CacheModule 순환 의존성으로 부트스트랩 throw, 단위 spec은
 * provider 수동 조립이라 미포착) 교훈을 AppModule 전체로 확장.
 *
 * .compile()만 호출해 onModuleInit(MqPublisher의 RabbitMQ 연결 등)은 실행하지 않으면서
 * DI 그래프 빌드 단계의 throw만 포착한다. 실 인프라 연결(Postgres/Redis)은
 * DataSource·REDIS_CLIENT override로 차단한다.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getEntityManagerToken } from '@nestjs/typeorm';
import { AppModule } from './app.module';
import { REDIS_CLIENT } from './cache/cache.constants';

// TypeORM repository provider factory(getRepository)가 반환하는 mock repository.
// compile 시점에는 메서드가 호출되지 않으므로 bare jest.fn()으로 충분하다.
const mockRepository = {
  find: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  delete: jest.fn(),
  createQueryBuilder: jest.fn(),
  manager: {},
};

// getDataSourceToken() override 대상. dataSourceProvider의 useFactory(=initialize)를
// 통째로 치환해 실 DB 소켓 연결을 차단한다. repository factory가 참조하는
// entityMetadatas/options.type/getRepository만 있으면 그래프가 resolve된다.
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

// CacheModule(@Global) REDIS_CLIENT override — useFactory의 new Redis()를 차단.
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
    // app.module의 TypeOrmModule.forRootAsync useFactory와 SagaOrchestratorService
    // 생성자가 getOrThrow로 요구하는 env. DataSource는 override되지만
    // TYPEORM_MODULE_OPTIONS useFactory는 그대로 실행되므로 세팅이 필요하다.
    process.env = {
      ...ORIGINAL_ENV,
      DATABASE_HOST: 'localhost',
      DATABASE_NAME: 'test',
      DATABASE_USER: 'test',
      DATABASE_PASSWORD: 'test',
      INTERNAL_KEY_AI_ANALYSIS: 'test-key',
    };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('전체 DI 그래프가 순환 의존성 없이 컴파일된다', async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(getDataSourceToken())
      .useValue(mockDataSource)
      .overrideProvider(getEntityManagerToken())
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
