import { RequestIdMiddleware } from './request-id.middleware';

// uuid mock
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'),
}));

describe('RequestIdMiddleware', () => {
  let middleware: RequestIdMiddleware;
  let mockLogger: Record<string, jest.Mock>;
  let mockReq: Record<string, any>;
  let mockRes: Record<string, any>;
  let finishHandler: (() => void) | null;
  const next = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    finishHandler = null;

    mockLogger = {
      setContext: jest.fn(),
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockReq = {
      headers: {},
      method: 'GET',
      url: '/api/test',
      originalUrl: '/api/test',
      ip: '192.168.1.100',
      socket: { remoteAddress: '192.168.1.100' },
    };

    mockRes = {
      setHeader: jest.fn(),
      statusCode: 200,
      on: jest.fn((event: string, handler: () => void) => {
        if (event === 'finish') finishHandler = handler;
      }),
    };

    middleware = new RequestIdMiddleware(mockLogger as any);
  });

  it('X-Request-Id가 없으면 UUID를 생성하여 할당한다', () => {
    middleware.use(mockReq as any, mockRes as any, next);

    expect(mockReq.headers['x-request-id']).toBe(
      'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    );
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'X-Request-Id',
      'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    );
  });

  it('유효한 UUID 형식의 X-Request-Id는 재사용한다', () => {
    mockReq.headers['x-request-id'] =
      '11111111-2222-3333-4444-555555555555';

    middleware.use(mockReq as any, mockRes as any, next);

    expect(mockReq.headers['x-request-id']).toBe(
      '11111111-2222-3333-4444-555555555555',
    );
  });

  it('유효하지 않은 X-Request-Id는 새 UUID로 교체한다', () => {
    mockReq.headers['x-request-id'] = 'not-a-uuid';

    middleware.use(mockReq as any, mockRes as any, next);

    expect(mockReq.headers['x-request-id']).toBe(
      'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    );
  });

  it('X-Trace-Id도 동일 규칙으로 할당한다', () => {
    middleware.use(mockReq as any, mockRes as any, next);

    expect(mockReq.headers['x-trace-id']).toBe(
      'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    );
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'X-Trace-Id',
      'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    );
  });

  it('next()를 호출한다', () => {
    middleware.use(mockReq as any, mockRes as any, next);
    expect(next).toHaveBeenCalled();
  });

  it('유효한 UUID 형식의 X-Trace-Id는 재사용한다', () => {
    mockReq.headers['x-trace-id'] = '11111111-2222-3333-4444-555555555555';

    middleware.use(mockReq as any, mockRes as any, next);

    expect(mockReq.headers['x-trace-id']).toBe('11111111-2222-3333-4444-555555555555');
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'X-Trace-Id',
      '11111111-2222-3333-4444-555555555555',
    );
  });

  it('유효하지 않은 X-Trace-Id는 새 UUID로 교체한다', () => {
    mockReq.headers['x-trace-id'] = 'invalid-trace-id';

    middleware.use(mockReq as any, mockRes as any, next);

    expect(mockReq.headers['x-trace-id']).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
  });

  describe('응답 완료 시 로그', () => {
    it('2xx 응답에 대해 logger.log를 호출한다', () => {
      mockRes.statusCode = 200;
      middleware.use(mockReq as any, mockRes as any, next);
      finishHandler!();

      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('GET'),
        expect.objectContaining({ tag: 'HTTP_REQUEST', statusCode: 200 }),
      );
    });

    it('4xx 응답에 대해 logger.warn을 호출한다', () => {
      mockRes.statusCode = 404;
      middleware.use(mockReq as any, mockRes as any, next);
      finishHandler!();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('404'),
        expect.objectContaining({ statusCode: 404 }),
      );
    });

    it('5xx 응답에 대해 logger.error를 호출한다', () => {
      mockRes.statusCode = 500;
      middleware.use(mockReq as any, mockRes as any, next);
      finishHandler!();

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('500'),
        expect.objectContaining({ statusCode: 500 }),
      );
    });

    it('originalUrl이 없으면 req.url을 path로 사용한다', () => {
      mockReq.originalUrl = undefined;
      mockReq.url = '/api/fallback';
      mockRes.statusCode = 200;
      middleware.use(mockReq as any, mockRes as any, next);
      finishHandler!();

      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('/api/fallback'),
        expect.any(Object),
      );
    });

    it('req.ip와 socket.remoteAddress 모두 없으면 unknown을 사용한다', () => {
      mockReq.ip = undefined;
      mockReq.socket = { remoteAddress: undefined };
      mockRes.statusCode = 200;
      middleware.use(mockReq as any, mockRes as any, next);
      finishHandler!();

      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ statusCode: 200 }),
      );
    });

    it('req.ip 없고 socket.remoteAddress 있으면 socket 주소를 사용한다', () => {
      mockReq.ip = undefined;
      mockReq.socket = { remoteAddress: '10.0.0.1' };
      mockRes.statusCode = 200;
      middleware.use(mockReq as any, mockRes as any, next);
      finishHandler!();

      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ statusCode: 200 }),
      );
    });
  });
});
