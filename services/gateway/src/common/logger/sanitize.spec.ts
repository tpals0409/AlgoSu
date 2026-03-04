import {
  sanitizePath,
  sanitizeUserAgent,
  maskIp,
  maskEmail,
  sanitizeHeaders,
  sanitizeAxiosError,
} from './sanitize';

describe('sanitize utilities', () => {
  // ─── sanitizePath ──────────────────────────────────
  describe('sanitizePath', () => {
    it('제어 문자를 제거한다', () => {
      expect(sanitizePath('/api/\x00test\x1f')).toBe('/api/test');
    });

    it('maxLen을 초과하면 잘린다', () => {
      expect(sanitizePath('abcdefgh', 5)).toBe('abcde');
    });

    it('정상 문자열은 그대로 반환한다', () => {
      expect(sanitizePath('/api/v1/users')).toBe('/api/v1/users');
    });
  });

  // ─── sanitizeUserAgent ──────────────────────────────────
  describe('sanitizeUserAgent', () => {
    it('제어 문자를 제거한다', () => {
      expect(sanitizeUserAgent('Mozilla\x00/5.0')).toBe('Mozilla/5.0');
    });

    it('maxLen 기본값 200으로 잘린다', () => {
      const longUa = 'A'.repeat(300);
      expect(sanitizeUserAgent(longUa)).toHaveLength(200);
    });
  });

  // ─── maskIp ──────────────────────────────────
  describe('maskIp', () => {
    it('IPv4 마지막 옥텟을 마스킹한다', () => {
      expect(maskIp('192.168.1.100')).toBe('192.168.1.**');
    });

    it('IPv6 또는 비표준은 전체 마스킹한다', () => {
      expect(maskIp('::1')).toBe('***');
    });
  });

  // ─── maskEmail ──────────────────────────────────
  describe('maskEmail', () => {
    it('이메일 로컬 부분을 마스킹한다', () => {
      expect(maskEmail('user@example.com')).toBe('us**@example.com');
    });

    it('@가 없으면 **를 반환한다', () => {
      expect(maskEmail('invalid')).toBe('**');
    });

    it('로컬 부분이 짧아도 처리한다', () => {
      expect(maskEmail('a@test.com')).toBe('a**@test.com');
    });
  });

  // ─── sanitizeHeaders ──────────────────────────────────
  describe('sanitizeHeaders', () => {
    it('민감 헤더를 [REDACTED]로 마스킹한다', () => {
      const result = sanitizeHeaders({
        Authorization: 'Bearer token',
        'Content-Type': 'application/json',
        Cookie: 'session=abc',
        'x-internal-key': 'secret',
        'x-api-key': 'key123',
      });

      expect(result['Authorization']).toBe('[REDACTED]');
      expect(result['Cookie']).toBe('[REDACTED]');
      expect(result['x-internal-key']).toBe('[REDACTED]');
      expect(result['x-api-key']).toBe('[REDACTED]');
      expect(result['Content-Type']).toBe('application/json');
    });

    it('대소문자 무관하게 마스킹한다', () => {
      const result = sanitizeHeaders({ AUTHORIZATION: 'Bearer x' });
      expect(result['AUTHORIZATION']).toBe('[REDACTED]');
    });
  });

  // ─── sanitizeAxiosError ──────────────────────────────────
  describe('sanitizeAxiosError', () => {
    it('Axios 에러를 직렬화한다', () => {
      const axiosError = {
        isAxiosError: true,
        name: 'AxiosError',
        message: 'Request failed with status code 500',
        code: 'ERR_BAD_RESPONSE',
        stack: 'stack trace...',
        config: { url: 'http://localhost:3000/api/test' },
        response: { status: 500 },
      };

      const result = sanitizeAxiosError(axiosError);
      expect(result.name).toBe('AxiosError');
      expect(result.message).toBe('Request failed with status code 500');
      expect(result.code).toBe('ERR_BAD_RESPONSE');
      expect(result.status).toBe(500);
      expect(result.url).toBe('http://localhost:3000/api/test');
    });

    it('일반 Error를 직렬화한다', () => {
      const err = new Error('generic error');
      const result = sanitizeAxiosError(err);
      expect(result.name).toBe('Error');
      expect(result.message).toBe('generic error');
    });

    it('Unknown 에러를 직렬화한다', () => {
      const result = sanitizeAxiosError('string error');
      expect(result.name).toBe('UnknownError');
      expect(result.message).toBe('string error');
    });

    it('메시지를 500자로 잘린다', () => {
      const longMsg = 'x'.repeat(1000);
      const err = new Error(longMsg);
      const result = sanitizeAxiosError(err);
      expect(result.message).toHaveLength(500);
    });

    it('Axios 에러에서 선택적 필드 처리', () => {
      const axiosError = {
        isAxiosError: true,
        message: 'timeout',
        config: {},
        response: {},
      };

      const result = sanitizeAxiosError(axiosError);
      expect(result.name).toBe('AxiosError');
      expect(result.code).toBeUndefined();
      expect(result.status).toBeUndefined();
      expect(result.url).toBeUndefined();
    });
  });
});
