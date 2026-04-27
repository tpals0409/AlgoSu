/**
 * status-reporter.ts 단위 테스트 — CircuitBreakerManager 주입 + 호스트 단일 CB
 *
 * Sprint 135 Wave B (Critic 3차 P1): 5개 메서드별 CB → 호스트 단일 CB(`submission-internal`).
 * generic dispatcher(`_dispatch` + `_resolveEndpoint`)로 op별 분기.
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

// logger stdout 억제
jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

import { Registry } from 'prom-client';
import { StatusReporter } from './status-reporter';
import { CircuitBreakerManager } from './circuit-breaker';

/** _resolveEndpoint / _dispatch 단위 호출용 internal 타입 */
interface ReporterInternals {
  _dispatch(req: { op: string; submissionId: string; body?: unknown }): Promise<unknown>;
  _resolveEndpoint(
    op: string,
    submissionId: string,
  ): { method: 'GET' | 'POST'; path: string; hasJsonResponse: boolean };
}

describe('StatusReporter', () => {
  let reporter: StatusReporter;
  let cbManager: CircuitBreakerManager;
  let registry: Registry;

  beforeEach(() => {
    jest.clearAllMocks();
    registry = new Registry();
    cbManager = new CircuitBreakerManager(registry);
    reporter = new StatusReporter(cbManager);
  });

  afterEach(async () => {
    await reporter.close();
    cbManager.shutdown();
  });

  describe('생성자 — CB 등록 (Critic 3차 P1: 호스트 단일 CB)', () => {
    it('호스트 단일 CB(`submission-internal`)만 등록된다', () => {
      expect(cbManager.getBreaker('submission-internal')).toBeDefined();
    });

    it('기존 메서드별 CB는 등록되지 않는다 (호스트 단일 CB로 통합)', () => {
      // Critic 3차 P1: 5개 메서드별 CB → 1개 호스트 CB로 통합 (host-isolation 강화)
      expect(cbManager.getBreaker('submission-getSubmission')).toBeUndefined();
      expect(cbManager.getBreaker('submission-reportSuccess')).toBeUndefined();
      expect(cbManager.getBreaker('submission-reportFailed')).toBeUndefined();
      expect(cbManager.getBreaker('submission-reportTokenInvalid')).toBeUndefined();
      expect(cbManager.getBreaker('submission-reportSkipped')).toBeUndefined();
    });
  });

  describe('_resolveEndpoint — op별 endpoint 매핑', () => {
    let internals: ReporterInternals;

    beforeEach(() => {
      internals = reporter as unknown as ReporterInternals;
    });

    it('get → GET /internal/{id}, hasJsonResponse=true', () => {
      expect(internals._resolveEndpoint('get', 'sub-1')).toEqual({
        method: 'GET',
        path: '/internal/sub-1',
        hasJsonResponse: true,
      });
    });

    it('reportSuccess → POST /internal/{id}/github-success, hasJsonResponse=false', () => {
      expect(internals._resolveEndpoint('reportSuccess', 'sub-2')).toEqual({
        method: 'POST',
        path: '/internal/sub-2/github-success',
        hasJsonResponse: false,
      });
    });

    it('reportFailed → POST /internal/{id}/github-failed, hasJsonResponse=false', () => {
      expect(internals._resolveEndpoint('reportFailed', 'sub-3')).toEqual({
        method: 'POST',
        path: '/internal/sub-3/github-failed',
        hasJsonResponse: false,
      });
    });

    it('reportTokenInvalid → POST /internal/{id}/github-token-invalid, hasJsonResponse=false', () => {
      expect(internals._resolveEndpoint('reportTokenInvalid', 'sub-4')).toEqual({
        method: 'POST',
        path: '/internal/sub-4/github-token-invalid',
        hasJsonResponse: false,
      });
    });

    it('reportSkipped → POST /internal/{id}/github-skipped, hasJsonResponse=false', () => {
      expect(internals._resolveEndpoint('reportSkipped', 'sub-5')).toEqual({
        method: 'POST',
        path: '/internal/sub-5/github-skipped',
        hasJsonResponse: false,
      });
    });
  });

  describe('_dispatch — op별 fetch 호출', () => {
    let internals: ReporterInternals;

    beforeEach(() => {
      internals = reporter as unknown as ReporterInternals;
    });

    it('get op: GET 메서드 + JSON 응답 파싱', async () => {
      const data = { data: { userId: 'u', problemId: 'p', studyId: 's', language: 'py', code: '' } };
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => data });

      const result = await internals._dispatch({ op: 'get', submissionId: 'sub-1' });

      expect(result).toEqual(data);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://submission-service:3003/internal/sub-1',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({ 'X-Internal-Key': 'test-key' }),
        }),
      );
      // body 미전달 검증
      const init = mockFetch.mock.calls[0][1] as { body?: unknown };
      expect(init.body).toBeUndefined();
    });

    it('reportSuccess op: POST + body JSON 직렬화', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      const result = await internals._dispatch({
        op: 'reportSuccess',
        submissionId: 'sub-2',
        body: { filePath: '/p/sub-2.py' },
      });

      expect(result).toBeNull();
      expect(mockFetch).toHaveBeenCalledWith(
        'http://submission-service:3003/internal/sub-2/github-success',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ filePath: '/p/sub-2.py' }),
        }),
      );
    });

    it('reportFailed op: body 없는 POST', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      const result = await internals._dispatch({ op: 'reportFailed', submissionId: 'sub-3' });

      expect(result).toBeNull();
      const init = mockFetch.mock.calls[0][1] as { method?: string; body?: unknown };
      expect(init.method).toBe('POST');
      expect(init.body).toBeUndefined();
    });

    it('non-ok 응답: status 첨부 에러 throw', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      let caught: (Error & { status?: number }) | null = null;
      try {
        await internals._dispatch({ op: 'reportFailed', submissionId: 'sub-x' });
      } catch (e) {
        caught = e as Error & { status?: number };
      }

      expect(caught).not.toBeNull();
      expect(caught!.status).toBe(500);
      expect(caught!.message).toContain('submission reportFailed 실패');
      expect(caught!.message).toContain('500');
    });
  });

  describe('getSubmission — public API', () => {
    it('정상 조회 → SubmissionData 반환 (hostBreaker 경유)', async () => {
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

    it('조회 실패(404) → 에러 throw', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

      await expect(reporter.getSubmission('sub-999')).rejects.toThrow(
        /submission get 실패.*404/,
      );
    });
  });

  describe('reportSuccess — public API', () => {
    it('성공 보고 HTTP POST 호출 (filePath body 포함)', async () => {
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

    it('응답 실패(500) 시 에러 throw', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      await expect(
        reporter.reportSuccess('sub-001', 'submissions/prob-1/sub-001.py'),
      ).rejects.toThrow(/submission reportSuccess 실패.*500/);
    });
  });

  describe('reportFailed — public API', () => {
    it('실패 보고 HTTP POST 호출', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await reporter.reportFailed('sub-001');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://submission-service:3003/internal/sub-001/github-failed',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('응답 실패(502) 시 에러 throw', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 502 });

      await expect(reporter.reportFailed('sub-001')).rejects.toThrow(
        /submission reportFailed 실패.*502/,
      );
    });
  });

  describe('reportTokenInvalid — public API', () => {
    it('TOKEN_INVALID 보고 HTTP POST 호출', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await reporter.reportTokenInvalid('sub-001');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://submission-service:3003/internal/sub-001/github-token-invalid',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('응답 실패(503) 시 에러 throw', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 503 });

      await expect(reporter.reportTokenInvalid('sub-001')).rejects.toThrow(
        /submission reportTokenInvalid 실패.*503/,
      );
    });
  });

  describe('reportSkipped — public API', () => {
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

    it('응답 실패(500) 시 에러 throw + Pub/Sub 미발행', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      await expect(reporter.reportSkipped('sub-001')).rejects.toThrow(
        /submission reportSkipped 실패.*500/,
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

  describe('Sprint 135 D7 — throw 시 status 첨부 (op별)', () => {
    interface HttpAwareError extends Error {
      status?: number;
    }

    it('get op non-ok → 에러에 status 첨부 (404)', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

      let caught: HttpAwareError | null = null;
      try {
        await reporter.getSubmission('sub-x');
      } catch (e) {
        caught = e as HttpAwareError;
      }

      expect(caught).not.toBeNull();
      expect(caught!.status).toBe(404);
    });

    it('reportSuccess op non-ok → 에러에 status 첨부 (500)', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      let caught: HttpAwareError | null = null;
      try {
        await reporter.reportSuccess('sub-y', '/path');
      } catch (e) {
        caught = e as HttpAwareError;
      }

      expect(caught).not.toBeNull();
      expect(caught!.status).toBe(500);
    });

    it('reportFailed op non-ok → 에러에 status 첨부 (502)', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 502 });

      let caught: HttpAwareError | null = null;
      try {
        await reporter.reportFailed('sub-z');
      } catch (e) {
        caught = e as HttpAwareError;
      }

      expect(caught).not.toBeNull();
      expect(caught!.status).toBe(502);
    });

    it('reportTokenInvalid op non-ok → 에러에 status 첨부 (503)', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 503 });

      let caught: HttpAwareError | null = null;
      try {
        await reporter.reportTokenInvalid('sub-w');
      } catch (e) {
        caught = e as HttpAwareError;
      }

      expect(caught).not.toBeNull();
      expect(caught!.status).toBe(503);
    });

    it('reportSkipped op non-ok → 에러에 status 첨부 (500)', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      let caught: HttpAwareError | null = null;
      try {
        await reporter.reportSkipped('sub-v');
      } catch (e) {
        caught = e as HttpAwareError;
      }

      expect(caught).not.toBeNull();
      expect(caught!.status).toBe(500);
    });
  });
});
