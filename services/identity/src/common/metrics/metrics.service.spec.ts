import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(() => {
    service = new MetricsService();
  });

  // ─── normalizePath ──────────────────────────────────
  describe('normalizePath()', () => {
    it('UUID 세그먼트를 :id로 치환한다', () => {
      const path = '/users/550e8400-e29b-41d4-a716-446655440000/profile';
      expect(service.normalizePath(path)).toBe('/users/:id/profile');
    });

    it('숫자 세그먼트를 :id로 치환한다', () => {
      const path = '/problems/123/submit';
      expect(service.normalizePath(path)).toBe('/problems/:id/submit');
    });

    it('쿼리스트링을 제거한다', () => {
      const path = '/users?page=1&limit=10';
      expect(service.normalizePath(path)).toBe('/users');
    });

    it('복합 경로를 올바르게 정규화한다', () => {
      const path = '/studies/550e8400-e29b-41d4-a716-446655440000/members/42?foo=bar';
      expect(service.normalizePath(path)).toBe('/studies/:id/members/:id');
    });
  });

  // ─── shouldRecord ──────────────────────────────────
  describe('shouldRecord()', () => {
    it('/metrics 경로는 기록하지 않는다', () => {
      expect(service.shouldRecord('/metrics')).toBe(false);
    });

    it('/health 경로는 기록하지 않는다', () => {
      expect(service.shouldRecord('/health')).toBe(false);
    });

    it('/metrics?foo=bar 쿼리스트링이 있어도 기록하지 않는다', () => {
      expect(service.shouldRecord('/metrics?foo=bar')).toBe(false);
    });

    it('일반 경로는 기록한다', () => {
      expect(service.shouldRecord('/api/users')).toBe(true);
    });
  });

  // ─── getMetrics / getContentType ──────────────────────────────────
  describe('getMetrics()', () => {
    it('Prometheus 형식 문자열을 반환한다', async () => {
      service.onModuleInit();
      const metrics = await service.getMetrics();
      expect(typeof metrics).toBe('string');
      expect(metrics.length).toBeGreaterThan(0);
    });
  });

  describe('getContentType()', () => {
    it('prom-client content type을 반환한다', () => {
      const contentType = service.getContentType();
      expect(contentType).toBeDefined();
      expect(typeof contentType).toBe('string');
    });
  });

  // ─── onModuleInit ──────────────────────────────────
  describe('onModuleInit()', () => {
    it('에러 없이 default metrics를 수집한다', () => {
      expect(() => service.onModuleInit()).not.toThrow();
    });
  });

  // ─── 메트릭 인스턴스 존재 ──────────────────────────────────
  describe('메트릭 인스턴스', () => {
    it('httpRequestDuration이 존재한다', () => {
      expect(service.httpRequestDuration).toBeDefined();
    });

    it('httpRequestsTotal이 존재한다', () => {
      expect(service.httpRequestsTotal).toBeDefined();
    });

    it('httpActiveRequests가 존재한다', () => {
      expect(service.httpActiveRequests).toBeDefined();
    });

    it('httpErrorsTotal이 존재한다', () => {
      expect(service.httpErrorsTotal).toBeDefined();
    });
  });
});
