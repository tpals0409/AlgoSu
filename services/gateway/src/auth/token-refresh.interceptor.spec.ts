import { CallHandler, ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { of, lastValueFrom } from 'rxjs';
import * as jwt from 'jsonwebtoken';
import { TokenRefreshInterceptor } from './token-refresh.interceptor';
import { SessionPolicyService } from './session-policy/session-policy.service';

describe('TokenRefreshInterceptor', () => {
  let interceptor: TokenRefreshInterceptor;
  let mockOAuthService: Record<string, jest.Mock>;
  let mockConfigService: Record<string, jest.Mock>;
  let mockSessionPolicy: Record<string, jest.Mock>;
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
      // setTokenCookie가 exp claim을 디코딩하므로 실제 JWT를 반환해야 fallback 경로를 타지 않음
      issueAccessToken: jest.fn().mockReturnValue(createToken(2 * 60 * 60)),
    };

    mockConfigService = {
      get: jest.fn().mockReturnValue('development'),
    };

    // Sprint 71-1R: 임계값은 SessionPolicyService에서 주입 (기본 60분 = 3600000ms)
    mockSessionPolicy = {
      getRefreshThresholdMs: jest.fn().mockReturnValue(60 * 60 * 1000),
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
      mockSessionPolicy as unknown as SessionPolicyService,
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

  it('만료까지 90분 남은 토큰 -- 갱신 안 함 (임계값 60분 초과)', async () => {
    const token = createToken(90 * 60); // 90분
    const ctx = createContext({ token });

    const result = await lastValueFrom(
      interceptor.intercept(ctx, createCallHandler()),
    );

    expect(result).toBe('ok');
    expect(mockOAuthService.findUserById).not.toHaveBeenCalled();
  });

  it('만료까지 30분 남은 토큰 -- 자동 갱신 트리거 (임계값 60분 이내)', async () => {
    const token = createToken(30 * 60); // 30분 (< 60분 임계값)
    const ctx = createContext({ token });

    const result = await lastValueFrom(
      interceptor.intercept(ctx, createCallHandler()),
    );

    expect(result).toBe('ok');
    // tap은 비동기이므로 microtask 대기
    await new Promise((r) => setImmediate(r));
    expect(mockOAuthService.findUserById).toHaveBeenCalledWith(USER_ID);
    expect(mockOAuthService.issueAccessToken).toHaveBeenCalled();
  });

  it('[보안] JWT payload에 sub/userId 없으면 갱신 안 함', async () => {
    // sub 클레임 없는 토큰 — decodeToken이 null 반환 → 갱신 스킵
    const tokenNoSub = jwt.sign(
      { exp: Math.floor(Date.now() / 1000) + 60 }, // 1분 뒤 만료, sub 없음
      JWT_SECRET,
      { algorithm: 'HS256' },
    );
    const ctx = createContext({ token: tokenNoSub });

    await lastValueFrom(interceptor.intercept(ctx, createCallHandler()));

    expect(mockOAuthService.findUserById).not.toHaveBeenCalled();
  });

  it('[보안] 클라이언트 x-user-id 헤더 무시 — JWT payload.sub를 식별자로 사용', async () => {
    // 공격 시나리오: 공격자가 자신의 만료 임박 토큰 + 피해자 x-user-id 헤더 주입
    const VICTIM_ID = 'victim-user-uuid-9999';
    const token = createToken(30 * 60); // 30분 (< 60분 임계값) — 공격자 자신의 토큰
    const ctx = createContext({ token }, { 'x-user-id': VICTIM_ID });

    await lastValueFrom(interceptor.intercept(ctx, createCallHandler()));
    await new Promise((r) => setImmediate(r));

    // 피해자 ID(VICTIM_ID)가 아닌 토큰 payload.sub(USER_ID)로 조회해야 함
    expect(mockOAuthService.findUserById).toHaveBeenCalledWith(USER_ID);
    expect(mockOAuthService.findUserById).not.toHaveBeenCalledWith(VICTIM_ID);
  });

  it('사용자 조회 실패 시 에러 로깅만 (응답 정상)', async () => {
    const token = createToken(60);
    mockOAuthService.findUserById.mockRejectedValue(new Error('DB down'));
    const ctx = createContext({ token });

    const result = await lastValueFrom(
      interceptor.intercept(ctx, createCallHandler()),
    );

    expect(result).toBe('ok');
    await new Promise((r) => setImmediate(r));
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('디코딩 불가능한 토큰 -- 갱신 없이 통과', async () => {
    const ctx = createContext({ token: 'invalid-token' });

    const result = await lastValueFrom(
      interceptor.intercept(ctx, createCallHandler()),
    );

    expect(result).toBe('ok');
    expect(mockOAuthService.findUserById).not.toHaveBeenCalled();
  });

  describe('추가 분기 커버리지', () => {
    it('remainingSeconds가 null인 토큰(exp 없음) — 갱신 없이 통과', async () => {
      // exp 없는 토큰 → decodeToken이 null 반환 → 갱신 스킵
      const tokenNoExp = jwt.sign({ sub: USER_ID, iat: Math.floor(Date.now() / 1000) }, JWT_SECRET);

      const ctx = createContext({ token: tokenNoExp });

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createCallHandler()),
      );

      expect(result).toBe('ok');
      expect(mockOAuthService.findUserById).not.toHaveBeenCalled();
    });

    it('exp 필드 없는 JWT payload — null 반환 후 갱신 안 함', async () => {
      // exp 없는 payload (예: { sub: 'user' } 만 있는 토큰)
      const tokenWithoutExp = jwt.sign({ sub: USER_ID }, JWT_SECRET, {
        algorithm: 'HS256',
        // expiresIn 미지정 → exp 없음
        noTimestamp: true,
      });

      const ctx = createContext({ token: tokenWithoutExp });

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createCallHandler()),
      );

      expect(result).toBe('ok');
      expect(mockOAuthService.findUserById).not.toHaveBeenCalled();
    });

    it('findUserById가 null 반환 시 — 쿠키 발급 안 함', async () => {
      const token = createToken(60); // 1분 — 갱신 임계값 이내
      mockOAuthService.findUserById.mockResolvedValue(null); // user 없음
      const ctx = createContext({ token });

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
      // userId는 토큰 payload에서 추출 — 헤더 불필요
      const req = { cookies: { token }, headers: {} };
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
