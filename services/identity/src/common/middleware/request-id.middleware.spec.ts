import { RequestIdMiddleware } from './request-id.middleware';
import { Request, Response, NextFunction } from 'express';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function createMockReqRes(headers: Record<string, string> = {}): {
  req: Partial<Request>;
  res: Partial<Response>;
  next: NextFunction;
} {
  const req: Partial<Request> = { headers: { ...headers } };
  const resHeaders: Record<string, string> = {};
  const res: Partial<Response> = {
    setHeader: jest.fn((key: string, value: string) => {
      resHeaders[key] = value;
      return res as Response;
    }),
  };
  const next = jest.fn();
  return { req, res, next };
}

describe('RequestIdMiddleware', () => {
  let middleware: RequestIdMiddleware;

  beforeEach(() => {
    middleware = new RequestIdMiddleware();
  });

  it('헤더가 없으면 UUID를 새로 생성한다', () => {
    const { req, res, next } = createMockReqRes();

    middleware.use(req as Request, res as Response, next);

    expect(UUID_REGEX.test(req.headers!['x-request-id'] as string)).toBe(true);
    expect(UUID_REGEX.test(req.headers!['x-trace-id'] as string)).toBe(true);
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', expect.stringMatching(UUID_REGEX));
    expect(res.setHeader).toHaveBeenCalledWith('X-Trace-Id', expect.stringMatching(UUID_REGEX));
    expect(next).toHaveBeenCalled();
  });

  it('유효한 UUID 헤더가 있으면 그대로 사용한다', () => {
    const existingRequestId = '550e8400-e29b-41d4-a716-446655440000';
    const existingTraceId = '660e8400-e29b-41d4-a716-446655440000';
    const { req, res, next } = createMockReqRes({
      'x-request-id': existingRequestId,
      'x-trace-id': existingTraceId,
    });

    middleware.use(req as Request, res as Response, next);

    expect(req.headers!['x-request-id']).toBe(existingRequestId);
    expect(req.headers!['x-trace-id']).toBe(existingTraceId);
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', existingRequestId);
    expect(res.setHeader).toHaveBeenCalledWith('X-Trace-Id', existingTraceId);
    expect(next).toHaveBeenCalled();
  });

  it('유효하지 않은 UUID 헤더이면 새로 생성한다', () => {
    const { req, res, next } = createMockReqRes({
      'x-request-id': 'not-a-uuid',
      'x-trace-id': 'also-not-a-uuid',
    });

    middleware.use(req as Request, res as Response, next);

    expect(req.headers!['x-request-id']).not.toBe('not-a-uuid');
    expect(UUID_REGEX.test(req.headers!['x-request-id'] as string)).toBe(true);
    expect(req.headers!['x-trace-id']).not.toBe('also-not-a-uuid');
    expect(UUID_REGEX.test(req.headers!['x-trace-id'] as string)).toBe(true);
    expect(next).toHaveBeenCalled();
  });
});
