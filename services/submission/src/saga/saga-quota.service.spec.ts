import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SagaQuotaService } from './saga-quota.service';
import { CircuitBreakerService } from '../common/circuit-breaker';

// ─── Mock 팩토리 ────────────────────────────────────────────────
const mockCircuitBreakerService = () => {
  const mockBreaker = { fire: jest.fn().mockResolvedValue(true) };
  return {
    createBreaker: jest.fn().mockReturnValue(mockBreaker),
    getBreaker: jest.fn().mockReturnValue(mockBreaker),
    getState: jest.fn().mockReturnValue('CLOSED'),
    _mockBreaker: mockBreaker,
  };
};

const mockConfigService = () => ({
  get: jest.fn((key: string, defaultValue?: string) => {
    const map: Record<string, string> = {
      AI_ANALYSIS_SERVICE_URL: 'http://ai-analysis:8000',
      INTERNAL_KEY_AI_ANALYSIS: 'test-ai-key',
    };
    return map[key] ?? defaultValue ?? '';
  }),
  getOrThrow: jest.fn((key: string) => {
    const map: Record<string, string> = {
      AI_ANALYSIS_SERVICE_URL: 'http://ai-analysis:8000',
      INTERNAL_KEY_AI_ANALYSIS: 'test-ai-key',
    };
    const value = map[key];
    if (value === undefined) throw new Error(`Missing config: ${key}`);
    return value;
  }),
});

describe('SagaQuotaService', () => {
  let service: SagaQuotaService;
  let cbService: ReturnType<typeof mockCircuitBreakerService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SagaQuotaService,
        { provide: CircuitBreakerService, useFactory: mockCircuitBreakerService },
        { provide: ConfigService, useFactory: mockConfigService },
      ],
    }).compile();

    service = module.get<SagaQuotaService>(SagaQuotaService);
    cbService = module.get(CircuitBreakerService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── 1. CB 등록 (생성자 시점) ─────────────────────────────────
  describe('Circuit Breaker 등록', () => {
    it('생성자에서 aiQuotaCheck CB가 생성된다', () => {
      expect(cbService.createBreaker).toHaveBeenCalledWith(
        'aiQuotaCheck',
        expect.any(Function),
        expect.objectContaining({
          fallback: expect.any(Function),
          // Critic 1차 P1 — fixed endpoint(/quota/check)이므로 errorFilter override 필수
          errorFilter: expect.any(Function),
        }),
      );
    });

    it('aiQuotaCheck CB의 errorFilter override는 모든 에러를 failure로 카운트한다 (Critic 1차 P1)', () => {
      const lastCall = (cbService.createBreaker as jest.Mock).mock.calls.find(
        (c) => c[0] === 'aiQuotaCheck',
      );
      expect(lastCall).toBeDefined();
      const errorFilter = lastCall![2].errorFilter as (err: unknown) => boolean;

      // default 화이트리스트(404/410/422)도 모두 false → CB failure 카운트 (dead service 보호)
      expect(errorFilter(new Error('any'))).toBe(false);
      expect(errorFilter({ status: 404 })).toBe(false);
      expect(errorFilter({ status: 410 })).toBe(false);
      expect(errorFilter({ status: 422 })).toBe(false);
      expect(errorFilter({ status: 401 })).toBe(false);
      expect(errorFilter({ status: 503 })).toBe(false);
      expect(errorFilter(null)).toBe(false);
      expect(errorFilter(undefined)).toBe(false);
    });

    it('CB fallback은 true를 반환한다 (사용자 영향 0)', () => {
      const lastCall = (cbService.createBreaker as jest.Mock).mock.calls.find(
        (c) => c[0] === 'aiQuotaCheck',
      );
      const fallback = lastCall![2].fallback as () => boolean;
      expect(fallback()).toBe(true);
    });
  });

  // ─── 2. checkAiQuota — CB 경유 ────────────────────────────────
  describe('checkAiQuota()', () => {
    it('CB fire가 true를 반환하면 허용한다', async () => {
      cbService._mockBreaker.fire.mockResolvedValueOnce(true);

      const result = await service.checkAiQuota('user-1');

      expect(result).toBe(true);
      expect(cbService.getBreaker).toHaveBeenCalledWith('aiQuotaCheck');
      expect(cbService._mockBreaker.fire).toHaveBeenCalledWith('user-1');
    });

    it('CB fire가 false를 반환하면 한도 초과로 처리한다', async () => {
      cbService._mockBreaker.fire.mockResolvedValueOnce(false);

      const result = await service.checkAiQuota('user-2');

      expect(result).toBe(false);
    });

    it('CB fire 예외 시에도 방어적 catch로 true를 반환한다', async () => {
      cbService._mockBreaker.fire.mockRejectedValueOnce(new Error('CB error'));

      const result = await service.checkAiQuota('user-3');

      expect(result).toBe(true);
    });
  });

  // ─── 3. fetchAiQuota — CB action 본체 직접 검증 ────────────────
  describe('fetchAiQuota (CB action 본체)', () => {
    it('200 OK + allowed=true 응답 시 true 반환', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch' as never).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { allowed: true, used: 1, limit: 10 } }),
      } as never);

      const result = await (
        service as unknown as { fetchAiQuota: (u: string) => Promise<boolean> }
      ).fetchAiQuota('user-1');

      expect(result).toBe(true);
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/quota/check?userId=user-1'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'X-Internal-Key': expect.any(String),
          }),
        }),
      );
      fetchSpy.mockRestore();
    });

    it('200 OK + allowed=false 응답 시 false 반환', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch' as never).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { allowed: false, used: 10, limit: 10 } }),
      } as never);

      const result = await (
        service as unknown as { fetchAiQuota: (u: string) => Promise<boolean> }
      ).fetchAiQuota('user-2');

      expect(result).toBe(false);
      fetchSpy.mockRestore();
    });

    it('non-2xx 응답 시 throw — CB가 failure로 기록 가능', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch' as never).mockResolvedValueOnce({
        ok: false,
        status: 503,
      } as never);

      await expect(
        (service as unknown as { fetchAiQuota: (u: string) => Promise<boolean> }).fetchAiQuota(
          'user-3',
        ),
      ).rejects.toThrow('AI quota check failed: status=503');
      fetchSpy.mockRestore();
    });

    it('non-2xx 응답 시 throw된 에러에 status 속성이 첨부된다 (Sprint 135 D8)', async () => {
      // CB DEFAULT_ERROR_FILTER가 status로 분기 가능하도록 buildHttpError 사용
      const fetchSpy = jest.spyOn(global, 'fetch' as never).mockResolvedValueOnce({
        ok: false,
        status: 503,
      } as never);

      let captured: (Error & { status?: number }) | undefined;
      try {
        await (
          service as unknown as { fetchAiQuota: (u: string) => Promise<boolean> }
        ).fetchAiQuota('user-503');
      } catch (e) {
        captured = e as Error & { status?: number };
      }

      expect(captured).toBeInstanceOf(Error);
      expect(captured?.status).toBe(503);
      fetchSpy.mockRestore();
    });

    it('non-2xx 404 응답 시 throw된 에러 status가 404로 첨부 (errorFilter 화이트리스트 통과)', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch' as never).mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as never);

      let captured: (Error & { status?: number }) | undefined;
      try {
        await (
          service as unknown as { fetchAiQuota: (u: string) => Promise<boolean> }
        ).fetchAiQuota('user-404');
      } catch (e) {
        captured = e as Error & { status?: number };
      }

      expect(captured?.status).toBe(404);
      fetchSpy.mockRestore();
    });

    it('fetch 자체 throw 시 그대로 전파 — CB가 failure로 기록 가능', async () => {
      const fetchSpy = jest
        .spyOn(global, 'fetch' as never)
        .mockRejectedValueOnce(new Error('network down') as never);

      await expect(
        (service as unknown as { fetchAiQuota: (u: string) => Promise<boolean> }).fetchAiQuota(
          'user-4',
        ),
      ).rejects.toThrow('network down');
      fetchSpy.mockRestore();
    });
  });
});
