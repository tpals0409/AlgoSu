/**
 * logger.ts 단위 테스트
 */

// config 모킹
jest.mock('./config', () => ({
  config: {
    rabbitmqUrl: 'amqp://localhost',
    redisUrl: 'redis://localhost:6379',
    gatewayInternalUrl: 'http://gateway:3000',
    internalKeyGateway: '',
    submissionServiceUrl: 'http://submission-service:3003',
    submissionServiceKey: '',
    maxRetries: 3,
    retryDelayMs: 5000,
    githubAppId: '',
    githubAppPrivateKeyBase64: '',
    githubTokenEncryptionKey: 'a'.repeat(64),
  },
}));

import { logger, logMqConsume, logMqConsumeDone, logDlqReceived } from './logger';

describe('logger', () => {
  let stdoutSpy: jest.SpyInstance;

  beforeEach(() => {
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
  });

  it('info() -- JSON 구조화 로그 출력', () => {
    logger.info('테스트 메시지', { traceId: 'trace-1' });

    expect(stdoutSpy).toHaveBeenCalledTimes(1);
    const output = stdoutSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);

    expect(parsed.level).toBe('info');
    expect(parsed.message).toBe('테스트 메시지');
    expect(parsed.traceId).toBe('trace-1');
    expect(parsed.service).toBe('github-worker');
    expect(parsed.ts).toBeDefined();
    expect(parsed.pid).toBeDefined();
  });

  it('debug() -- development 환경에서 출력됨', () => {
    logger.debug('디버그 메시지');

    expect(stdoutSpy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
    expect(parsed.level).toBe('debug');
  });

  it('warn() -- 경고 로그 출력', () => {
    logger.warn('경고 메시지', { code: 'GHW_BIZ_001' });

    const parsed = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
    expect(parsed.level).toBe('warn');
    expect(parsed.code).toBe('GHW_BIZ_001');
  });

  it('error() -- 에러 로그 + 에러 직렬화', () => {
    const testError = new Error('테스트 에러');
    logger.error('에러 발생', { err: testError, code: 'MQ_001' });

    const parsed = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
    expect(parsed.level).toBe('error');
    expect(parsed.error.name).toBe('Error');
    expect(parsed.error.message).toBe('테스트 에러');
    expect(parsed.error.code).toBe('MQ_001');
  });

  it('error() -- 비-Error 객체 직렬화', () => {
    logger.error('문자열 에러', { err: 'string error' });

    const parsed = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
    expect(parsed.error.name).toBe('UnknownError');
    expect(parsed.error.message).toBe('string error');
  });

  it('MQ 확장 필드 포함', () => {
    logger.info('MQ 소비', {
      queue: 'test-queue',
      deliveryTag: 42,
      redelivered: false,
      durationMs: 150,
      result: 'ACK',
    });

    const parsed = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
    expect(parsed.queue).toBe('test-queue');
    expect(parsed.deliveryTag).toBe(42);
    expect(parsed.redelivered).toBe(false);
    expect(parsed.durationMs).toBe(150);
  });

  it('Saga 확장 필드 포함', () => {
    logger.info('Saga 전환', {
      tag: 'SAGA_TRANSITION',
      from: 'GITHUB_QUEUED',
      to: 'AI_QUEUED',
      studyId: 'study-1',
      userId: 'user-1',
    });

    const parsed = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
    expect(parsed.tag).toBe('SAGA_TRANSITION');
    expect(parsed.from).toBe('GITHUB_QUEUED');
    expect(parsed.to).toBe('AI_QUEUED');
  });

  it('제어문자 제거 (Log Injection 방지)', () => {
    logger.info('악의적\x00메시지\x1f주입');

    const parsed = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
    expect(parsed.message).toBe('악의적메시지주입');
  });

  it('queue 필드도 제어문자 제거', () => {
    logger.info('큐 테스트', { queue: 'test\x00queue' });

    const parsed = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
    expect(parsed.queue).toBe('testqueue');
  });

  it('code만 있고 err 없을 때 code 필드 직접 포함', () => {
    logger.warn('코드만', { code: 'GHW_BIZ_005' });

    const parsed = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
    expect(parsed.code).toBe('GHW_BIZ_005');
    expect(parsed.error).toBeUndefined();
  });

  it('delayMs, attempt 필드 포함', () => {
    logger.warn('재연결', { delayMs: 2000, attempt: 3 });

    const parsed = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
    expect(parsed.delayMs).toBe(2000);
    expect(parsed.attempt).toBe(3);
  });
});

describe('logMqConsume', () => {
  let stdoutSpy: jest.SpyInstance;

  beforeEach(() => {
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
  });

  it('MQ_CONSUME 로그 출력', () => {
    logMqConsume({
      traceId: 'trace-123',
      queue: 'submission.github_push',
      deliveryTag: 1,
      redelivered: false,
    });

    const parsed = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
    expect(parsed.tag).toBe('MQ_CONSUME');
    expect(parsed.queue).toBe('submission.github_push');
    expect(parsed.deliveryTag).toBe(1);
  });

  it('messageAgeMs 포함', () => {
    logMqConsume({
      traceId: 'trace-123',
      queue: 'test',
      deliveryTag: 1,
      redelivered: false,
      messageAgeMs: 5000,
    });

    const parsed = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
    expect(parsed.messageAgeMs).toBe(5000);
  });
});

describe('logMqConsumeDone', () => {
  let stdoutSpy: jest.SpyInstance;

  beforeEach(() => {
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
  });

  it('ACK 결과 -- info 레벨 로그', () => {
    logMqConsumeDone({
      traceId: 'trace-1',
      queue: 'test-q',
      deliveryTag: 1,
      redelivered: false,
      result: 'ACK',
      durationMs: 100,
    });

    const parsed = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
    expect(parsed.level).toBe('info');
    expect(parsed.tag).toBe('MQ_CONSUME_DONE');
    expect(parsed.result).toBe('ACK');
  });

  it('NACK_DLQ 결과 -- error 레벨 로그', () => {
    logMqConsumeDone({
      traceId: 'trace-1',
      queue: 'test-q',
      deliveryTag: 1,
      redelivered: true,
      result: 'NACK_DLQ',
      durationMs: 200,
    });

    const parsed = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
    expect(parsed.level).toBe('error');
    expect(parsed.result).toBe('NACK_DLQ');
  });
});

describe('logDlqReceived', () => {
  let stdoutSpy: jest.SpyInstance;

  beforeEach(() => {
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
  });

  it('DLQ_RECEIVED 로그 출력', () => {
    logDlqReceived({
      traceId: 'trace-dlq',
      queue: 'dead-letter-q',
      deliveryTag: 5,
      reason: 'parse_error',
    });

    const parsed = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
    expect(parsed.level).toBe('error');
    expect(parsed.tag).toBe('DLQ_RECEIVED');
    expect(parsed.reason).toBe('parse_error');
  });

  it('DLQ_RECEIVED + 에러 객체 포함', () => {
    logDlqReceived({
      traceId: 'trace-dlq',
      queue: 'dead-letter-q',
      deliveryTag: 5,
      reason: 'process_failure',
      err: new Error('처리 실패'),
    });

    const parsed = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
    expect(parsed.error.message).toBe('처리 실패');
  });
});
