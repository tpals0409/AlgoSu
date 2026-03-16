import { setTokenCookie } from './cookie.util';
import { Response } from 'express';

describe('cookie.util — setTokenCookie', () => {
  const createMockRes = (): { cookie: jest.Mock } & Partial<Response> => ({
    cookie: jest.fn(),
  });

  const TOKEN = 'jwt-test-token';

  it('development 환경 — secure: false', () => {
    const res = createMockRes();
    setTokenCookie(res as unknown as Response, TOKEN, 'development');

    expect(res.cookie).toHaveBeenCalledWith('token', TOKEN, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 3_600_000, // 1시간 (ms)
    });
  });

  it('production 환경 — secure: true', () => {
    const res = createMockRes();
    setTokenCookie(res as unknown as Response, TOKEN, 'production');

    expect(res.cookie).toHaveBeenCalledWith('token', TOKEN, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 3_600_000,
    });
  });

  it('test 환경 — secure: false', () => {
    const res = createMockRes();
    setTokenCookie(res as unknown as Response, TOKEN, 'test');

    expect(res.cookie).toHaveBeenCalledWith(
      'token',
      TOKEN,
      expect.objectContaining({ secure: false }),
    );
  });
});
