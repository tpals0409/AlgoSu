/**
 * @file app.module.init.spec.ts — Identity AppModule 라이프사이클 부트스트랩 스모크 테스트
 * @domain identity
 * @layer test
 * @related app.module.ts, app.module.spec.ts, user/token-encryption.service.ts
 *
 * app.module.spec.ts(.compile())가 DI 그래프 빌드만 검증하는 데 비해, 본 스펙은
 * moduleRef.init()으로 onModuleInit + onApplicationBootstrap 라이프사이클 훅까지
 * 실행하여 부트스트랩 동등 수준에서 throw를 포착한다.
 * Sprint 199: Sprint 197(.compile() 한정)을 .init()/.close()로 확장.
 *
 * .init()이 실행하는 라이프사이클:
 * - MetricsService.onModuleInit: collectDefaultMetrics (커스텀 Registry)
 * - ScheduleModule onApplicationBootstrap: feedback @Cron('0 0 3 * * *') 타이머 등록
 *
 * Identity는 모듈 레벨 Redis가 없어 DataSource override만으로 충분하다.
 * TokenEncryptionService 생성자는 NODE_ENV='test'에서 키 검증을 건너뛴다.
 * forceExit가 없으므로 .init()이 등록한 cron 타이머를 반드시 .close()로 정리한다.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getEntityManagerToken } from '@nestjs/typeorm';
import { AppModule } from './app.module';

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

describe('AppModule (라이프사이클 부트스트랩 스모크)', () => {
  const ORIGINAL_ENV = process.env;

  beforeAll(() => {
    // NODE_ENV='test'로 TokenEncryptionService의 키 검증 throw를 회피(app.module.spec.ts와 동일).
    process.env = {
      ...ORIGINAL_ENV,
      NODE_ENV: 'test',
      DATABASE_HOST: 'localhost',
      DATABASE_NAME: 'test',
      DATABASE_USER: 'test',
      DATABASE_PASSWORD: 'test',
    };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('전체 DI 그래프가 onModuleInit/bootstrap 라이프사이클까지 부트스트랩된다', async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(getDataSourceToken())
      .useValue(mockDataSource)
      .overrideProvider(getEntityManagerToken())
      .useValue(mockDataSource.manager)
      .compile();

    // onModuleInit + onApplicationBootstrap 실행 (HTTP 어댑터 없이 라이프사이클만).
    await moduleRef.init();
    expect(moduleRef).toBeDefined();

    // forceExit 없음 — ScheduleModule cron 타이머를 .close()로 정리한다.
    await moduleRef.close();
  });
});
