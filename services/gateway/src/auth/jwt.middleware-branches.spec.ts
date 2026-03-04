/**
 * jwt.middleware.ts 미커버 브랜치 테스트
 * - line 62: typeof decoded === 'string'
 * - lines 76-80: UnauthorizedException rethrow + 예상치 못한 에러
 *
 * jsonwebtoken 모듈을 mock하여 verify 동작을 제어한다.
 */
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';

// jest.mock으로 jsonwebtoken 전체를 mock
const mockVerify = jest.fn();
const mockSign = jest.fn();
jest.mock('jsonwebtoken', () => ({
  ...jest.requireActual('jsonwebtoken'),
  verify: (...args: unknown[]) => mockVerify(...args),
  sign: (...args: unknown[]) => mockSign(...args),
  TokenExpiredError: jest.requireActual('jsonwebtoken').TokenExpiredError,
  JsonWebTokenError: jest.requireActual('jsonwebtoken').JsonWebTokenError,
}));

import { JwtMiddleware } from './jwt.middleware';

describe('JwtMiddleware — 브랜치 커버리지', () => {
  let middleware: JwtMiddleware;
  let userRepository: Record<string, jest.Mock>;

  const JWT_SECRET = 'test-secret';
  const USER_ID = 'user-uuid-1234-5678-abcd-ef0123456789';

  const createMockRequest = (overrides: Partial<Request> = {}): Request => ({
    cookies: {},
    headers: {},
    ...overrides,
  } as unknown as Request);

  const mockRes = {} as Response;
  const mockNext: NextFunction = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    userRepository = {
      findOne: jest.fn().mockResolvedValue({ id: USER_ID, deleted_at: null }),
    };

    const mockLogger = {
      setContext: jest.fn(),
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    const configService = {
      getOrThrow: jest.fn().mockReturnValue(JWT_SECRET),
    };

    middleware = new JwtMiddleware(
      configService as unknown as ConfigService,
      userRepository as any,
      mockLogger as any,
    );
  });

  it('jwt.verify가 문자열을 반환하면 UnauthorizedException (line 62)', async () => {
    mockVerify.mockReturnValue('string-payload');
    const req = createMockRequest({ cookies: { token: 'some-token' } });

    await expect(middleware.use(req, mockRes, mockNext)).rejects.toThrow(
      'JWT 페이로드가 올바르지 않습니다.',
    );
  });

  it('jwt.verify에서 UnauthorizedException throw → 그대로 rethrow (lines 76-77)', async () => {
    mockVerify.mockImplementation(() => {
      throw new UnauthorizedException('JWT 페이로드가 올바르지 않습니다.');
    });
    const req = createMockRequest({ cookies: { token: 'some-token' } });

    await expect(middleware.use(req, mockRes, mockNext)).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(middleware.use(req, mockRes, mockNext)).rejects.toThrow(
      'JWT 페이로드가 올바르지 않습니다.',
    );
  });

  it('jwt.verify에서 예상치 못한 에러 throw (lines 79-80)', async () => {
    mockVerify.mockImplementation(() => {
      throw new TypeError('unexpected internal error');
    });
    const req = createMockRequest({ cookies: { token: 'some-token' } });

    await expect(middleware.use(req, mockRes, mockNext)).rejects.toThrow(
      '인증 처리 중 오류가 발생했습니다.',
    );
  });
});
