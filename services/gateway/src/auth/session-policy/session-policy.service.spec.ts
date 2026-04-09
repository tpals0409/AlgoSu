import { ConfigService } from '@nestjs/config';
import { SessionPolicyService } from './session-policy.service';

describe('SessionPolicyService', () => {
  const buildConfig = (overrides: Record<string, string | undefined>): ConfigService => {
    return {
      get: jest.fn((key: string, defaultValue?: unknown) => {
        if (key in overrides) {
          const v = overrides[key];
          return v === undefined ? defaultValue : v;
        }
        return defaultValue;
      }),
    } as unknown as ConfigService;
  };

  describe('기본값 적용', () => {
    it('env 미설정 시 기본값(2h/1h/10m/5m) 적용', () => {
      const service = new SessionPolicyService(buildConfig({}));

      expect(service.getAccessTokenTtl()).toBe('2h');
      expect(service.getAccessTokenTtlMs()).toBe(2 * 60 * 60 * 1000);
      expect(service.getDemoTokenTtl()).toBe('2h'); // fallback to access
      expect(service.getDemoTokenTtlMs()).toBe(2 * 60 * 60 * 1000);
      expect(service.getRefreshThresholdMs()).toBe(60 * 60 * 1000); // 1h
      expect(service.getHeartbeatIntervalMs()).toBe(10 * 60 * 1000); // 10m
      expect(service.getSessionTimeoutBufferMs()).toBe(5 * 60 * 1000); // 5m
    });
  });

  describe('env 파싱 정상 케이스', () => {
    it('2h → 7200000ms, 30m → 1800000ms, 45s → 45000ms', () => {
      const service = new SessionPolicyService(
        buildConfig({
          JWT_EXPIRES_IN: '2h',
          JWT_DEMO_EXPIRES_IN: '30m',
          SESSION_REFRESH_THRESHOLD: '45s',
          SESSION_HEARTBEAT_INTERVAL: '15m',
          SESSION_TIMEOUT_BUFFER: '10m',
        }),
      );

      expect(service.getAccessTokenTtlMs()).toBe(7_200_000);
      expect(service.getDemoTokenTtlMs()).toBe(1_800_000);
      expect(service.getRefreshThresholdMs()).toBe(45_000);
      expect(service.getHeartbeatIntervalMs()).toBe(900_000);
      expect(service.getSessionTimeoutBufferMs()).toBe(600_000);
    });

    it('ms 단위, 소수점 허용', () => {
      const service = new SessionPolicyService(
        buildConfig({
          JWT_EXPIRES_IN: '1.5h',
          SESSION_REFRESH_THRESHOLD: '500ms',
        }),
      );
      expect(service.getAccessTokenTtlMs()).toBe(90 * 60 * 1000);
      expect(service.getRefreshThresholdMs()).toBe(500);
    });
  });

  describe('잘못된 포맷 방어', () => {
    it('JWT_EXPIRES_IN 잘못된 포맷 — 기본값 fallback (2h)', () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      const service = new SessionPolicyService(
        buildConfig({ JWT_EXPIRES_IN: 'garbage' }),
      );
      expect(service.getAccessTokenTtl()).toBe('2h');
      expect(service.getAccessTokenTtlMs()).toBe(2 * 60 * 60 * 1000);
      warn.mockRestore();
    });

    it('SESSION_REFRESH_THRESHOLD 잘못된 포맷 — 기본값 fallback (1h)', () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      const service = new SessionPolicyService(
        buildConfig({ SESSION_REFRESH_THRESHOLD: 'bogus' }),
      );
      expect(service.getRefreshThresholdMs()).toBe(60 * 60 * 1000);
      warn.mockRestore();
    });

    it('JWT_DEMO_EXPIRES_IN 잘못된 포맷 — access TTL fallback', () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      const service = new SessionPolicyService(
        buildConfig({
          JWT_EXPIRES_IN: '3h',
          JWT_DEMO_EXPIRES_IN: 'xx',
        }),
      );
      expect(service.getDemoTokenTtl()).toBe('3h');
      expect(service.getDemoTokenTtlMs()).toBe(3 * 60 * 60 * 1000);
      warn.mockRestore();
    });
  });

  describe('demo fallback', () => {
    it('JWT_DEMO_EXPIRES_IN 미설정 시 JWT_EXPIRES_IN 값 그대로 사용', () => {
      const service = new SessionPolicyService(
        buildConfig({ JWT_EXPIRES_IN: '4h' }),
      );
      expect(service.getDemoTokenTtl()).toBe('4h');
      expect(service.getDemoTokenTtlMs()).toBe(4 * 60 * 60 * 1000);
    });
  });

  describe('getClientPolicy 구조', () => {
    it('4개 필드 고정 + sessionTimeout = ttl + buffer', () => {
      const service = new SessionPolicyService(
        buildConfig({
          JWT_EXPIRES_IN: '2h',
          SESSION_HEARTBEAT_INTERVAL: '10m',
          SESSION_TIMEOUT_BUFFER: '5m',
          SESSION_REFRESH_THRESHOLD: '1h',
        }),
      );

      const policy = service.getClientPolicy();
      expect(Object.keys(policy).sort()).toEqual(
        ['accessTokenTtlMs', 'heartbeatIntervalMs', 'refreshThresholdMs', 'sessionTimeoutMs'].sort(),
      );
      expect(policy.accessTokenTtlMs).toBe(7_200_000);
      expect(policy.heartbeatIntervalMs).toBe(600_000);
      expect(policy.refreshThresholdMs).toBe(3_600_000);
      expect(policy.sessionTimeoutMs).toBe(7_200_000 + 300_000);
    });
  });
});
