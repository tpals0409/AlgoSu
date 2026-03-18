import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InternalKeyGuard } from './internal-key.guard';
import { StructuredLoggerService } from '../logger/structured-logger.service';

const VALID_KEY = 'test-internal-key-12345';

const createMockContext = (headers: Record<string, string | undefined> = {}): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({
        headers,
        path: '/api/users',
        ip: '127.0.0.1',
      }),
    }),
  }) as unknown as ExecutionContext;

describe('InternalKeyGuard', () => {
  let guard: InternalKeyGuard;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    configService = {
      getOrThrow: jest.fn().mockReturnValue(VALID_KEY),
    } as unknown as jest.Mocked<ConfigService>;

    const logger = {
      setContext: jest.fn(),
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as StructuredLoggerService;

    guard = new InternalKeyGuard(configService, logger);
  });

  it('유효한 키 → true를 반환한다', () => {
    const context = createMockContext({ 'x-internal-key': VALID_KEY });

    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('잘못된 키 → UnauthorizedException', () => {
    const context = createMockContext({ 'x-internal-key': 'wrong-key' });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('키 누락 → UnauthorizedException', () => {
    const context = createMockContext({});

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('빈 문자열 → UnauthorizedException', () => {
    const context = createMockContext({ 'x-internal-key': '' });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('키 길이가 다르면 UnauthorizedException', () => {
    const context = createMockContext({ 'x-internal-key': 'short' });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('ip가 undefined일 때 키 누락 → unknown으로 로깅', () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {},
          path: '/api/users',
          ip: undefined,
        }),
      }),
    } as unknown as ExecutionContext;

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('ip가 undefined일 때 키 불일치 → unknown으로 로깅', () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { 'x-internal-key': 'wrong-key' },
          path: '/api/users',
          ip: undefined,
        }),
      }),
    } as unknown as ExecutionContext;

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });
});
