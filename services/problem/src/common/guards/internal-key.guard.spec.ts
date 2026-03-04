import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InternalKeyGuard } from './internal-key.guard';
import { StructuredLoggerService } from '../logger/structured-logger.service';

describe('InternalKeyGuard', () => {
  let guard: InternalKeyGuard;
  const VALID_KEY = 'valid-internal-key-12345';

  function createMockContext(headers: Record<string, string | undefined> = {}): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers,
          path: '/problems',
        }),
      }),
    } as unknown as ExecutionContext;
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InternalKeyGuard,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn().mockReturnValue(VALID_KEY),
          },
        },
        {
          provide: StructuredLoggerService,
          useValue: {
            setContext: jest.fn(),
            log: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
            verbose: jest.fn(),
            fatal: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<InternalKeyGuard>(InternalKeyGuard);
  });

  it('유효한 키: true 반환', () => {
    const context = createMockContext({ 'x-internal-key': VALID_KEY });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('키 없음: UnauthorizedException 발생', () => {
    const context = createMockContext({});
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(context)).toThrow('Internal API Key가 필요합니다.');
  });

  it('잘못된 키: UnauthorizedException 발생', () => {
    const context = createMockContext({ 'x-internal-key': 'wrong-key' });
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(context)).toThrow('유효하지 않은 Internal API Key입니다.');
  });

  it('키 길이 불일치: UnauthorizedException 발생', () => {
    const context = createMockContext({ 'x-internal-key': 'short' });
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });
});
