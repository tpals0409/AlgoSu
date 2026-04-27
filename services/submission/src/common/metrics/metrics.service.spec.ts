import { Registry } from 'prom-client';
import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(() => {
    service = new MetricsService(new Registry());
  });

  describe('onModuleInit()', () => {
    it('defaultMetrics 수집을 시작한다', () => {
      // onModuleInit 호출해도 에러 없이 완료
      expect(() => service.onModuleInit()).not.toThrow();
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
