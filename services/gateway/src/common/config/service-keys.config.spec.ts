import {
  SERVICE_ROUTING_TABLE,
  INTERNAL_SERVICE_ROUTES,
  ServiceKeyConfig,
} from './service-keys.config';

describe('service-keys.config', () => {
  describe('SERVICE_ROUTING_TABLE', () => {
    it('배열 형태로 정의되어 있다', () => {
      expect(Array.isArray(SERVICE_ROUTING_TABLE)).toBe(true);
      expect(SERVICE_ROUTING_TABLE.length).toBeGreaterThan(0);
    });

    it('각 항목에 prefix, urlEnvKey, keyEnvKey, description이 있다', () => {
      for (const entry of SERVICE_ROUTING_TABLE) {
        expect(entry.prefix).toBeDefined();
        expect(entry.urlEnvKey).toBeDefined();
        expect(entry.keyEnvKey).toBeDefined();
        expect(entry.description).toBeDefined();
      }
    });

    it('prefix는 /api/로 시작한다', () => {
      for (const entry of SERVICE_ROUTING_TABLE) {
        expect(entry.prefix).toMatch(/^\/api\//);
      }
    });

    it('problem, submission, analysis 서비스가 등록되어 있다', () => {
      const prefixes = SERVICE_ROUTING_TABLE.map((e) => e.prefix);
      expect(prefixes).toContain('/api/problems');
      expect(prefixes).toContain('/api/submissions');
      expect(prefixes).toContain('/api/analysis');
    });

    it('서비스별 키 환경변수는 모두 INTERNAL_KEY_로 시작한다', () => {
      for (const entry of SERVICE_ROUTING_TABLE) {
        expect(entry.keyEnvKey).toMatch(/^INTERNAL_KEY_/);
      }
    });

    it('서비스별 URL 환경변수는 _SERVICE_URL로 끝난다', () => {
      for (const entry of SERVICE_ROUTING_TABLE) {
        expect(entry.urlEnvKey).toMatch(/_SERVICE_URL$/);
      }
    });
  });

  describe('INTERNAL_SERVICE_ROUTES', () => {
    it('SUBMISSION_TO_PROBLEM 경로가 정의되어 있다', () => {
      const route = INTERNAL_SERVICE_ROUTES.SUBMISSION_TO_PROBLEM;
      expect(route).toBeDefined();
      expect(route.urlEnvKey).toBe('PROBLEM_SERVICE_URL');
      expect(route.keyEnvKey).toBe('INTERNAL_KEY_SUBMISSION');
    });
  });

  describe('ServiceKeyConfig 타입 호환성', () => {
    it('SERVICE_ROUTING_TABLE 항목은 ServiceKeyConfig 타입과 호환된다', () => {
      const entry: ServiceKeyConfig = SERVICE_ROUTING_TABLE[0];
      expect(typeof entry.prefix).toBe('string');
      expect(typeof entry.urlEnvKey).toBe('string');
      expect(typeof entry.keyEnvKey).toBe('string');
      expect(typeof entry.description).toBe('string');
    });
  });
});
