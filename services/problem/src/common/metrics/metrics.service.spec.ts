import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(() => {
    service = new MetricsService();
  });

  // ──────────────────────────────────────────────
  // onModuleInit
  // ──────────────────────────────────────────────
  it('onModuleInit: collectDefaultMetrics 호출 시 에러 없음', () => {
    expect(() => service.onModuleInit()).not.toThrow();
  });

  // ──────────────────────────────────────────────
  // normalizePath
  // ──────────────────────────────────────────────
  describe('normalizePath()', () => {
    it('UUID 세그먼트를 :id로 치환', () => {
      const result = service.normalizePath('/problems/550e8400-e29b-41d4-a716-446655440000');
      expect(result).toBe('/problems/:id');
    });

    it('숫자 세그먼트를 :id로 치환', () => {
      const result = service.normalizePath('/problems/123');
      expect(result).toBe('/problems/:id');
    });

    it('쿼리 스트링 제거', () => {
      const result = service.normalizePath('/problems?page=1&size=10');
      expect(result).toBe('/problems');
    });

    it('복합 경로 정규화', () => {
      const result = service.normalizePath('/studies/550e8400-e29b-41d4-a716-446655440000/problems/42?sort=asc');
      expect(result).toBe('/studies/:id/problems/:id');
    });
  });

  // ──────────────────────────────────────────────
  // shouldRecord
  // ──────────────────────────────────────────────
  describe('shouldRecord()', () => {
    it('/metrics 경로: false 반환', () => {
      expect(service.shouldRecord('/metrics')).toBe(false);
    });

    it('/health 경로: false 반환', () => {
      expect(service.shouldRecord('/health')).toBe(false);
    });

    it('일반 경로: true 반환', () => {
      expect(service.shouldRecord('/problems')).toBe(true);
    });

    it('쿼리 스트링이 있는 제외 경로: false 반환', () => {
      expect(service.shouldRecord('/metrics?format=json')).toBe(false);
    });
  });

  // ──────────────────────────────────────────────
  // getMetrics / getContentType
  // ──────────────────────────────────────────────
  it('getMetrics: 문자열 반환', async () => {
    service.onModuleInit();
    const metrics = await service.getMetrics();
    expect(typeof metrics).toBe('string');
  });

  it('getContentType: content-type 문자열 반환', () => {
    const contentType = service.getContentType();
    expect(contentType).toBeDefined();
    expect(typeof contentType).toBe('string');
  });

  // ──────────────────────────────────────────────
  // 메트릭 인스턴스 확인
  // ──────────────────────────────────────────────
  it('httpRequestDuration 히스토그램 존재', () => {
    expect(service.httpRequestDuration).toBeDefined();
  });

  it('httpRequestsTotal 카운터 존재', () => {
    expect(service.httpRequestsTotal).toBeDefined();
  });

  it('httpActiveRequests 게이지 존재', () => {
    expect(service.httpActiveRequests).toBeDefined();
  });

  it('httpErrorsTotal 카운터 존재', () => {
    expect(service.httpErrorsTotal).toBeDefined();
  });
});
