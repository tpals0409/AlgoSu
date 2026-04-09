import { setTokenCookie } from './cookie.util';
import { Response } from 'express';
import * as jwt from 'jsonwebtoken';

describe('cookie.util — setTokenCookie', () => {
  const createMockRes = (): { cookie: jest.Mock } & Partial<Response> => ({
    cookie: jest.fn(),
  });

  const SECRET = 'test-secret';
  const USER_ID = 'user-uuid-1234';

  /** exp claim을 포함한 실제 JWT 생성 */
  const createJwtWithExp = (expiresInSec: number): string =>
    jwt.sign(
      { sub: USER_ID, exp: Math.floor(Date.now() / 1000) + expiresInSec },
      SECRET,
      { algorithm: 'HS256' },
    );

  describe('SSoT — maxAge는 JWT exp claim 기반 동적 계산', () => {
    it('2시간 만료 토큰 — maxAge ≈ 2h (ms)', () => {
      const res = createMockRes();
      const token = createJwtWithExp(2 * 60 * 60); // 2시간
      setTokenCookie(res as unknown as Response, token, 'development');

      expect(res.cookie).toHaveBeenCalledTimes(1);
      const [name, value, opts] = (res.cookie as jest.Mock).mock.calls[0];
      expect(name).toBe('token');
      expect(value).toBe(token);
      expect(opts.httpOnly).toBe(true);
      expect(opts.secure).toBe(false);
      expect(opts.sameSite).toBe('lax');
      expect(opts.path).toBe('/');
      // exp 기반 계산은 Date.now() 오차가 있으므로 근사치 비교 (±2초)
      const expectedMs = 2 * 60 * 60 * 1000;
      expect(opts.maxAge).toBeGreaterThan(expectedMs - 2000);
      expect(opts.maxAge).toBeLessThanOrEqual(expectedMs);
    });

    it('4시간 만료 토큰 — maxAge ≈ 4h (env 변경 시 자동 반영)', () => {
      const res = createMockRes();
      const token = createJwtWithExp(4 * 60 * 60);
      setTokenCookie(res as unknown as Response, token, 'production');

      const [, , opts] = (res.cookie as jest.Mock).mock.calls[0];
      const expectedMs = 4 * 60 * 60 * 1000;
      expect(opts.maxAge).toBeGreaterThan(expectedMs - 2000);
      expect(opts.maxAge).toBeLessThanOrEqual(expectedMs);
    });

    it('production 환경 — secure: true', () => {
      const res = createMockRes();
      const token = createJwtWithExp(60 * 60);
      setTokenCookie(res as unknown as Response, token, 'production');

      const [, , opts] = (res.cookie as jest.Mock).mock.calls[0];
      expect(opts.secure).toBe(true);
    });

    it('development 환경 — secure: false', () => {
      const res = createMockRes();
      const token = createJwtWithExp(60 * 60);
      setTokenCookie(res as unknown as Response, token, 'development');

      const [, , opts] = (res.cookie as jest.Mock).mock.calls[0];
      expect(opts.secure).toBe(false);
    });

    it('test 환경 — secure: false', () => {
      const res = createMockRes();
      const token = createJwtWithExp(60 * 60);
      setTokenCookie(res as unknown as Response, token, 'test');

      const [, , opts] = (res.cookie as jest.Mock).mock.calls[0];
      expect(opts.secure).toBe(false);
    });
  });

  describe('Fallback — 토큰 파싱 실패 시 1시간 방어값', () => {
    it('디코딩 불가능한 토큰 — fallback maxAge 1h', () => {
      const res = createMockRes();
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      setTokenCookie(res as unknown as Response, 'not-a-jwt', 'development');

      const [, , opts] = (res.cookie as jest.Mock).mock.calls[0];
      expect(opts.maxAge).toBe(60 * 60 * 1000); // 1h
      expect(warnSpy).toHaveBeenCalled();

      warnSpy.mockRestore();
    });

    it('exp 없는 JWT — fallback maxAge 1h', () => {
      const res = createMockRes();
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const tokenNoExp = jwt.sign({ sub: USER_ID }, SECRET, {
        algorithm: 'HS256',
        noTimestamp: true,
      });
      setTokenCookie(res as unknown as Response, tokenNoExp, 'production');

      const [, , opts] = (res.cookie as jest.Mock).mock.calls[0];
      expect(opts.maxAge).toBe(60 * 60 * 1000);
      expect(warnSpy).toHaveBeenCalled();

      warnSpy.mockRestore();
    });

    it('이미 만료된 토큰 — fallback maxAge 1h', () => {
      const res = createMockRes();
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const expired = createJwtWithExp(-60); // 1분 전 만료
      setTokenCookie(res as unknown as Response, expired, 'development');

      const [, , opts] = (res.cookie as jest.Mock).mock.calls[0];
      expect(opts.maxAge).toBe(60 * 60 * 1000);
      expect(warnSpy).toHaveBeenCalled();

      warnSpy.mockRestore();
    });
  });
});
