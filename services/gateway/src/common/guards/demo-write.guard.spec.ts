import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { DemoWriteGuard } from './demo-write.guard';

describe('DemoWriteGuard', () => {
  let guard: DemoWriteGuard;

  function createMockContext(
    method: string,
    path: string,
    headers: Record<string, string> = {},
  ): ExecutionContext {
    const request = { method, path, headers };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    guard = new DemoWriteGuard();
  });

  it('일반 유저 POST 요청 — 통과', () => {
    const ctx = createMockContext('POST', '/api/submissions', {});
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('데모 유저 GET 요청 — 통과', () => {
    const ctx = createMockContext('GET', '/api/studies', { 'x-demo-user': 'true' });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('데모 유저 POST /auth/logout — 통과 (허용 목록)', () => {
    const ctx = createMockContext('POST', '/auth/logout', { 'x-demo-user': 'true' });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('데모 유저 POST /auth/refresh — 통과 (허용 목록)', () => {
    const ctx = createMockContext('POST', '/auth/refresh', { 'x-demo-user': 'true' });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('데모 유저 POST /api/submissions — ForbiddenException', () => {
    const ctx = createMockContext('POST', '/api/submissions', { 'x-demo-user': 'true' });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(ctx)).toThrow('데모 모드에서는 수정할 수 없습니다.');
  });

  it('데모 유저 PATCH 요청 — ForbiddenException', () => {
    const ctx = createMockContext('PATCH', '/auth/profile', { 'x-demo-user': 'true' });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('데모 유저 DELETE 요청 — ForbiddenException', () => {
    const ctx = createMockContext('DELETE', '/auth/account', { 'x-demo-user': 'true' });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
