import { Registry } from 'prom-client';
import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(() => {
    service = new MetricsService(new Registry());
  });

  describe('onModuleInit()', () => {
    it('defaultMetrics 수집을 시작한다', () => {
      expect(() => service.onModuleInit()).not.toThrow();
    });

    it('중복 호출 시 already registered 에러 발생 — @Global 싱글턴 방어 근거', () => {
      service.onModuleInit();
      expect(() => service.onModuleInit()).toThrow(/already been registered/i);
    });

    it('호출 후 registry에 nodejs_* default 메트릭이 등록된다', async () => {
      service.onModuleInit();
      const output = await service.getMetrics();
      expect(output).toContain('nodejs_');
    });
  });

  describe('duplicate registration defense (Sprint 135 Wave C P1)', () => {
    it('동일 registry로 두 번째 MetricsService 생성 시 already registered 에러가 발생한다', () => {
      const sharedRegistry = new Registry();
      new MetricsService(sharedRegistry);
      expect(() => new MetricsService(sharedRegistry)).toThrow(/already been registered/i);
    });
  });

  describe('normalizePath()', () => {
    it('UUID 세그먼트를 :id로 치환한다', () => {
      const result = service.normalizePath('/submissions/550e8400-e29b-41d4-a716-446655440000');
      expect(result).toBe('/submissions/:id');
    });

    it('숫자 세그먼트를 :id로 치환한다', () => {
      const result = service.normalizePath('/problems/123');
      expect(result).toBe('/problems/:id');
    });

    it('쿼리 파라미터를 제거한다', () => {
      const result = service.normalizePath('/problems?page=1&size=10');
      expect(result).toBe('/problems');
    });
  });

  describe('shouldRecord()', () => {
    it('/metrics 경로는 기록하지 않는다', () => {
      expect(service.shouldRecord('/metrics')).toBe(false);
    });

    it('/health 경로는 기록하지 않는다', () => {
      expect(service.shouldRecord('/health')).toBe(false);
    });

    it('일반 경로는 기록한다', () => {
      expect(service.shouldRecord('/submissions')).toBe(true);
    });

    it('쿼리 파라미터가 있는 제외 경로도 기록하지 않는다', () => {
      expect(service.shouldRecord('/metrics?foo=bar')).toBe(false);
    });
  });

  describe('getMetrics()', () => {
    it('메트릭 문자열을 반환한다', async () => {
      const metrics = await service.getMetrics();
      expect(typeof metrics).toBe('string');
    });
  });

  describe('getContentType()', () => {
    it('Prometheus content type을 반환한다', () => {
      const contentType = service.getContentType();
      expect(contentType).toContain('text/plain');
    });
  });
});
