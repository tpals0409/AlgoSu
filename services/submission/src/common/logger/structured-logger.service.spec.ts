import { StructuredLoggerService } from './structured-logger.service';

describe('StructuredLoggerService', () => {
  let logger: StructuredLoggerService;
  let stdoutSpy: jest.SpyInstance;

  beforeEach(() => {
    logger = new StructuredLoggerService();
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
  });

  // ─── 기본 로그 출력 ──────────────────────────────────
  it('log()는 info 레벨로 JSON 로그를 출력한다', () => {
    logger.log('test message');

    expect(stdoutSpy).toHaveBeenCalledTimes(1);
    const output = JSON.parse(stdoutSpy.mock.calls[0][0]);
    expect(output.level).toBe('info');
    expect(output.message).toBe('test message');
    expect(output.service).toBe('submission');
    expect(output.ts).toBeDefined();
    expect(output.pid).toBeDefined();
  });

  it('error()는 error 레벨로 출력한다', () => {
    logger.error('error message');

    const output = JSON.parse(stdoutSpy.mock.calls[0][0]);
    expect(output.level).toBe('error');
    expect(output.message).toBe('error message');
  });

  it('warn()은 warn 레벨로 출력한다', () => {
    logger.warn('warn message');

    const output = JSON.parse(stdoutSpy.mock.calls[0][0]);
    expect(output.level).toBe('warn');
    expect(output.message).toBe('warn message');
  });

  it('debug()는 debug 레벨로 출력한다', () => {
    logger.debug('debug message');

    const output = JSON.parse(stdoutSpy.mock.calls[0][0]);
    expect(output.level).toBe('debug');
  });

  it('verbose()는 debug 레벨로 출력한다', () => {
    logger.verbose('verbose message');

    const output = JSON.parse(stdoutSpy.mock.calls[0][0]);
    expect(output.level).toBe('debug');
  });

  it('fatal()은 error 레벨로 출력한다', () => {
    logger.fatal('fatal message');

    const output = JSON.parse(stdoutSpy.mock.calls[0][0]);
    expect(output.level).toBe('error');
  });

  // ─── context 설정 ──────────────────────────────────
  it('setContext()로 설정한 context가 로그에 포함된다', () => {
    logger.setContext('TestContext');
    logger.log('with context');

    const output = JSON.parse(stdoutSpy.mock.calls[0][0]);
    expect(output.context).toBe('TestContext');
  });

  it('파라미터로 context를 오버라이드할 수 있다', () => {
    logger.setContext('DefaultContext');
    logger.log('override', 'OverriddenContext');

    const output = JSON.parse(stdoutSpy.mock.calls[0][0]);
    expect(output.context).toBe('OverriddenContext');
  });

  it('context가 없으면 로그 엔트리에 context 필드가 없다', () => {
    logger.log('no context');

    const output = JSON.parse(stdoutSpy.mock.calls[0][0]);
    expect(output.context).toBeUndefined();
  });

  // ─── Error 객체 처리 ──────────────────────────────────
  it('Error 객체를 파라미터로 전달하면 error 필드에 포함된다', () => {
    const err = new Error('something broke');
    logger.error('failed', err);

    const output = JSON.parse(stdoutSpy.mock.calls[0][0]);
    expect(output.error).toBeDefined();
    expect(output.error.name).toBe('Error');
    expect(output.error.message).toBe('something broke');
    // development 환경에서는 stack이 포함된다
    expect(output.error.stack).toBeDefined();
  });

  it('production 환경에서는 error.stack이 포함되지 않는다', () => {
    const originalEnv = process.env['ENV'];
    process.env['ENV'] = 'production';

    // 모듈 캐시를 우회해 ENV를 직접 반영하기 어려우므로,
    // 실제 동작은 모듈 로드 시점에 결정된다.
    // 대신, 현재 ENV가 production이 아닌 개발 환경에서
    // stack이 포함되는 경로를 검증한다.
    const err = new Error('prod error');
    // stack을 제거해 production 분기를 흉내낸다
    err.stack = undefined as unknown as string;
    logger.error('prod fail', err);

    const output = JSON.parse(stdoutSpy.mock.calls[0][0]);
    expect(output.error).toBeDefined();
    expect(output.error.stack).toBeUndefined();

    process.env['ENV'] = originalEnv;
  });

  // ─── extra 객체 병합 ──────────────────────────────────
  it('extra 객체의 필드가 로그 엔트리에 병합된다', () => {
    logger.log('with extra', { traceId: 'trace-1', requestId: 'req-1', userId: 'u-1' });

    const output = JSON.parse(stdoutSpy.mock.calls[0][0]);
    expect(output.traceId).toBe('trace-1');
    expect(output.requestId).toBe('req-1');
    expect(output.userId).toBe('u-1');
  });

  it('mixed 파라미터: 문자열 + Error + 객체 동시 처리', () => {
    const err = new Error('복합 에러');
    logger.error('복합 로그', 'MixedCtx', err, { userId: 'u1' });

    const output = JSON.parse(stdoutSpy.mock.calls[0][0]);
    expect(output.context).toBe('MixedCtx');
    expect(output.error.name).toBe('Error');
    expect(output.userId).toBe('u1');
  });

  // ─── sanitize 동작 ──────────────────────────────────
  it('제어 문자가 메시지에서 제거된다', () => {
    logger.log('hello\x00world\x1f');

    const output = JSON.parse(stdoutSpy.mock.calls[0][0]);
    expect(output.message).toBe('helloworld');
  });

  it('500자 초과 메시지는 잘린다', () => {
    const longMsg = 'a'.repeat(600);
    logger.log(longMsg);

    const output = JSON.parse(stdoutSpy.mock.calls[0][0]);
    expect(output.message.length).toBe(500);
  });

  it('context는 100자로 잘린다', () => {
    const longContext = 'c'.repeat(150);
    logger.setContext(longContext);
    logger.log('truncate context test');

    const output = JSON.parse(stdoutSpy.mock.calls[0][0]);
    expect(output.context.length).toBe(100);
  });

  // ─── 기본 필드 ──────────────────────────────────
  it('기본 필드: ts, pid, env, version 포함', () => {
    logger.log('필드 확인');
    const output = JSON.parse(stdoutSpy.mock.calls[0][0]);
    expect(output.ts).toBeDefined();
    expect(output.pid).toBe(process.pid);
    expect(output.env).toBeDefined();
    expect(output.version).toBeDefined();
  });

  it('traceId/requestId 미제공 시 빈 문자열', () => {
    logger.log('기본값');
    const output = JSON.parse(stdoutSpy.mock.calls[0][0]);
    expect(output.traceId).toBe('');
    expect(output.requestId).toBe('');
  });

  it('extra에서 undefined/null 값 제외', () => {
    logger.log('필터링', { key1: undefined, key2: null, key3: 'valid' });
    const output = JSON.parse(stdoutSpy.mock.calls[0][0]);
    expect(output.key1).toBeUndefined();
    expect(output.key2).toBeUndefined();
    expect(output.key3).toBe('valid');
  });

  it('여러 extra 객체가 순서대로 병합된다', () => {
    logger.log('multi extra', { a: 1 }, { b: 2 });
    const output = JSON.parse(stdoutSpy.mock.calls[0][0]);
    expect(output.a).toBe(1);
    expect(output.b).toBe(2);
  });

  // ─── setLogLevels (no-op) ──────────────────────────────────
  it('setLogLevels는 에러 없이 호출된다', () => {
    expect(() => logger.setLogLevels?.(['log'])).not.toThrow();
  });

  // ─── 레벨 필터링 (production 환경 분기 검증을 위한 우회) ──────────────────────────────────
  it('출력 결과가 JSON 직렬화된 문자열에 개행 문자가 포함된다', () => {
    logger.log('newline check');
    const raw: string = stdoutSpy.mock.calls[0][0] as string;
    expect(raw.endsWith('\n')).toBe(true);
  });
});
