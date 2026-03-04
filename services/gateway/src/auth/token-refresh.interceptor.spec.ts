import { CallHandler, ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { of, lastValueFrom } from 'rxjs';
import * as jwt from 'jsonwebtoken';
import { TokenRefreshInterceptor } from './token-refresh.interceptor';

describe('TokenRefreshInterceptor', () => {
  let interceptor: TokenRefreshInterceptor;
  let mockOAuthService: Record<string, jest.Mock>;
  let mockConfigService: Record<string, jest.Mock>;
  let mockLogger: Record<string, jest.Mock>;

  const JWT_SECRET = 'test-secret';
  const USER_ID = 'user-uuid-1234';

  const createToken = (expiresInSec: number): string =>
    jwt.sign(
      { sub: USER_ID, exp: Math.floor(Date.now() / 1000) + expiresInSec },
      JWT_SECRET,
      { algorithm: 'HS256' },
    );

  const createContext = (
    cookies: Record<string, string> = {},
    headers: Record<string, string> = {},
  ): ExecutionContext => {
    const req = { cookies, headers };
    const res = { cookie: jest.fn(), headersSent: false };
    return {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
    } as unknown as ExecutionContext;
  };

  const createCallHandler = (value: unknown = 'ok'): CallHandler => ({
    handle: () => of(value),
  });

  beforeEach(() => {
    jest.clearAllMocks();

    mockOAuthService = {
      findUserById: jest.fn().mockResolvedValue({ id: USER_ID, email: 'test@test.com' }),
      issueAccessToken: jest.fn().mockReturnValue('new-token'),
    };

    mockConfigService = {
      get: jest.fn().mockReturnValue('development'),
    };

    mockLogger = {
      setContext: jest.fn(),
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    interceptor = new TokenRefreshInterceptor(
      mockConfigService as unknown as ConfigService,
      mockOAuthService as any,
      mockLogger as any,
    );
  });

  it('토큰 없는 요청 -- 갱신 없이 통과', async () => {
    const ctx = createContext();
    const result = await lastValueFrom(
      interceptor.intercept(ctx, createCallHandler()),
    );

    expect(result).toBe('ok');
    expect(mockOAuthService.findUserById).not.toHaveBeenCalled();
  });

  it('만료까지 10분 남은 토큰 -- 갱신 안 함', async () => {
    const token = createToken(600); // 10분
    const ctx = createContext({ token }, { 'x-user-id': USER_ID });

    const result = await lastValueFrom(
      interceptor.intercept(ctx, createCallHandler()),
    );

    expect(result).toBe('ok');
    expect(mockOAuthService.findUserById).not.toHaveBeenCalled();
  });

  it('만료까지 3분 남은 토큰 -- 자동 갱신 트리거', async () => {
    const token = createToken(180); // 3분 (< 5분 임계값)
    const ctx = createContext({ token }, { 'x-user-id': USER_ID });

    const result = await lastValueFrom(
      interceptor.intercept(ctx, createCallHandler()),
    );

    expect(result).toBe('ok');
    // tap은 비동기이므로 microtask 대기
    await new Promise((r) => setImmediate(r));
    expect(mockOAuthService.findUserById).toHaveBeenCalledWith(USER_ID);
    expect(mockOAuthService.issueAccessToken).toHaveBeenCalled();
  });

  it('x-user-id 헤더 없으면 갱신 안 함', async () => {
    const token = createToken(60); // 1분
    const ctx = createContext({ token }); // x-user-id 없음

    await lastValueFrom(interceptor.intercept(ctx, createCallHandler()));

    expect(mockOAuthService.findUserById).not.toHaveBeenCalled();
  });

  it('사용자 조회 실패 시 에러 로깅만 (응답 정상)', async () => {
    const token = createToken(60);
    mockOAuthService.findUserById.mockRejectedValue(new Error('DB down'));
    const ctx = createContext({ token }, { 'x-user-id': USER_ID });

    const result = await lastValueFrom(
      interceptor.intercept(ctx, createCallHandler()),
    );

    expect(result).toBe('ok');
    await new Promise((r) => setImmediate(r));
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('디코딩 불가능한 토큰 -- 갱신 없이 통과', async () => {
    const ctx = createContext({ token: 'invalid-token' }, { 'x-user-id': USER_ID });

    const result = await lastValueFrom(
      interceptor.intercept(ctx, createCallHandler()),
    );

    expect(result).toBe('ok');
    expect(mockOAuthService.findUserById).not.toHaveBeenCalled();
  });
});
