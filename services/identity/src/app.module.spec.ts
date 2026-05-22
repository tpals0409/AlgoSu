/**
 * @file app.module.spec.ts — Identity AppModule 부트스트랩 스모크 테스트
 * @domain identity
 * @layer test
 * @related app.module.ts, user/token-encryption.service.ts
 *
 * 전체 AppModule을 Test.createTestingModule에 import하여 NestJS DI 그래프가
 * 순환 의존성·누락 provider 없이 컴파일되는지 부트스트랩 동등 수준에서 검증한다.
 * Sprint 197: Sprint 195 교훈을 AppModule 전체로 확장.
 *
 * Identity는 모듈 레벨 Redis가 없어 DataSource override만으로 충분하다.
 * TokenEncryptionService 생성자는 NODE_ENV='test'(jest 기본값)에서 키 검증을 건너뛴다.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getEntityManagerToken } from '@nestjs/typeorm';
import { AppModule } from './app.module';

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

describe('AppModule (부트스트랩 스모크)', () => {
  const ORIGINAL_ENV = process.env;

  beforeAll(() => {
    // app.module은 config.get(기본값 보유)이라 throw하지 않지만 일관성 위해 세팅.
    // NODE_ENV='test'로 TokenEncryptionService의 키 검증 throw를 회피한다.
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

  it('전체 DI 그래프가 순환 의존성 없이 컴파일된다', async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(getDataSourceToken())
      .useValue(mockDataSource)
      .overrideProvider(getEntityManagerToken())
      .useValue(mockDataSource.manager)
      .compile();

    expect(moduleRef).toBeDefined();
    // close()는 호출하지 않는다 — TypeOrmCoreModule.onApplicationShutdown이 override된
    // DataSource를 재resolve하려다 teardown에서 실패하고, 모든 인프라가 mock이라
    // 정리할 실 핸들이 없다. 검증 목표는 compile()의 그래프 빌드 통과다.
  });
});
