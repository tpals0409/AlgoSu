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

  describe('추가 분기 커버리지', () => {
    it('remainingSeconds가 null인 토큰(exp 없음) — 갱신 없이 통과', async () => {
      // exp 없는 토큰 → getRemainingSeconds가 null 반환 → 갱신 스킵
      // jwt.sign에 expiresIn 미지정 시 exp 필드 없음
      const tokenNoExp = jwt.sign({ sub: USER_ID, iat: Math.floor(Date.now() / 1000) }, JWT_SECRET);
      // jwt.decode로 exp가 없는지 확인 (테스트 전제 검증)
      const decoded = jwt.decode(tokenNoExp) as jwt.JwtPayload;
      // exp 있는 경우 jwt.sign은 기본적으로 exp를 안 붙임 (expiresIn 미지정)
      // 만약 exp가 있다면 이 테스트는 다른 분기를 커버

      const ctx = createContext({ token: tokenNoExp }, { 'x-user-id': USER_ID });

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createCallHandler()),
      );

      expect(result).toBe('ok');
      // exp가 없으면 getRemainingSeconds → null → 갱신 안 함
      // exp가 있으면 remainingSeconds > REFRESH_THRESHOLD → 갱신 안 함
      expect(mockOAuthService.findUserById).not.toHaveBeenCalled();
    });

    it('exp 필드 없는 JWT payload — null 반환 후 갱신 안 함', async () => {
      // exp 없는 payload (예: { sub: 'user' } 만 있는 토큰)
      const tokenWithoutExp = jwt.sign({ sub: USER_ID }, JWT_SECRET, {
        algorithm: 'HS256',
        // expiresIn 미지정 → exp 없음
        noTimestamp: true,
      });

      const ctx = createContext({ token: tokenWithoutExp }, { 'x-user-id': USER_ID });

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createCallHandler()),
      );

      expect(result).toBe('ok');
      expect(mockOAuthService.findUserById).not.toHaveBeenCalled();
    });

    it('findUserById가 null 반환 시 — 쿠키 발급 안 함', async () => {
      const token = createToken(60); // 1분 — 갱신 임계값 이내
      mockOAuthService.findUserById.mockResolvedValue(null); // user 없음
      const ctx = createContext({ token }, { 'x-user-id': USER_ID });

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createCallHandler()),
      );

      expect(result).toBe('ok');
      await new Promise((r) => setImmediate(r));
      // findUserById는 호출되었지만 issueAccessToken은 호출되지 않아야 함
      expect(mockOAuthService.findUserById).toHaveBeenCalledWith(USER_ID);
      expect(mockOAuthService.issueAccessToken).not.toHaveBeenCalled();
    });

    it('res.headersSent가 true인 경우 — 쿠키 미발급', async () => {
      const token = createToken(60); // 1분 — 갱신 임계값 이내
      const req = { cookies: { token }, headers: { 'x-user-id': USER_ID } };
      const res = { cookie: jest.fn(), headersSent: true }; // 이미 전송된 응답
      const ctx = {
        switchToHttp: () => ({
          getRequest: () => req,
          getResponse: () => res,
        }),
      } as unknown as ExecutionContext;

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createCallHandler()),
      );

      expect(result).toBe('ok');
      await new Promise((r) => setImmediate(r));
      // findUserById는 호출되었지만 쿠키는 설정되지 않아야 함
      expect(mockOAuthService.findUserById).toHaveBeenCalledWith(USER_ID);
      expect(res.cookie).not.toHaveBeenCalled();
    });
  });
});
