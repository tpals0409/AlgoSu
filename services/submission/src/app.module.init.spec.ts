/**
 * @file app.module.init.spec.ts — Submission AppModule 라이프사이클 부트스트랩 스모크 테스트
 * @domain submission
 * @layer test
 * @related app.module.ts, app.module.spec.ts, saga/mq-publisher.service.ts, saga/saga-orchestrator.service.ts
 *
 * app.module.spec.ts(.compile())가 DI 그래프 빌드만 검증하는 데 비해, 본 스펙은
 * moduleRef.init()으로 onModuleInit + onApplicationBootstrap 라이프사이클 훅까지
 * 실행하여 부트스트랩 동등 수준에서 throw를 포착한다.
 * Sprint 199: Sprint 197(.compile() 한정)을 .init()/.close()로 확장.
 *
 * .compile()이 못 잡는 라이프사이클 단계 회귀를 차단한다:
 * - MqPublisherService.onModuleInit: amqplib.connect (→ amqplib mock으로 차단)
 * - SagaOrchestratorService.onModuleInit: submissionRepo.find().length (→ find가 [] 반환)
 * - SagaOrchestrator/ProblemServiceClient: CircuitBreaker 등록, setInterval 타이머
 *
 * 실 인프라(Postgres/Redis)는 DataSource·REDIS_CLIENT override로, RabbitMQ는
 * amqplib 모듈 mock으로 차단한다. .init()이 등록한 타이머(saga timeoutTimer,
 * ScheduleModule cron)는 .close()로 정리한다.
 */
// jest.mock은 호이스팅된다 — MqPublisherService.onModuleInit의 amqplib.connect를 차단.
const mockChannel = {
  assertExchange: jest.fn().mockResolvedValue(undefined),
  assertQueue: jest.fn().mockResolvedValue(undefined),
  bindQueue: jest.fn().mockResolvedValue(undefined),
  publish: jest.fn().mockReturnValue(true),
  close: jest.fn().mockResolvedValue(undefined),
};
const mockConnection = {
  createChannel: jest.fn().mockResolvedValue(mockChannel),
  on: jest.fn(),
  close: jest.fn().mockResolvedValue(undefined),
};
jest.mock('amqplib', () => ({
  __esModule: true,
  connect: jest.fn().mockResolvedValue(mockConnection),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getEntityManagerToken } from '@nestjs/typeorm';
import { AppModule } from './app.module';
import { REDIS_CLIENT } from './cache/cache.constants';

// SagaOrchestratorService.onModuleInit이 find() 결과의 .length를 읽으므로
// find는 반드시 배열을 resolve해야 한다(undefined면 TypeError).
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
    // app.module + SagaOrchestrator 생성자 getOrThrow + MqPublisher.onModuleInit
    // getOrThrow(RABBITMQ_URL)가 요구하는 env.
    process.env = {
      ...ORIGINAL_ENV,
      DATABASE_HOST: 'localhost',
      DATABASE_NAME: 'test',
      DATABASE_USER: 'test',
      DATABASE_PASSWORD: 'test',
      INTERNAL_KEY_AI_ANALYSIS: 'test-key',
      RABBITMQ_URL: 'amqp://localhost:5672',
    };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('전체 DI 그래프가 onModuleInit/bootstrap 라이프라이클까지 부트스트랩된다', async () => {
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

    // onModuleInit + onApplicationBootstrap 실행 (HTTP 어댑터 없이 라이프사이클만).
    await moduleRef.init();
    expect(moduleRef).toBeDefined();

    // .close()로 onModuleDestroy/shutdown 훅 실행 — saga timeoutTimer setInterval,
    // ScheduleModule cron, MqPublisher 연결을 정리한다.
    await moduleRef.close();
  });
});
