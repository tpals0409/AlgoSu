/**
 * worker.ts 단위 테스트 — RabbitMQ, StatusReporter, GitHubPushService mock
 */

// Redis mock (StatusReporter, TokenManager에서 사용)
const mockRedisPublish = jest.fn().mockResolvedValue(1);
const mockRedisGet = jest.fn().mockResolvedValue(null);
const mockRedisSet = jest.fn().mockResolvedValue('OK');
const mockRedisKeys = jest.fn().mockResolvedValue([]);
const mockRedisQuit = jest.fn().mockResolvedValue('OK');

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    publish: mockRedisPublish,
    get: mockRedisGet,
    set: mockRedisSet,
    keys: mockRedisKeys,
    quit: mockRedisQuit,
  }));
});

// config 모킹
jest.mock('./config', () => ({
  config: {
    rabbitmqUrl: 'amqp://localhost',
    redisUrl: 'redis://localhost:6379',
    gatewayInternalUrl: 'http://gateway:3000',
    internalKeyGateway: 'test-internal-key',
    submissionServiceUrl: 'http://submission-service:3003',
    submissionServiceKey: 'test-sub-key',
    maxRetries: 2,
    retryDelayMs: 10, // 테스트에서 빠르게
    githubAppId: '',
    githubAppPrivateKeyBase64: '',
    githubTokenEncryptionKey: 'a'.repeat(64),
  },
}));

// amqplib 모킹
const mockAck = jest.fn();
const mockNack = jest.fn();
const mockPrefetch = jest.fn().mockResolvedValue(undefined);
const mockAssertQueue = jest.fn().mockResolvedValue(undefined);
let consumeCallback: ((msg: any) => Promise<void>) | null = null;
const mockConsume = jest.fn().mockImplementation((_queue: string, cb: any) => {
  consumeCallback = cb;
  return Promise.resolve({ consumerTag: 'test-tag' });
});
const mockChannelClose = jest.fn().mockResolvedValue(undefined);
const mockCreateChannel = jest.fn().mockResolvedValue({
  prefetch: mockPrefetch,
  assertQueue: mockAssertQueue,
  consume: mockConsume,
  ack: mockAck,
  nack: mockNack,
  close: mockChannelClose,
});

const connectionEventHandlers: Record<string, Function> = {};
const mockConnectionOn = jest.fn().mockImplementation((event: string, handler: Function) => {
  connectionEventHandlers[event] = handler;
});
const mockConnectionClose = jest.fn().mockResolvedValue(undefined);

jest.mock('amqplib', () => ({
  connect: jest.fn().mockResolvedValue({
    createChannel: mockCreateChannel,
    on: mockConnectionOn,
    close: mockConnectionClose,
  }),
}));

// metrics 모킹
jest.mock('./metrics', () => ({
  dlqMessagesTotal: { inc: jest.fn() },
  mqMessagesProcessedTotal: { inc: jest.fn() },
}));

// global.fetch 모킹
const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

// logger stdout 억제
jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

import { GitHubWorker } from './worker';
import * as crypto from 'crypto';

// 암호화 헬퍼 (테스트 데이터 생성용)
function encryptToken(token: string): string {
  const key = Buffer.from('a'.repeat(64), 'hex');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${encrypted.toString('hex')}:${tag.toString('hex')}`;
}

describe('GitHubWorker', () => {
  let worker: GitHubWorker;

  beforeEach(() => {
    jest.clearAllMocks();
    consumeCallback = null;
    worker = new GitHubWorker();
  });

  afterEach(async () => {
    await worker.stop();
  });

  describe('start', () => {
    it('RabbitMQ 연결 + 채널 생성 + 큐 구독', async () => {
      await worker.start();

      expect(mockPrefetch).toHaveBeenCalledWith(2);
      expect(mockAssertQueue).toHaveBeenCalledWith(
        'submission.github_push',
        expect.objectContaining({ durable: true }),
      );
      expect(mockConsume).toHaveBeenCalledWith(
        'submission.github_push',
        expect.any(Function),
      );
    });

    it('연결 오류/종료 이벤트 핸들러 등록', async () => {
      await worker.start();

      expect(mockConnectionOn).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockConnectionOn).toHaveBeenCalledWith('close', expect.any(Function));
    });
  });

  describe('메시지 처리', () => {
    const makeMsg = (payload: object) => ({
      content: Buffer.from(JSON.stringify(payload)),
      fields: { deliveryTag: 1, redelivered: false },
    });

    beforeEach(async () => {
      await worker.start();
    });

    it('null 메시지 -- 무시', async () => {
      await consumeCallback!(null);
      expect(mockAck).not.toHaveBeenCalled();
      expect(mockNack).not.toHaveBeenCalled();
    });

    it('JSON 파싱 실패 -- nack(DLQ)', async () => {
      const invalidMsg = {
        content: Buffer.from('not json!!!'),
        fields: { deliveryTag: 99, redelivered: false },
      };

      await consumeCallback!(invalidMsg);

      expect(mockNack).toHaveBeenCalledWith(invalidMsg, false, false);
      expect(mockAck).not.toHaveBeenCalled();
    });

    it('정상 처리 (GitHub 미연동 = SKIPPED) -- ack', async () => {
      // getSubmission 응답
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            userId: 'user-1',
            problemId: 'prob-1',
            studyId: 'study-1',
            language: 'python',
            code: 'print("hi")',
          },
        }),
      });

      // getUserGitHubInfo 응답 -- 토큰 없음
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          github_username: null,
          github_token: null,
        }),
      });

      // reportSkipped 응답
      mockFetch.mockResolvedValueOnce({ ok: true });

      const msg = makeMsg({
        submissionId: 'sub-001',
        studyId: 'study-1',
        timestamp: new Date().toISOString(),
      });

      await consumeCallback!(msg);

      expect(mockAck).toHaveBeenCalledWith(msg);
    });

    it('정상 처리 (GitHub Push 성공) -- ack', async () => {
      const encryptedToken = encryptToken('ghs_test_token');

      // getSubmission
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            userId: 'user-1',
            problemId: 'prob-1',
            studyId: 'study-1',
            language: 'python',
            code: 'print("hi")',
          },
        }),
      });

      // getUserGitHubInfo
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          github_username: 'test-user',
          github_token: encryptedToken,
        }),
      });

      // GitHubPushService.push를 mock
      const pushMock = jest.fn().mockResolvedValue({ filePath: 'test/path.py', sha: 'abc' });
      (worker as any).pushService.push = pushMock;

      // reportSuccess
      mockFetch.mockResolvedValueOnce({ ok: true });

      // publishStatusChange (Redis)
      // (이미 Redis mock 되어 있음)

      const msg = makeMsg({
        submissionId: 'sub-002',
        studyId: 'study-1',
        timestamp: new Date().toISOString(),
      });

      await consumeCallback!(msg);

      expect(mockAck).toHaveBeenCalledWith(msg);
      expect(pushMock).toHaveBeenCalled();
    });

    it('TOKEN_INVALID -- ack (재시도 없이)', async () => {
      const encryptedToken = encryptToken('ghs_test_token');

      // getSubmission
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            userId: 'user-1',
            problemId: 'prob-1',
            studyId: 'study-1',
            language: 'python',
            code: 'print("hi")',
          },
        }),
      });

      // getUserGitHubInfo
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          github_username: 'test-user',
          github_token: encryptedToken,
        }),
      });

      // push 실패 -- TOKEN_INVALID
      (worker as any).pushService.push = jest.fn().mockRejectedValue(new Error('TOKEN_INVALID'));

      // reportTokenInvalid
      mockFetch.mockResolvedValueOnce({ ok: true });

      const msg = makeMsg({
        submissionId: 'sub-003',
        studyId: 'study-1',
        timestamp: new Date().toISOString(),
      });

      await consumeCallback!(msg);

      // TOKEN_INVALID는 ack (DLQ 전송하지 않음)
      expect(mockAck).toHaveBeenCalledWith(msg);
    });

    it('토큰 복호화 실패 -- ack (SKIPPED)', async () => {
      // getSubmission
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            userId: 'user-1',
            problemId: 'prob-1',
            studyId: 'study-1',
            language: 'python',
            code: 'code',
          },
        }),
      });

      // getUserGitHubInfo -- 잘못된 암호화 토큰
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          github_username: 'test-user',
          github_token: 'invalid:encrypted:token',
        }),
      });

      // reportTokenInvalid
      mockFetch.mockResolvedValueOnce({ ok: true });

      const msg = makeMsg({
        submissionId: 'sub-004',
        studyId: 'study-1',
        timestamp: new Date().toISOString(),
      });

      await consumeCallback!(msg);

      expect(mockAck).toHaveBeenCalledWith(msg);
    });

    it('모든 재시도 실패 -- nack(DLQ)', async () => {
      const encryptedToken = encryptToken('ghs_test_token');

      // getSubmission
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            userId: 'user-1',
            problemId: 'prob-1',
            studyId: 'study-1',
            language: 'python',
            code: 'code',
          },
        }),
      });

      // getUserGitHubInfo
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          github_username: 'test-user',
          github_token: encryptedToken,
        }),
      });

      // push 항상 실패 (일반 에러 -- 재시도 대상)
      (worker as any).pushService.push = jest.fn().mockRejectedValue(new Error('Network timeout'));

      // reportFailed
      mockFetch.mockResolvedValueOnce({ ok: true });

      const msg = makeMsg({
        submissionId: 'sub-005',
        studyId: 'study-1',
        timestamp: new Date().toISOString(),
      });

      await consumeCallback!(msg);

      // 모든 재시도 실패 시 nack
      expect(mockNack).toHaveBeenCalledWith(msg, false, false);
    });
  });

  describe('stop', () => {
    it('정상 종료 -- 채널/연결 닫기', async () => {
      await worker.start();
      await worker.stop();

      expect(mockChannelClose).toHaveBeenCalled();
      expect(mockConnectionClose).toHaveBeenCalled();
      expect(mockRedisQuit).toHaveBeenCalled();
    });
  });

  describe('scheduleReconnect', () => {
    it('연결 종료 시 재연결 스케줄링', async () => {
      jest.useFakeTimers();
      await worker.start();

      // close 이벤트 트리거
      connectionEventHandlers['close']?.();

      // 타이머가 설정되었는지 확인
      expect(jest.getTimerCount()).toBeGreaterThan(0);

      jest.useRealTimers();
    });

    it('isShuttingDown일 때 재연결 안 함', async () => {
      jest.useFakeTimers();
      await worker.start();
      await worker.stop(); // isShuttingDown = true

      connectionEventHandlers['close']?.();

      // 타이머 없어야 함 (이전 타이머는 stop에서 정리)
      expect(jest.getTimerCount()).toBe(0);

      jest.useRealTimers();
    });
  });
});
