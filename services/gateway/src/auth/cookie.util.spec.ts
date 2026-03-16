import { setTokenCookie, parseTimeToSeconds } from './cookie.util';
import { Response } from 'express';

describe('cookie.util — parseTimeToSeconds', () => {
  it('숫자 입력 — 그대로 반환', () => {
    expect(parseTimeToSeconds(3600)).toBe(3600);
  });

  it('초 단위 문자열 — "3600s"', () => {
    expect(parseTimeToSeconds('3600s')).toBe(3600);
  });

  it('분 단위 문자열 — "30m"', () => {
    expect(parseTimeToSeconds('30m')).toBe(1800);
  });

  it('시간 단위 문자열 — "1h"', () => {
    expect(parseTimeToSeconds('1h')).toBe(3600);
  });

  it('일 단위 문자열 — "7d"', () => {
    expect(parseTimeToSeconds('7d')).toBe(604800);
  });

  it('단위 없는 숫자 문자열 — "3600" (초 취급)', () => {
    expect(parseTimeToSeconds('3600')).toBe(3600);
  });

  it('잘못된 형식 — 예외 발생', () => {
    expect(() => parseTimeToSeconds('abc')).toThrow('지원하지 않는 시간 형식');
  });
});

describe('cookie.util — setTokenCookie', () => {
  const createMockRes = (): { cookie: jest.Mock } & Partial<Response> => ({
    cookie: jest.fn(),
  });

  const TOKEN = 'jwt-test-token';

  it('development 환경 — secure: false, 기본 1h', () => {
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

  it('jwtExpiresIn 전달 시 maxAge 파생 — "30m"', () => {
    const res = createMockRes();
    setTokenCookie(res as unknown as Response, TOKEN, 'development', '30m');

    expect(res.cookie).toHaveBeenCalledWith('token', TOKEN, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 1_800_000, // 30분 (ms)
    });
  });

  it('jwtExpiresIn "2h" — maxAge 7200000ms', () => {
    const res = createMockRes();
    setTokenCookie(res as unknown as Response, TOKEN, 'development', '2h');

    expect(res.cookie).toHaveBeenCalledWith('token', TOKEN, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 7_200_000,
    });
  });
});
