/**
 * @file SecurityHeadersMiddleware 단위 테스트
 * @domain common
 * @layer middleware
 */
import { SecurityHeadersMiddleware } from './security-headers.middleware';
import { Request, Response, NextFunction } from 'express';

describe('SecurityHeadersMiddleware', () => {
  let middleware: SecurityHeadersMiddleware;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  const headers: Record<string, string> = {};

  beforeEach(() => {
    middleware = new SecurityHeadersMiddleware();
    mockReq = {};
    headers.length = undefined as unknown as string;
    mockRes = {
      setHeader: jest.fn((key: string, value: string) => {
        headers[key] = value;
        return mockRes as Response;
      }),
    };
    mockNext = jest.fn();
  });

  it('should set X-Content-Type-Options to nosniff', () => {
    middleware.use(mockReq as Request, mockRes as Response, mockNext);
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'X-Content-Type-Options',
      'nosniff',
    );
  });

  it('should set X-Frame-Options to DENY', () => {
    middleware.use(mockReq as Request, mockRes as Response, mockNext);
    expect(mockRes.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
  });

  it('should set X-XSS-Protection to 0', () => {
    middleware.use(mockReq as Request, mockRes as Response, mockNext);
    expect(mockRes.setHeader).toHaveBeenCalledWith('X-XSS-Protection', '0');
  });

  it('should set Referrer-Policy to strict-origin-when-cross-origin', () => {
    middleware.use(mockReq as Request, mockRes as Response, mockNext);
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'Referrer-Policy',
      'strict-origin-when-cross-origin',
    );
  });

  it('should set Permissions-Policy to deny camera, microphone, geolocation', () => {
    middleware.use(mockReq as Request, mockRes as Response, mockNext);
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=()',
    );
  });

  it('should call next()', () => {
    middleware.use(mockReq as Request, mockRes as Response, mockNext);
    expect(mockNext).toHaveBeenCalledTimes(1);
  });

  it('should set exactly 5 security headers', () => {
    middleware.use(mockReq as Request, mockRes as Response, mockNext);
    expect(mockRes.setHeader).toHaveBeenCalledTimes(5);
  });
});
