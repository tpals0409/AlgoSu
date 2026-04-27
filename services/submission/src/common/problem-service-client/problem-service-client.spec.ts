/**
 * @file problem-service-client.spec.ts -- ProblemServiceClient 단위 테스트 (Sprint 135 D9 — Wave C)
 * @domain common
 * @layer test
 * @related problem-service-client.ts
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ProblemServiceClient, type ProblemRequest } from './problem-service-client';
import { CircuitBreakerService } from '../circuit-breaker';

// ─── Mock 팩토리 ────────────────────────────────────────────────
const createMockBreaker = () => ({
  fire: jest.fn(),
});

const mockCircuitBreakerService = () => {
  const breaker = createMockBreaker();
  return {
    createBreaker: jest.fn().mockReturnValue(breaker),
    getBreaker: jest.fn().mockReturnValue(breaker),
    _mockBreaker: breaker,
  };
};

const mockConfigService = () => ({
  get: jest.fn((key: string, defaultValue?: string) => {
    const map: Record<string, string> = {
      PROBLEM_SERVICE_URL: 'http://problem:3002',
      PROBLEM_SERVICE_KEY: 'test-problem-key',
    };
    return map[key] ?? defaultValue ?? '';
  }),
});

describe('ProblemServiceClient', () => {
  let service: ProblemServiceClient;
  let cbService: ReturnType<typeof mockCircuitBreakerService>;
  const originalFetch = global.fetch;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProblemServiceClient,
        { provide: ConfigService, useFactory: mockConfigService },
        { provide: CircuitBreakerService, useFactory: mockCircuitBreakerService },
      ],
    }).compile();

    service = module.get<ProblemServiceClient>(ProblemServiceClient);
    cbService = module.get(CircuitBreakerService);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  // ─── 1. onModuleInit() — host CB 등록 ──────────────────────────
  describe('onModuleInit()', () => {
    it('호스트 단일 CB(`problem-service-internal`)를 fallback option으로 등록한다', () => {
      service.onModuleInit();

      expect(cbService.createBreaker).toHaveBeenCalledWith(
        'problem-service-internal',
        expect.any(Function),
        expect.objectContaining({
          fallback: expect.any(Function),
        }),
      );
    });
  });

  // ─── 2. getSourcePlatform() — 정상 ─────────────────────────────
  describe('getSourcePlatform()', () => {
    beforeEach(() => service.onModuleInit());

    it('CB fire 정상 시 sourcePlatform 문자열을 반환한다', async () => {
      cbService._mockBreaker.fire.mockResolvedValueOnce('baekjoon');

      const result = await service.getSourcePlatform('p1', 's1', 'u1');

      expect(result).toBe('baekjoon');
      expect(cbService._mockBreaker.fire).toHaveBeenCalledWith({
        op: 'getSourcePlatform',
        problemId: 'p1',
        studyId: 's1',
        userId: 'u1',
      });
    });

    it('CB fire 결과가 undefined이면 undefined 반환', async () => {
      cbService._mockBreaker.fire.mockResolvedValueOnce(undefined);

      const result = await service.getSourcePlatform('p1', 's1', 'u1');

      expect(result).toBeUndefined();
    });

    it('CB fire가 throw하면 방어적 catch로 undefined 반환', async () => {
      cbService._mockBreaker.fire.mockRejectedValueOnce(new Error('CB error'));

      const result = await service.getSourcePlatform('p1', 's1', 'u1');

      expect(result).toBeUndefined();
    });
  });

  // ─── 3. getDeadline() — 정상 + fallback ─────────────────────────
  describe('getDeadline()', () => {
    beforeEach(() => service.onModuleInit());

    it('CB fire 결과를 그대로 반환한다 (deadline 있음)', async () => {
      cbService._mockBreaker.fire.mockResolvedValueOnce({
        isLate: true,
        weekNumber: '3월1주차',
      });

      const result = await service.getDeadline('p1', 's1', 'u1');

      expect(result).toEqual({ isLate: true, weekNumber: '3월1주차' });
      expect(cbService._mockBreaker.fire).toHaveBeenCalledWith({
        op: 'getDeadline',
        problemId: 'p1',
        studyId: 's1',
        userId: 'u1',
      });
    });

    it('userId 미전달 시 op payload에서 userId가 undefined로 전달된다', async () => {
      cbService._mockBreaker.fire.mockResolvedValueOnce({
        isLate: false,
        weekNumber: null,
      });

      await service.getDeadline('p1', 's1');

      expect(cbService._mockBreaker.fire).toHaveBeenCalledWith({
        op: 'getDeadline',
        problemId: 'p1',
        studyId: 's1',
        userId: undefined,
      });
    });

    it('CB fire가 throw하면 방어적 catch로 fallback 객체 반환', async () => {
      cbService._mockBreaker.fire.mockRejectedValueOnce(new Error('CB error'));

      const result = await service.getDeadline('p1', 's1', 'u1');

      expect(result).toEqual({ isLate: false, weekNumber: null });
    });
  });

  // ─── 3.5. errorFilter 통과 시 Error resolve 방어 (Critic 3차 P1) ─
  describe('errorFilter 통과 시 Error resolve 방어 (Critic 3차 P1)', () => {
    beforeEach(() => service.onModuleInit());

    it('getSourcePlatform: hostBreaker.fire가 Error를 resolve해도 undefined 반환', async () => {
      // hostBreaker.fire mock이 Error 객체를 resolve로 반환하는 가상 시나리오
      // (현재 opossum 8.x는 reject 호출하나, 향후 동작 변경 대비 defense in depth)
      const errorAsResolve = new Error('AI 404 — errorFilter 통과') as Error & {
        status: number;
      };
      errorAsResolve.status = 404;
      cbService._mockBreaker.fire.mockResolvedValueOnce(errorAsResolve);

      const result = await service.getSourcePlatform('p1', 's1', 'u1');

      expect(result).toBeUndefined();
    });

    it('getDeadline: hostBreaker.fire가 Error를 resolve해도 기본값 반환', async () => {
      const errorAsResolve = new Error('Problem 410 — errorFilter 통과') as Error & {
        status: number;
      };
      errorAsResolve.status = 410;
      cbService._mockBreaker.fire.mockResolvedValueOnce(errorAsResolve);

      const result = await service.getDeadline('p1', 's1', 'u1');

      expect(result).toEqual({ isLate: false, weekNumber: null });
    });
  });

  // ─── 4. _dispatch — op 분기 정확성 ──────────────────────────────
  describe('_dispatch()', () => {
    it('op === "getSourcePlatform"이면 _doGetSourcePlatform을 호출한다', async () => {
      const dispatch = (service as unknown as {
        _dispatch: (req: ProblemRequest) => Promise<unknown>;
      })._dispatch.bind(service);

      const fetchSpy = jest.spyOn(global, 'fetch' as never).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { sourcePlatform: 'leetcode' } }),
      } as never);

      const result = await dispatch({
        op: 'getSourcePlatform',
        problemId: 'p1',
        studyId: 's1',
        userId: 'u1',
      });

      expect(result).toBe('leetcode');
      fetchSpy.mockRestore();
    });

    it('op === "getDeadline"이면 _doGetDeadline을 호출한다', async () => {
      const dispatch = (service as unknown as {
        _dispatch: (req: ProblemRequest) => Promise<unknown>;
      })._dispatch.bind(service);

      const fetchSpy = jest.spyOn(global, 'fetch' as never).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: { deadline: null, weekNumber: '3월2주차', status: 'active' },
        }),
      } as never);

      const result = await dispatch({
        op: 'getDeadline',
        problemId: 'p1',
        studyId: 's1',
        userId: 'u1',
      });

      expect(result).toEqual({ isLate: false, weekNumber: '3월2주차' });
      fetchSpy.mockRestore();
    });

    it('알 수 없는 op는 throw한다', async () => {
      const dispatch = (service as unknown as {
        _dispatch: (req: ProblemRequest) => Promise<unknown>;
      })._dispatch.bind(service);

      await expect(
        dispatch({ op: 'unknownOp' as never, problemId: 'p1', studyId: 's1' }),
      ).rejects.toThrow('Unknown ProblemOp: unknownOp');
    });
  });

  // ─── 5. _doGetSourcePlatform — fetch 검증 ───────────────────────
  describe('_doGetSourcePlatform()', () => {
    it('정상 200 응답 시 sourcePlatform 반환', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch' as never).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { sourcePlatform: 'baekjoon' } }),
      } as never);

      const fn = (service as unknown as {
        _doGetSourcePlatform: (req: ProblemRequest) => Promise<string | undefined>;
      })._doGetSourcePlatform.bind(service);

      const result = await fn({
        op: 'getSourcePlatform',
        problemId: 'p1',
        studyId: 's1',
        userId: 'u1',
      });

      expect(result).toBe('baekjoon');
      expect(fetchSpy).toHaveBeenCalledWith(
        'http://problem:3002/internal/p1',
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-internal-key': 'test-problem-key',
            'x-study-id': 's1',
            'x-user-id': 'u1',
            'Content-Type': 'application/json',
          }),
        }),
      );
      fetchSpy.mockRestore();
    });

    it('sourcePlatform 빈 문자열이면 undefined 반환', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch' as never).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { sourcePlatform: '' } }),
      } as never);

      const fn = (service as unknown as {
        _doGetSourcePlatform: (req: ProblemRequest) => Promise<string | undefined>;
      })._doGetSourcePlatform.bind(service);

      const result = await fn({
        op: 'getSourcePlatform',
        problemId: 'p1',
        studyId: 's1',
        userId: 'u1',
      });

      expect(result).toBeUndefined();
      fetchSpy.mockRestore();
    });

    it('non-2xx 응답 시 status가 첨부된 Error를 throw (errorFilter 분기 가능)', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch' as never).mockResolvedValueOnce({
        ok: false,
        status: 503,
      } as never);

      const fn = (service as unknown as {
        _doGetSourcePlatform: (req: ProblemRequest) => Promise<string | undefined>;
      })._doGetSourcePlatform.bind(service);

      let captured: (Error & { status?: number }) | undefined;
      try {
        await fn({
          op: 'getSourcePlatform',
          problemId: 'p1',
          studyId: 's1',
          userId: 'u1',
        });
      } catch (e) {
        captured = e as Error & { status?: number };
      }

      expect(captured).toBeInstanceOf(Error);
      expect(captured?.status).toBe(503);
      expect(captured?.message).toContain('sourcePlatform 조회 실패');
      fetchSpy.mockRestore();
    });

    it('non-2xx 404 응답 시 status=404 첨부 (화이트리스트 통과)', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch' as never).mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as never);

      const fn = (service as unknown as {
        _doGetSourcePlatform: (req: ProblemRequest) => Promise<string | undefined>;
      })._doGetSourcePlatform.bind(service);

      let captured: (Error & { status?: number }) | undefined;
      try {
        await fn({
          op: 'getSourcePlatform',
          problemId: 'p1',
          studyId: 's1',
          userId: 'u1',
        });
      } catch (e) {
        captured = e as Error & { status?: number };
      }

      expect(captured?.status).toBe(404);
      fetchSpy.mockRestore();
    });
  });

  // ─── 6. _doGetDeadline — fetch 검증 ─────────────────────────────
  describe('_doGetDeadline()', () => {
    it('200 응답 + deadline 과거 → isLate=true', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch' as never).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            deadline: '2020-01-01T00:00:00Z',
            weekNumber: '3월1주차',
            status: 'active',
          },
        }),
      } as never);

      const fn = (service as unknown as {
        _doGetDeadline: (
          req: ProblemRequest,
        ) => Promise<{ isLate: boolean; weekNumber: string | null }>;
      })._doGetDeadline.bind(service);

      const result = await fn({
        op: 'getDeadline',
        problemId: 'p1',
        studyId: 's1',
        userId: 'u1',
      });

      expect(result).toEqual({ isLate: true, weekNumber: '3월1주차' });
      fetchSpy.mockRestore();
    });

    it('200 응답 + deadline 미래 → isLate=false', async () => {
      const future = new Date(Date.now() + 7 * 86_400_000).toISOString();
      const fetchSpy = jest.spyOn(global, 'fetch' as never).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: { deadline: future, weekNumber: '3월2주차', status: 'active' },
        }),
      } as never);

      const fn = (service as unknown as {
        _doGetDeadline: (
          req: ProblemRequest,
        ) => Promise<{ isLate: boolean; weekNumber: string | null }>;
      })._doGetDeadline.bind(service);

      const result = await fn({
        op: 'getDeadline',
        problemId: 'p1',
        studyId: 's1',
        userId: 'u1',
      });

      expect(result.isLate).toBe(false);
      expect(result.weekNumber).toBe('3월2주차');
      fetchSpy.mockRestore();
    });

    it('200 응답 + deadline=null → isLate=false, weekNumber 보존', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch' as never).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: { deadline: null, weekNumber: '3월3주차', status: 'active' },
        }),
      } as never);

      const fn = (service as unknown as {
        _doGetDeadline: (
          req: ProblemRequest,
        ) => Promise<{ isLate: boolean; weekNumber: string | null }>;
      })._doGetDeadline.bind(service);

      const result = await fn({
        op: 'getDeadline',
        problemId: 'p1',
        studyId: 's1',
        userId: 'u1',
      });

      expect(result).toEqual({ isLate: false, weekNumber: '3월3주차' });
      fetchSpy.mockRestore();
    });

    it('200 응답 + deadline=null + weekNumber=undefined → weekNumber=null', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch' as never).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: { deadline: null, weekNumber: undefined, status: 'active' },
        }),
      } as never);

      const fn = (service as unknown as {
        _doGetDeadline: (
          req: ProblemRequest,
        ) => Promise<{ isLate: boolean; weekNumber: string | null }>;
      })._doGetDeadline.bind(service);

      const result = await fn({
        op: 'getDeadline',
        problemId: 'p1',
        studyId: 's1',
        userId: 'u1',
      });

      expect(result).toEqual({ isLate: false, weekNumber: null });
      fetchSpy.mockRestore();
    });

    it('200 응답 + deadline 있음 + weekNumber 미설정 → weekNumber=null', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch' as never).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: { deadline: '2020-01-01T00:00:00Z', weekNumber: null, status: 'active' },
        }),
      } as never);

      const fn = (service as unknown as {
        _doGetDeadline: (
          req: ProblemRequest,
        ) => Promise<{ isLate: boolean; weekNumber: string | null }>;
      })._doGetDeadline.bind(service);

      const result = await fn({
        op: 'getDeadline',
        problemId: 'p1',
        studyId: 's1',
        userId: 'u1',
      });

      expect(result).toEqual({ isLate: true, weekNumber: null });
      fetchSpy.mockRestore();
    });

    it('non-2xx 응답 시 status가 첨부된 Error를 throw', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch' as never).mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as never);

      const fn = (service as unknown as {
        _doGetDeadline: (
          req: ProblemRequest,
        ) => Promise<{ isLate: boolean; weekNumber: string | null }>;
      })._doGetDeadline.bind(service);

      let captured: (Error & { status?: number }) | undefined;
      try {
        await fn({
          op: 'getDeadline',
          problemId: 'p1',
          studyId: 's1',
          userId: 'u1',
        });
      } catch (e) {
        captured = e as Error & { status?: number };
      }

      expect(captured).toBeInstanceOf(Error);
      expect(captured?.status).toBe(500);
      expect(captured?.message).toContain('마감 시간 조회 실패');
      fetchSpy.mockRestore();
    });

    it('userId 미전달 시 x-user-id 헤더가 누락된다', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch' as never).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: { deadline: null, weekNumber: null, status: 'active' },
        }),
      } as never);

      const fn = (service as unknown as {
        _doGetDeadline: (
          req: ProblemRequest,
        ) => Promise<{ isLate: boolean; weekNumber: string | null }>;
      })._doGetDeadline.bind(service);

      await fn({ op: 'getDeadline', problemId: 'p1', studyId: 's1' });

      const callArgs = (fetchSpy.mock.calls[0] as unknown as [string, RequestInit])[1];
      const headers = callArgs.headers as Record<string, string>;
      expect(headers['x-user-id']).toBeUndefined();
      expect(headers['x-study-id']).toBe('s1');
      fetchSpy.mockRestore();
    });
  });

  // ─── 6.5. env 미설정 시 즉시 fallback (Critic 4차 P2 — URL+KEY 둘 다) ─
  describe('env 미설정 시 즉시 fallback (Critic 4차 P2 — URL+KEY 둘 다)', () => {
    beforeEach(() => service.onModuleInit());

    // ── KEY 단독 미설정 (Critic 1차 P2 보존) ────────────────────────
    it('getSourcePlatform: PROBLEM_SERVICE_KEY 미설정 시 fetch 미발생 + undefined 즉시 반환', async () => {
      // 인스턴스 필드를 직접 비워 env miss 시뮬레이션 (테스트 격리: this 테스트 케이스 한정)
      (service as unknown as { problemServiceKey: string }).problemServiceKey = '';
      const fetchSpy = jest.spyOn(global, 'fetch' as never);

      const result = await service.getSourcePlatform('p1', 's1', 'u1');

      expect(result).toBeUndefined();
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(cbService._mockBreaker.fire).not.toHaveBeenCalled();
      fetchSpy.mockRestore();
    });

    it('getDeadline: PROBLEM_SERVICE_KEY 미설정 시 fetch 미발생 + 기본값 즉시 반환', async () => {
      (service as unknown as { problemServiceKey: string }).problemServiceKey = '';
      const fetchSpy = jest.spyOn(global, 'fetch' as never);

      const result = await service.getDeadline('p1', 's1');

      expect(result).toEqual({ isLate: false, weekNumber: null });
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(cbService._mockBreaker.fire).not.toHaveBeenCalled();
      fetchSpy.mockRestore();
    });

    // ── URL 단독 미설정 (Critic 4차 P2 신규) ────────────────────────
    it('getSourcePlatform: PROBLEM_SERVICE_URL 미설정 시 fetch 미발생 + undefined 즉시 반환', async () => {
      (service as unknown as { problemServiceUrl: string }).problemServiceUrl = '';
      const fetchSpy = jest.spyOn(global, 'fetch' as never);

      const result = await service.getSourcePlatform('p1', 's1', 'u1');

      expect(result).toBeUndefined();
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(cbService._mockBreaker.fire).not.toHaveBeenCalled();
      fetchSpy.mockRestore();
    });

    it('getDeadline: PROBLEM_SERVICE_URL 미설정 시 fetch 미발생 + 기본값 즉시 반환', async () => {
      (service as unknown as { problemServiceUrl: string }).problemServiceUrl = '';
      const fetchSpy = jest.spyOn(global, 'fetch' as never);

      const result = await service.getDeadline('p1', 's1');

      expect(result).toEqual({ isLate: false, weekNumber: null });
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(cbService._mockBreaker.fire).not.toHaveBeenCalled();
      fetchSpy.mockRestore();
    });

    // ── URL + KEY 둘 다 미설정 (Critic 4차 P2 신규) ─────────────────
    it('getSourcePlatform: URL+KEY 둘 다 미설정 시 fetch 미발생 + undefined 즉시 반환', async () => {
      const target = service as unknown as {
        problemServiceUrl: string;
        problemServiceKey: string;
      };
      target.problemServiceUrl = '';
      target.problemServiceKey = '';
      const fetchSpy = jest.spyOn(global, 'fetch' as never);

      const result = await service.getSourcePlatform('p1', 's1', 'u1');

      expect(result).toBeUndefined();
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(cbService._mockBreaker.fire).not.toHaveBeenCalled();
      fetchSpy.mockRestore();
    });

    it('getDeadline: URL+KEY 둘 다 미설정 시 fetch 미발생 + 기본값 즉시 반환', async () => {
      const target = service as unknown as {
        problemServiceUrl: string;
        problemServiceKey: string;
      };
      target.problemServiceUrl = '';
      target.problemServiceKey = '';
      const fetchSpy = jest.spyOn(global, 'fetch' as never);

      const result = await service.getDeadline('p1', 's1');

      expect(result).toEqual({ isLate: false, weekNumber: null });
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(cbService._mockBreaker.fire).not.toHaveBeenCalled();
      fetchSpy.mockRestore();
    });

    // ── ConfigService에서 undefined 반환 시 default 미적용 검증 (Critic 4차 P2) ─
    it('constructor: ConfigService.get이 undefined 반환 시 default 적용 안되고 빈 문자열 보존', async () => {
      // 신규 모듈 — get()이 undefined 반환하도록 mock
      const customConfig = {
        get: jest.fn(() => undefined),
      };
      const customCb = mockCircuitBreakerService();
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ProblemServiceClient,
          { provide: ConfigService, useValue: customConfig },
          { provide: CircuitBreakerService, useValue: customCb },
        ],
      }).compile();

      const newClient = module.get<ProblemServiceClient>(ProblemServiceClient);
      newClient.onModuleInit();

      const target = newClient as unknown as {
        problemServiceUrl: string;
        problemServiceKey: string;
      };
      // default 호스트(`http://problem-service:3002`)로 fallback되지 않고 빈 문자열 유지 확인
      expect(target.problemServiceUrl).toBe('');
      expect(target.problemServiceKey).toBe('');

      // isConfigReady() false → fetch/CB 둘 다 미호출
      const fetchSpy = jest.spyOn(global, 'fetch' as never);
      const result = await newClient.getSourcePlatform('p1', 's1', 'u1');

      expect(result).toBeUndefined();
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(customCb._mockBreaker.fire).not.toHaveBeenCalled();
      fetchSpy.mockRestore();
    });
  });

  // ─── 7. _fallback — op별 반환 값 ────────────────────────────────
  describe('_fallback()', () => {
    it('op === "getSourcePlatform" → undefined', () => {
      const fn = (service as unknown as {
        _fallback: (req: ProblemRequest) => unknown;
      })._fallback.bind(service);

      const result = fn({
        op: 'getSourcePlatform',
        problemId: 'p1',
        studyId: 's1',
      });

      expect(result).toBeUndefined();
    });

    it('op === "getDeadline" → {isLate:false, weekNumber:null}', () => {
      const fn = (service as unknown as {
        _fallback: (req: ProblemRequest) => unknown;
      })._fallback.bind(service);

      const result = fn({ op: 'getDeadline', problemId: 'p1', studyId: 's1' });

      expect(result).toEqual({ isLate: false, weekNumber: null });
    });

    it('알 수 없는 op → null (방어적 분기)', () => {
      const fn = (service as unknown as {
        _fallback: (req: ProblemRequest) => unknown;
      })._fallback.bind(service);

      const result = fn({
        op: 'unknown' as never,
        problemId: 'p1',
        studyId: 's1',
      });

      expect(result).toBeNull();
    });
  });
});
