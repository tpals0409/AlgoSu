import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MqPublisherService } from './mq-publisher.service';

// ─── amqplib Mock (호이스팅 대응) ─────────────────────────────
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

// jest.mock은 호이스팅되므로, 변수를 직접 참조하지 않고 getter로 우회
jest.mock('amqplib', () => {
  return {
    __esModule: true,
    connect: jest.fn(),
  };
});

// ─── ConfigService Mock ───────────────────────────────────────
const mockConfigService = () => ({
  getOrThrow: jest.fn().mockReturnValue('amqp://localhost:5672'),
});

// ─── 테스트 헬퍼 ──────────────────────────────────────────────
const createEvent = (overrides = {}) => ({
  submissionId: 'sub-uuid-1',
  studyId: 'study-uuid-1',
  timestamp: '2026-03-01T00:00:00Z',
  ...overrides,
});

describe('MqPublisherService', () => {
  let service: MqPublisherService;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const amqplib = require('amqplib');

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // 기본: connect 성공
    amqplib.connect.mockResolvedValue(mockConnection);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MqPublisherService,
        { provide: ConfigService, useFactory: mockConfigService },
      ],
    }).compile();

    service = module.get<MqPublisherService>(MqPublisherService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ─── 1. onModuleInit — 정상 초기화 ────────────────────────
  describe('onModuleInit() — 정상 초기화', () => {
    it('RabbitMQ 연결, Exchange/Queue 선언, 바인딩을 수행한다', async () => {
      await service.onModuleInit();

      expect(amqplib.connect).toHaveBeenCalledWith('amqp://localhost:5672');
      expect(mockConnection.createChannel).toHaveBeenCalled();

      // Exchange 선언 (메인 + DLX)
      expect(mockChannel.assertExchange).toHaveBeenCalledWith(
        'submission.events',
        'topic',
        { durable: true },
      );
      expect(mockChannel.assertExchange).toHaveBeenCalledWith(
        'submission.events.dlx',
        'topic',
        { durable: true },
      );

      // Queue 선언 (메인 2 + DLQ 2)
      expect(mockChannel.assertQueue).toHaveBeenCalledTimes(4);
      expect(mockChannel.assertQueue).toHaveBeenCalledWith(
        'submission.github_push',
        expect.objectContaining({ durable: true }),
      );
      expect(mockChannel.assertQueue).toHaveBeenCalledWith(
        'submission.ai_analysis',
        expect.objectContaining({ durable: true }),
      );

      // 바인딩 (메인 2 + DLQ 2)
      expect(mockChannel.bindQueue).toHaveBeenCalledTimes(4);

      // 연결 이벤트 리스너 등록
      expect(mockConnection.on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockConnection.on).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });

  // ─── 2. onModuleInit — 연결 실패 시 재연결 스케줄링 ───────
  describe('onModuleInit() — 연결 실패', () => {
    it('연결 실패 시 재연결 타이머를 설정한다', async () => {
      amqplib.connect.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      await service.onModuleInit();

      // 재연결 타이머가 설정되어야 한다
      expect(jest.getTimerCount()).toBe(1);
    });
  });

  // ─── 3. publishGitHubPush — 정상 발행 ─────────────────────
  describe('publishGitHubPush() — 정상 발행', () => {
    it('GitHub push 이벤트를 올바른 라우팅 키로 발행한다', async () => {
      await service.onModuleInit();
      const event = createEvent();

      await service.publishGitHubPush(event);

      expect(mockChannel.publish).toHaveBeenCalledWith(
        'submission.events',
        'github.push',
        expect.any(Buffer),
        expect.objectContaining({
          persistent: true,
          contentType: 'application/json',
          headers: { 'x-trace-id': 'sub-uuid-1' },
        }),
      );

      // 메시지 본문 검증
      const publishedBuffer = mockChannel.publish.mock.calls[0][2];
      const parsed = JSON.parse(publishedBuffer.toString());
      expect(parsed).toEqual(event);
    });
  });

  // ─── 4. publishAiAnalysis — 정상 발행 ─────────────────────
  describe('publishAiAnalysis() — 정상 발행', () => {
    it('AI analysis 이벤트를 올바른 라우팅 키로 발행한다', async () => {
      await service.onModuleInit();
      const event = createEvent({ userId: 'user-1' });

      await service.publishAiAnalysis(event);

      expect(mockChannel.publish).toHaveBeenCalledWith(
        'submission.events',
        'ai.analysis',
        expect.any(Buffer),
        expect.objectContaining({
          persistent: true,
          contentType: 'application/json',
          headers: { 'x-trace-id': 'sub-uuid-1' },
        }),
      );
    });
  });

  // ─── 5. publish — 채널 미초기화 시 에러 ────────────────────
  describe('publish() — 채널 미초기화', () => {
    it('채널이 없으면 에러를 던진다', async () => {
      // onModuleInit을 호출하지 않아 channel이 null
      await expect(service.publishGitHubPush(createEvent())).rejects.toThrow(
        'RabbitMQ 채널이 초기화되지 않았습니다.',
      );
    });
  });

  // ─── 6. onModuleDestroy — 정상 종료 ───────────────────────
  describe('onModuleDestroy() — 정상 종료', () => {
    it('채널과 연결을 순서대로 닫는다', async () => {
      await service.onModuleInit();

      await service.onModuleDestroy();

      expect(mockChannel.close).toHaveBeenCalled();
      expect(mockConnection.close).toHaveBeenCalled();
      // 채널이 먼저 닫히는지 순서 확인
      const channelCloseOrder = mockChannel.close.mock.invocationCallOrder[0];
      const connCloseOrder = mockConnection.close.mock.invocationCallOrder[0];
      expect(channelCloseOrder).toBeLessThan(connCloseOrder);
    });
  });

  // ─── 7. onModuleDestroy — 채널/연결 없을 때 ───────────────
  describe('onModuleDestroy() — 연결 없을 때', () => {
    it('채널/연결이 없어도 에러가 발생하지 않는다', async () => {
      await expect(service.onModuleDestroy()).resolves.not.toThrow();
    });
  });

  // ─── 8. 연결 끊김 시 재연결 ────────────────────────────────
  describe('연결 끊김 시 재연결', () => {
    it('close 이벤트 발생 시 재연결을 스케줄링한다', async () => {
      await service.onModuleInit();

      // close 이벤트 콜백 추출 및 호출
      const closeCallback = mockConnection.on.mock.calls.find(
        (call: [string, () => void]) => call[0] === 'close',
      )?.[1];
      expect(closeCallback).toBeDefined();

      closeCallback();

      // 재연결 타이머가 설정되어야 한다
      expect(jest.getTimerCount()).toBe(1);
    });
  });

  // ─── 9. 지수 백오프 재연결 ─────────────────────────────────
  describe('지수 백오프 재연결', () => {
    it('재연결 성공 시 타이머가 정리된다', async () => {
      amqplib.connect.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      await service.onModuleInit();

      // 두 번째 연결은 성공
      amqplib.connect.mockResolvedValueOnce(mockConnection);

      // 타이머 실행 (재연결 시도)
      await jest.advanceTimersByTimeAsync(1000);

      // 재연결 성공 후 추가 타이머 없음
      expect(jest.getTimerCount()).toBe(0);
    });
  });

  // ─── 10. error 이벤트 핸들러 ───────────────────────────────
  describe('error 이벤트 핸들러', () => {
    it('error 이벤트 콜백이 등록되며 에러 로깅만 수행한다', async () => {
      await service.onModuleInit();

      const errorCallback = mockConnection.on.mock.calls.find(
        (call: [string, (err: Error) => void]) => call[0] === 'error',
      )?.[1];
      expect(errorCallback).toBeDefined();

      // 에러 콜백 호출 시 예외가 발생하지 않아야 한다
      expect(() => errorCallback(new Error('test error'))).not.toThrow();
    });
  });

  // ─── 11. publish 재시도 — 1회 실패 후 2회째 성공 ─────────────
  describe('publish() — 1회 실패 후 재시도 성공', () => {
    it('첫 publish 실패 후 두 번째 시도에서 성공한다', async () => {
      await service.onModuleInit();

      mockChannel.publish
        .mockImplementationOnce(() => { throw new Error('channel closed'); })
        .mockReturnValueOnce(true);

      const promise = service.publishGitHubPush(createEvent());
      await jest.advanceTimersByTimeAsync(500);
      await expect(promise).resolves.not.toThrow();

      expect(mockChannel.publish).toHaveBeenCalledTimes(2);
    });
  });

  // ─── 12. publish 재시도 — 3회 모두 실패 시 Error throw ────────
  describe('publish() — 3회 모두 실패', () => {
    it('3회 모두 실패하면 최종 에러를 던진다', async () => {
      await service.onModuleInit();

      mockChannel.publish.mockImplementation(() => { throw new Error('channel broken'); });

      const promise = service.publishGitHubPush(createEvent());
      // 재시도 delay를 해소하기 위해 타이머 전진 (reject 전에 catch 등록)
      const assertion = expect(promise).rejects.toThrow('MQ 발행 최종 실패');
      await jest.advanceTimersByTimeAsync(1000);
      await assertion;

      expect(mockChannel.publish).toHaveBeenCalledTimes(3);
    });
  });

  // ─── 13. publish 재시도 — buffer full (false 반환) 시 재시도 ──
  describe('publish() — buffer full 재시도', () => {
    it('publish가 false를 반환하면 재시도하고, 이후 성공하면 정상 반환한다', async () => {
      await service.onModuleInit();

      mockChannel.publish
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);

      const promise = service.publishAiAnalysis(createEvent());
      await jest.advanceTimersByTimeAsync(500);
      await expect(promise).resolves.not.toThrow();

      expect(mockChannel.publish).toHaveBeenCalledTimes(2);
    });

    it('publish가 계속 false를 반환하면 최종 에러를 던진다', async () => {
      await service.onModuleInit();

      mockChannel.publish.mockReturnValue(false);

      const promise = service.publishAiAnalysis(createEvent());
      const assertion = expect(promise).rejects.toThrow('MQ 발행 최종 실패');
      await jest.advanceTimersByTimeAsync(1000);
      await assertion;

      expect(mockChannel.publish).toHaveBeenCalledTimes(3);
    });
  });

  // ─── 14. scheduleReconnect — 재연결 재시도 실패 시 재스케줄 ───
  describe('scheduleReconnect() — 재연결 재시도 실패 시 재스케줄', () => {
    it('재연결 시도도 실패하면 scheduleReconnect를 재귀 호출한다', async () => {
      // 첫 연결 실패
      amqplib.connect.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      await service.onModuleInit();

      // 재연결 타이머가 1개 설정됨
      expect(jest.getTimerCount()).toBe(1);

      // 두 번째 연결도 실패
      amqplib.connect.mockRejectedValueOnce(new Error('ECONNREFUSED again'));

      // 첫 번째 타이머 실행 (재연결 시도 — 실패)
      await jest.advanceTimersByTimeAsync(1000);

      // 재연결 실패 → 다시 scheduleReconnect → 새 타이머 1개
      expect(jest.getTimerCount()).toBe(1);
    });
  });
});
