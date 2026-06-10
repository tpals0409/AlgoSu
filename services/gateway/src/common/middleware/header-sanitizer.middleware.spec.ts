/**
 * @file header-sanitizer.middleware.spec.ts — 인바운드 신원 헤더 제거 검증
 * @domain common
 * @layer test
 * @related header-sanitizer.middleware.ts
 */

import { NextFunction, Request, Response } from 'express';
import { HeaderSanitizerMiddleware } from './header-sanitizer.middleware';

describe('HeaderSanitizerMiddleware', () => {
  const middleware = new HeaderSanitizerMiddleware();
  const mockRes = {} as Response;

  function createReq(headers: Record<string, string>): Request {
    return { headers: { ...headers } } as unknown as Request;
  }

  it('x-user-id 헤더가 존재하면 제거한다 (신원 위조 차단)', () => {
    const req = createReq({ 'x-user-id': 'attacker-user-id', 'content-type': 'application/json' });
    const next: NextFunction = jest.fn();

    middleware.use(req, mockRes, next);

    expect(req.headers['x-user-id']).toBeUndefined();
    expect(req.headers['content-type']).toBe('application/json');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('x-demo-user 헤더가 존재하면 제거한다', () => {
    const req = createReq({ 'x-demo-user': 'true' });
    const next: NextFunction = jest.fn();

    middleware.use(req, mockRes, next);

    expect(req.headers['x-demo-user']).toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('두 헤더가 모두 없으면 그대로 통과시킨다 (next 호출)', () => {
    const req = createReq({ authorization: 'Bearer token' });
    const next: NextFunction = jest.fn();

    middleware.use(req, mockRes, next);

    expect(req.headers['authorization']).toBe('Bearer token');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('두 헤더가 모두 존재하면 둘 다 제거한다', () => {
    const req = createReq({
      'x-user-id': 'attacker',
      'x-demo-user': 'true',
      'x-other': 'keep-me',
    });
    const next: NextFunction = jest.fn();

    middleware.use(req, mockRes, next);

    expect(req.headers['x-user-id']).toBeUndefined();
    expect(req.headers['x-demo-user']).toBeUndefined();
    expect(req.headers['x-other']).toBe('keep-me');
    expect(next).toHaveBeenCalledTimes(1);
  });
});
