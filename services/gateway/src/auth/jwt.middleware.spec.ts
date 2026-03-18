import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtMiddleware } from './jwt.middleware';
import { IdentityClientService } from '../identity-client/identity-client.service';
import * as jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

describe('JwtMiddleware', () => {
  let middleware: JwtMiddleware;
  let configService: Record<string, jest.Mock>;
  let identityClient: Record<string, jest.Mock>;

  const JWT_SECRET = 'test-jwt-secret-key';
  const USER_ID = 'user-uuid-1234-5678-abcd-ef0123456789';

  const createValidToken = (payload: Record<string, unknown> = {}): string => {
    return jwt.sign(
      { sub: USER_ID, ...payload },
      JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '1h' },
    );
  };

  const createMockRequest = (overrides: Partial<Request> = {}): Request => {
    return {
      cookies: {},
      headers: {},
      ...overrides,
    } as unknown as Request;
  };

  const mockRes = {} as Response;
  const mockNext: NextFunction = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    configService = {
      getOrThrow: jest.fn().mockReturnValue(JWT_SECRET),
    };

    identityClient = {
      findUserById: jest.fn().mockResolvedValue({ id: USER_ID }),
    };

    const mockLogger = {
      setContext: jest.fn(),
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    middleware = new JwtMiddleware(
      configService as unknown as ConfigService,
      identityClient as unknown as IdentityClientService,
      mockLogger as any,
    );
  });

  // ============================
  // 1. 토큰 추출 — Cookie 우선, Authorization fallback
  // ============================
  describe('토큰 추출', () => {
    it('httpOnly Cookie에서 토큰 추출', async () => {
      const token = createValidToken();
      const req = createMockRequest({
        cookies: { token },
      });

      await middleware.use(req, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(req.headers['x-user-id']).toBe(USER_ID);
    });

    it('Authorization Bearer 헤더에서 토큰 추출 (fallback)', async () => {
      const token = createValidToken();
      const req = createMockRequest({
        headers: { authorization: `Bearer ${token}` },
      });

      await middleware.use(req, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(req.headers['x-user-id']).toBe(USER_ID);
    });

    it('Cookie와 Authorization 모두 없는 경우 → UnauthorizedException', async () => {
      const req = createMockRequest();

      await expect(middleware.use(req, mockRes, mockNext)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(middleware.use(req, mockRes, mockNext)).rejects.toThrow(
        '인증 토큰이 없습니다.',
      );
    });

    it('Cookie가 있으면 Authorization 헤더보다 우선', async () => {
      const cookieToken = createValidToken({ sub: USER_ID });
      const otherUserId = 'other-uuid-1234-5678-abcd-ef0123456789';
      const headerToken = createValidToken({ sub: otherUserId });
      const req = createMockRequest({
        cookies: { token: cookieToken },
        headers: { authorization: `Bearer ${headerToken}` },
      });

      await middleware.use(req, mockRes, mockNext);

      expect(req.headers['x-user-id']).toBe(USER_ID);
    });
  });

  // ============================
  // 2. JWT 검증 — 유효/무효 토큰
  // ============================
  describe('JWT 검증', () => {
    it('유효한 토큰 — next() 호출 + X-User-ID 주입', async () => {
      const token = createValidToken();
      const req = createMockRequest({ cookies: { token } });

      await middleware.use(req, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(req.headers['x-user-id']).toBe(USER_ID);
    });

    it('만료된 토큰 → UnauthorizedException', async () => {
      const token = jwt.sign(
        { sub: USER_ID },
        JWT_SECRET,
        { algorithm: 'HS256', expiresIn: '-1s' },
      );
      const req = createMockRequest({ cookies: { token } });

      await expect(middleware.use(req, mockRes, mockNext)).rejects.toThrow(
        '토큰이 만료되었습니다.',
      );
    });

    it('잘못된 시크릿으로 서명된 토큰 → UnauthorizedException', async () => {
      const token = jwt.sign(
        { sub: USER_ID, exp: Math.floor(Date.now() / 1000) + 3600 },
        'wrong-secret',
        { algorithm: 'HS256' },
      );
      const req = createMockRequest({ cookies: { token } });

      await expect(middleware.use(req, mockRes, mockNext)).rejects.toThrow(
        '유효하지 않은 토큰입니다.',
      );
    });

    it('형식이 잘못된 토큰 → UnauthorizedException', async () => {
      const req = createMockRequest({ cookies: { token: 'not-a-jwt-token' } });

      await expect(middleware.use(req, mockRes, mockNext)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('exp 클레임 없는 토큰 → UnauthorizedException', async () => {
      const token = jwt.sign(
        { sub: USER_ID },
        JWT_SECRET,
        { algorithm: 'HS256', noTimestamp: true },
      );
      const req = createMockRequest({ cookies: { token } });

      await expect(middleware.use(req, mockRes, mockNext)).rejects.toThrow(
        '토큰에 만료 시간(exp)이 없습니다.',
      );
    });

    it('sub/userId 없는 토큰 → UnauthorizedException', async () => {
      const token = jwt.sign(
        { role: 'admin' },
        JWT_SECRET,
        { algorithm: 'HS256', expiresIn: '1h' },
      );
      const req = createMockRequest({ cookies: { token } });

      await expect(middleware.use(req, mockRes, mockNext)).rejects.toThrow(
        '토큰에 사용자 ID가 없습니다.',
      );
    });
  });

  // ============================
  // 3. 탈퇴 계정 검증
  // ============================
  describe('탈퇴 계정 검증', () => {
    it('존재하지 않는 사용자 — 401 거부', async () => {
      identityClient.findUserById.mockResolvedValue(null);
      const token = createValidToken();
      const req = createMockRequest({ cookies: { token } });

      await expect(middleware.use(req, mockRes, mockNext)).rejects.toThrow(
        '존재하지 않는 계정입니다. 다시 로그인해주세요.',
      );
    });

    it('Identity 서비스 에러 — 401 거부', async () => {
      identityClient.findUserById.mockRejectedValue(new Error('Connection refused'));
      const token = createValidToken();
      const req = createMockRequest({ cookies: { token } });

      await expect(middleware.use(req, mockRes, mockNext)).rejects.toThrow(
        '존재하지 않는 계정입니다. 다시 로그인해주세요.',
      );
    });
  });

  // ============================
  // 4. X-Study-ID 헤더 검증
  // ============================
  describe('X-Study-ID 헤더 검증', () => {
    it('유효한 UUID 형식 X-Study-ID — 정상 전달', async () => {
      const token = createValidToken();
      const studyId = '12345678-abcd-ef01-2345-678901234567';
      const req = createMockRequest({
        cookies: { token },
        headers: { 'x-study-id': studyId },
      });

      await middleware.use(req, mockRes, mockNext);

      expect(req.headers['x-study-id']).toBe(studyId);
    });

    it('잘못된 UUID 형식 X-Study-ID → UnauthorizedException', async () => {
      const token = createValidToken();
      const req = createMockRequest({
        cookies: { token },
        headers: { 'x-study-id': 'not-a-uuid' },
      });

      await expect(middleware.use(req, mockRes, mockNext)).rejects.toThrow(
        'X-Study-ID 형식이 올바르지 않습니다 (UUID 필수).',
      );
    });

    it('X-Study-ID 없는 경우 — 정상 통과', async () => {
      const token = createValidToken();
      const req = createMockRequest({ cookies: { token } });

      await middleware.use(req, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  // ============================
  // 5. Authorization 헤더 제거
  // ============================
  describe('Authorization 헤더 제거', () => {
    it('검증 후 Authorization 헤더 제거 (내부 서비스 전달 차단)', async () => {
      const token = createValidToken();
      const req = createMockRequest({
        headers: { authorization: `Bearer ${token}` },
      });

      await middleware.use(req, mockRes, mockNext);

      expect(req.headers['authorization']).toBeUndefined();
    });
  });
});
