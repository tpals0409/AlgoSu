import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InternalKeyGuard } from './internal-key.guard';

describe('InternalKeyGuard', () => {
  let guard: InternalKeyGuard;
  let configService: { getOrThrow: jest.Mock };

  const VALID_KEY = 'test-internal-api-key-2026';

  const createMockContext = (headers: Record<string, string | undefined> = {}) => ({
    switchToHttp: () => ({
      getRequest: () => ({
        headers,
        path: '/test',
        ip: '127.0.0.1',
      }),
    }),
  });

  beforeEach(() => {
    configService = {
      getOrThrow: jest.fn().mockReturnValue(VALID_KEY),
    };
    guard = new InternalKeyGuard(configService as unknown as ConfigService);
  });

  // --- 테스트 1: 유효한 Internal Key ---
  it('유효한 x-internal-key 헤더 → canActivate true', () => {
    const context = createMockContext({ 'x-internal-key': VALID_KEY });

    const result = guard.canActivate(context as any);

    expect(result).toBe(true);
    expect(configService.getOrThrow).toHaveBeenCalledWith('INTERNAL_API_KEY');
  });

  // --- 테스트 2: 헤더 누락 ---
  it('x-internal-key 헤더 누락 → UnauthorizedException', () => {
    const context = createMockContext({});

    expect(() => guard.canActivate(context as any)).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(context as any)).toThrow('Internal API Key가 필요합니다.');
  });

  // --- 테스트 3: 잘못된 Key ---
  it('잘못된 x-internal-key → UnauthorizedException', () => {
    const context = createMockContext({ 'x-internal-key': 'wrong-key-value' });

    expect(() => guard.canActivate(context as any)).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(context as any)).toThrow(
      '유효하지 않은 Internal API Key입니다.',
    );
  });

  // --- 테스트 4: timingSafeEqual 동일 문자열 (canActivate 간접 검증) ---
  it('timingSafeEqual — 동일 문자열 비교 시 인증 성공', () => {
    const exactKey = 'exact-same-key-123';
    configService.getOrThrow.mockReturnValue(exactKey);
    const context = createMockContext({ 'x-internal-key': exactKey });

    expect(guard.canActivate(context as any)).toBe(true);
  });

  // --- 테스트 5: timingSafeEqual 다른 문자열 (같은 길이) ---
  it('timingSafeEqual — 동일 길이 다른 문자열 비교 시 인증 실패', () => {
    // 동일 길이(10자)지만 다른 문자열
    configService.getOrThrow.mockReturnValue('aaaaaaaaaa');
    const context = createMockContext({ 'x-internal-key': 'bbbbbbbbbb' });

    expect(() => guard.canActivate(context as any)).toThrow(UnauthorizedException);
  });

  // --- 테스트 6: timingSafeEqual 길이 다른 문자열 ---
  it('timingSafeEqual — 길이 다른 문자열 비교 시 인증 실패', () => {
    configService.getOrThrow.mockReturnValue('short');
    const context = createMockContext({ 'x-internal-key': 'much-longer-key-value' });

    expect(() => guard.canActivate(context as any)).toThrow(UnauthorizedException);
  });
});
