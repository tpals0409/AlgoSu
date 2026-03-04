import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InternalKeyGuard } from './internal-key.guard';

describe('InternalKeyGuard', () => {
  let guard: InternalKeyGuard;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

    configService = {
      getOrThrow: jest.fn().mockReturnValue('valid-internal-key'),
    } as unknown as jest.Mocked<ConfigService>;

    guard = new InternalKeyGuard(configService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const createMockContext = (headers: Record<string, string | undefined>): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          headers,
          path: '/test',
        }),
      }),
    }) as unknown as ExecutionContext;

  it('유효한 키가 있으면 true를 반환한다', () => {
    const context = createMockContext({ 'x-internal-key': 'valid-internal-key' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('헤더가 없으면 UnauthorizedException을 던진다', () => {
    const context = createMockContext({});
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('키가 일치하지 않으면 UnauthorizedException을 던진다', () => {
    const context = createMockContext({ 'x-internal-key': 'wrong-key' });
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('키 길이가 다르면 UnauthorizedException을 던진다', () => {
    const context = createMockContext({ 'x-internal-key': 'short' });
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });
});
