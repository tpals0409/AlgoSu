/**
 * @file main.init.spec.ts — GitHub Worker 부트스트랩 스모크 테스트
 * @domain github-worker
 * @layer test
 * @related main.ts, worker.ts, config.ts, metrics.ts, circuit-breaker.ts
 *
 * main()의 진입점 조립(메트릭 서버 → CircuitBreaker → RabbitMQ 소비자 → 시그널 핸들러)이
 * 한 번에 실행될 때 throw 없이 완료되는지 검증한다. 컴포넌트별 단위 spec(worker/config/
 * circuit-breaker/metrics)은 각자 mock으로 검증하나, main()이 이들을 함께 조립하는 경로는
 * 본 스모크가 유일하게 커버한다("테스트 green = 부트스트랩 가능"). 외부 I/O(메트릭 listen,
 * RabbitMQ, Redis)만 mock한다.
 */

// Redis mock — worker 생성자의 new Redis(config.redisUrl) 차단
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    publish: jest.fn().mockResolvedValue(1),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    keys: jest.fn().mockResolvedValue([]),
    quit: jest.fn().mockResolvedValue('OK'),
  }));
});

// config mock — 필수 환경변수 로드를 단위 spec과 동일하게 고정.
// config 로드/누락 throw 검증은 config.spec.ts가 담당하므로 여기선 조립 흐름에 집중한다.
jest.mock('./config', () => ({
  config: {
    rabbitmqUrl: 'amqp://localhost',
    redisUrl: 'redis://localhost:6379',
    gatewayInternalUrl: 'http://gateway:3000',
    internalKeyGateway: 'test-internal-key',
    submissionServiceUrl: 'http://submission-service:3003',
    submissionServiceKey: 'test-sub-key',
    problemServiceUrl: 'http://problem-service:3002',
    problemServiceKey: 'test-problem-key',
    maxRetries: 2,
    retryDelayMs: 10,
    githubAppId: '',
    githubAppPrivateKeyBase64: '',
    githubTokenEncryptionKey: 'a'.repeat(64),
  },
}));

// amqplib mock — worker.start()의 connect 차단
const mockChannelClose = jest.fn().mockResolvedValue(undefined);
const mockConnectionClose = jest.fn().mockResolvedValue(undefined);
jest.mock('amqplib', () => ({
  connect: jest.fn().mockResolvedValue({
    createChannel: jest.fn().mockResolvedValue({
      prefetch: jest.fn().mockResolvedValue(undefined),
      assertQueue: jest.fn().mockResolvedValue(undefined),
      consume: jest.fn().mockResolvedValue({ consumerTag: 'test-tag' }),
      ack: jest.fn(),
      nack: jest.fn(),
      close: mockChannelClose,
    }),
    on: jest.fn(),
    close: mockConnectionClose,
  }),
}));

// metrics mock — startMetricsServer만 no-op으로 실제 포트 listen을 차단하고,
// registry/Counter는 requireActual로 실제 인스턴스를 사용한다(CircuitBreakerManager가
// registry를 실제로 사용하므로). jest의 파일별 모듈 격리로 prom-client 중복 등록은 없다.
jest.mock('./metrics', () => {
  const actual = jest.requireActual('./metrics');
  return { ...actual, startMetricsServer: jest.fn() };
});

// logger stdout 억제 (JSON 로그 노이즈 제거)
jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

import { main } from './main';
import { startMetricsServer } from './metrics';

describe('main 부트스트랩 스모크', () => {
  afterEach(() => {
    // main()이 등록한 시그널 핸들러 누수 방지
    process.removeAllListeners('SIGTERM');
    process.removeAllListeners('SIGINT');
    jest.clearAllMocks();
  });

  it('진입점 조립이 throw 없이 완료되고 SIGTERM/SIGINT 핸들러를 등록한다', async () => {
    const onSpy = jest.spyOn(process, 'on');

    const { worker, cbManager } = await main();

    expect(worker).toBeDefined();
    expect(cbManager).toBeDefined();
    expect(startMetricsServer).toHaveBeenCalledTimes(1);
    expect(onSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    expect(onSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));

    onSpy.mockRestore();

    // teardown: opossum breaker의 stats setInterval + MQ 연결 정리 (open handle 방지)
    await worker.stop();
    cbManager.shutdown();
  });

  it('[음성검증] 부트스트랩 첫 단계에서 throw가 발생하면 main()이 reject된다', async () => {
    // startMetricsServer를 throw하게 만들면 cbManager/worker 생성 전에 실패하므로
    // 타이머 누수 없이 "조립 단계 결함이 스모크에 포착됨"을 입증할 수 있다.
    (startMetricsServer as jest.Mock).mockImplementationOnce(() => {
      throw new Error('SP200_NEGATIVE_CHECK: 메트릭 서버 기동 실패');
    });

    await expect(main()).rejects.toThrow('SP200_NEGATIVE_CHECK');
  });
});
