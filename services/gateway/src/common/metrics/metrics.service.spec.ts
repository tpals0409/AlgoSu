import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(() => {
    service = new MetricsService();
  });

  describe('normalizePath', () => {
    it('UUID 세그먼트를 :id로 치환한다', () => {
      const path = '/api/submissions/550e8400-e29b-41d4-a716-446655440000';
      expect(service.normalizePath(path)).toBe('/api/submissions/:id');
    });

    it('숫자 세그먼트를 :id로 치환한다', () => {
      expect(service.normalizePath('/api/problems/123')).toBe(
        '/api/problems/:id',
      );
    });

    it('쿼리스트링을 제거한다', () => {
      expect(service.normalizePath('/api/test?page=1&limit=10')).toBe(
        '/api/test',
      );
    });

    it('UUID와 숫자가 혼합된 경로를 모두 정규화한다', () => {
      const path =
        '/api/studies/550e8400-e29b-41d4-a716-446655440000/problems/42';
      expect(service.normalizePath(path)).toBe('/api/studies/:id/problems/:id');
    });
  });

  describe('shouldRecord', () => {
    it('/metrics 경로는 기록하지 않는다', () => {
      expect(service.shouldRecord('/metrics')).toBe(false);
    });

    it('/health 경로는 기록하지 않는다', () => {
      expect(service.shouldRecord('/health')).toBe(false);
    });

    it('쿼리스트링이 붙은 /metrics도 기록하지 않는다', () => {
      expect(service.shouldRecord('/metrics?format=json')).toBe(false);
    });

    it('일반 API 경로는 기록한다', () => {
      expect(service.shouldRecord('/api/submissions')).toBe(true);
    });
  });

  describe('getMetrics / getContentType', () => {
    it('getMetrics — 문자열을 반환한다', async () => {
      const result = await service.getMetrics();
      expect(typeof result).toBe('string');
    });

    it('getContentType — Prometheus content type을 반환한다', () => {
      const ct = service.getContentType();
      expect(ct).toContain('text/');
    });
  });

  describe('메트릭 인스턴스', () => {
    it('httpRequestDuration 히스토그램이 존재한다', () => {
      expect(service.httpRequestDuration).toBeDefined();
    });

    it('httpRequestsTotal 카운터가 존재한다', () => {
      expect(service.httpRequestsTotal).toBeDefined();
    });

    it('httpActiveRequests 게이지가 존재한다', () => {
      expect(service.httpActiveRequests).toBeDefined();
    });

    it('httpErrorsTotal 카운터가 존재한다', () => {
      expect(service.httpErrorsTotal).toBeDefined();
    });
  });

  describe('onModuleInit', () => {
    it('collectDefaultMetrics를 호출해도 에러가 발생하지 않는다', () => {
      expect(() => service.onModuleInit()).not.toThrow();
    });

    it('onModuleInit 후 기본 메트릭이 추가된다', async () => {
      service.onModuleInit();
      const metrics = await service.getMetrics();
      expect(metrics.length).toBeGreaterThan(0);
    });
  });
});
