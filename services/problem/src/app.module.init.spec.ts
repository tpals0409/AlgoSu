/**
 * @file app.module.init.spec.ts — Problem AppModule 라이프사이클 부트스트랩 스모크 테스트
 * @domain problem
 * @layer test
 * @related app.module.ts, app.module.spec.ts, database/dual-write.service.ts, database/reconciliation.service.ts
 *
 * app.module.spec.ts(.compile())가 DI 그래프 빌드만 검증하는 데 비해, 본 스펙은
 * moduleRef.init()으로 onModuleInit + onApplicationBootstrap 라이프사이클 훅까지
 * 실행하여 부트스트랩 동등 수준에서 throw를 포착한다.
 * Sprint 199: Sprint 197(.compile() 한정)을 .init()/.close()로 확장.
 *
 * .init()이 실행하는 라이프사이클:
 * - DualWriteService/ReconciliationService.onModuleInit: getDualWriteMode() 읽기
 * - MetricsService.onModuleInit: collectDefaultMetrics (커스텀 Registry)
 * - ScheduleModule onApplicationBootstrap: @Cron('0 * * * *') reconcile 타이머 등록
 *
 * Problem은 forceExit가 없으므로, .init()이 등록한 cron 타이머를 반드시 .close()로
 * 정리해야 테스트가 행(hang)하지 않는다. 실 DB(이중 연결)·Redis는 override로 차단한다.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getEntityManagerToken } from '@nestjs/typeorm';
import { AppModule } from './app.module';
import { NEW_DB_CONNECTION } from './database/dual-write.config';
import { REDIS_CLIENT } from './cache/cache.module';

const mockRepository = {
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue(null),
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
  destroy: jest.fn().mockResolvedValue(undefined),
};

const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  scan: jest.fn(),
  on: jest.fn().mockReturnThis(),
  quit: jest.fn().mockResolvedValue(undefined),
};

describe('AppModule (라이프사이클 부트스트랩 스모크)', () => {
  const ORIGINAL_ENV = process.env;

  beforeAll(() => {
    // DUAL_WRITE_MODE='off' 명시 — spread만으로는 환경/.env의 값이 남아
    // active 분기(NEW_DATABASE_* 요구)로 새기 때문(app.module.spec.ts와 동일).
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

  it('전체 DI 그래프가 onModuleInit/bootstrap 라이프사이클까지 부트스트랩된다 (이중 연결 포함)', async () => {
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

    // onModuleInit + onApplicationBootstrap 실행 (HTTP 어댑터 없이 라이프사이클만).
    await moduleRef.init();
    expect(moduleRef).toBeDefined();

    // close()는 onModuleDestroy(ScheduleModule cron 타이머 정리)를 먼저 실행한 뒤
    // onApplicationShutdown을 호출하는데, 이중 TypeOrmCoreModule(default + new-problem-db)
    // 환경에서 후자가 override된 mock DataSource를 strict resolve하다 throw한다(teardown
    // 한정 Nest 내부 quirk, 실 인프라가 아닌 mock이라 무해). 타이머 정리는 그 전에 끝나
    // 잔여 핸들이 없다(forceExit 부재 + detectOpenHandles로 검증). 이 알려진 quirk만
    // 좁게 무시하고, 그 외 teardown 에러(미래 onModuleDestroy 회귀 등)는 그대로 노출한다.
    await moduleRef.close().catch((e: unknown) => {
      if (!(e instanceof Error) || !e.message.includes('could not find DataSource')) {
        throw e;
      }
    });
  });
});
