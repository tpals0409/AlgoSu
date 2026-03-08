/**
 * status-reporter.ts 단위 테스트
 */

// Redis 모킹
const mockRedisPublish = jest.fn().mockResolvedValue(1);
const mockRedisQuit = jest.fn().mockResolvedValue('OK');

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    publish: mockRedisPublish,
    quit: mockRedisQuit,
  }));
});

// config 모킹
jest.mock('./config', () => ({
  config: {
    rabbitmqUrl: 'amqp://localhost',
    redisUrl: 'redis://localhost:6379',
    gatewayInternalUrl: 'http://gateway:3000',
    internalKeyGateway: '',
    submissionServiceUrl: 'http://submission-service:3003',
    submissionServiceKey: 'test-key',
    maxRetries: 3,
    retryDelayMs: 5000,
    githubAppId: '',
    githubAppPrivateKeyBase64: '',
    githubTokenEncryptionKey: 'a'.repeat(64),
  },
}));

// global.fetch 모킹
const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

import { StatusReporter } from './status-reporter';

describe('StatusReporter', () => {
  let reporter: StatusReporter;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    reporter = new StatusReporter();
  });

  afterEach(async () => {
    await reporter.close();
    (process.stdout.write as jest.Mock).mockRestore();
  });

  describe('getSubmission', () => {
    it('정상 조회 -- SubmissionData 반환', async () => {
      const submissionData = {
        userId: 'user-1',
        problemId: 'prob-1',
        studyId: 'study-1',
        language: 'python',
        code: 'print("hi")',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: submissionData }),
      });

      const result = await reporter.getSubmission('sub-001');

      expect(result).toEqual(submissionData);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://submission-service:3003/internal/sub-001',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Internal-Key': 'test-key',
          }),
        }),
      );
    });

    it('조회 실패 -- 에러 throw', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      await expect(reporter.getSubmission('sub-999')).rejects.toThrow(
        'Submission 조회 실패: 404',
      );
    });
  });

  describe('reportSuccess', () => {
    it('성공 보고 HTTP POST 호출', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await reporter.reportSuccess('sub-001', 'submissions/prob-1/sub-001.py');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://submission-service:3003/internal/sub-001/github-success',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ filePath: 'submissions/prob-1/sub-001.py' }),
        }),
      );
    });

    it('응답 실패 시 에러 throw', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      await expect(
        reporter.reportSuccess('sub-001', 'submissions/prob-1/sub-001.py'),
      ).rejects.toThrow('reportSuccess 실패: 500');
    });
  });

  describe('reportFailed', () => {
    it('실패 보고 HTTP POST 호출', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await reporter.reportFailed('sub-001');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://submission-service:3003/internal/sub-001/github-failed',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('응답 실패 시 에러 throw', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 502 });

      await expect(reporter.reportFailed('sub-001')).rejects.toThrow(
        'reportFailed 실패: 502',
      );
    });
  });

  describe('reportTokenInvalid', () => {
    it('TOKEN_INVALID 보고 HTTP POST 호출', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await reporter.reportTokenInvalid('sub-001');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://submission-service:3003/internal/sub-001/github-token-invalid',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('응답 실패 시 에러 throw', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 503 });

      await expect(reporter.reportTokenInvalid('sub-001')).rejects.toThrow(
        'reportTokenInvalid 실패: 503',
      );
    });
  });

  describe('reportSkipped', () => {
    it('SKIPPED 보고 + Redis Pub/Sub 발행', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await reporter.reportSkipped('sub-001');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://submission-service:3003/internal/sub-001/github-skipped',
        expect.objectContaining({ method: 'POST' }),
      );

      expect(mockRedisPublish).toHaveBeenCalledWith(
        'submission:status:sub-001',
        expect.stringContaining('"status":"github_skipped"'),
      );
    });

    it('응답 실패 시 에러 throw (Pub/Sub 미발행)', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      await expect(reporter.reportSkipped('sub-001')).rejects.toThrow(
        'reportSkipped 실패: 500',
      );

      expect(mockRedisPublish).not.toHaveBeenCalled();
    });
  });

  describe('publishStatusChange', () => {
    it('Redis Pub/Sub 채널로 상태 발행', async () => {
      await reporter.publishStatusChange('sub-002', 'github_synced');

      expect(mockRedisPublish).toHaveBeenCalledWith(
        'submission:status:sub-002',
        expect.stringContaining('"status":"github_synced"'),
      );
    });
  });

  describe('close', () => {
    it('Redis 연결 종료', async () => {
      await reporter.close();

      expect(mockRedisQuit).toHaveBeenCalled();
    });
  });
});
