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

  // ─── production 환경 분기 ──────────────────────────────────
  describe('production 환경', () => {
    let prodLogger: StructuredLoggerService;
    let prodStdoutSpy: jest.SpyInstance;

    beforeEach(() => {
      jest.resetModules();
      process.env['ENV'] = 'production';
      // Re-require after env change so module-level constants re-evaluate
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { StructuredLoggerService: ProdLogger } = require('./structured-logger.service') as typeof import('./structured-logger.service');
      prodLogger = new ProdLogger();
      prodStdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    });

    afterEach(() => {
      prodStdoutSpy.mockRestore();
      delete process.env['ENV'];
      jest.resetModules();
    });

    it('production에서는 debug 레벨 로그가 출력되지 않는다', () => {
      prodLogger.debug('debug in prod');

      expect(prodStdoutSpy).not.toHaveBeenCalled();
    });

    it('production에서는 verbose 레벨 로그가 출력되지 않는다', () => {
      prodLogger.verbose('verbose in prod');

      expect(prodStdoutSpy).not.toHaveBeenCalled();
    });

    it('production에서는 info 레벨 이상의 로그는 출력된다', () => {
      prodLogger.log('info in prod');

      expect(prodStdoutSpy).toHaveBeenCalledTimes(1);
      const output = JSON.parse(prodStdoutSpy.mock.calls[0][0]);
      expect(output.level).toBe('info');
    });

    it('production에서는 error 객체의 stack이 포함되지 않는다', () => {
      const err = new Error('prod error');
      prodLogger.error('failed in prod', err);

      expect(prodStdoutSpy).toHaveBeenCalledTimes(1);
      const output = JSON.parse(prodStdoutSpy.mock.calls[0][0]);
      expect(output.error).toBeDefined();
      expect(output.error.name).toBe('Error');
      expect(output.error.message).toBe('prod error');
      expect(output.error.stack).toBeUndefined();
    });
  });

  // ─── 기본 로그 출력 ──────────────────────────────────
  it('log()는 info 레벨로 JSON 로그를 출력한다', () => {
    logger.log('test message');

    expect(stdoutSpy).toHaveBeenCalledTimes(1);
    const output = JSON.parse(stdoutSpy.mock.calls[0][0]);
    expect(output.level).toBe('info');
    expect(output.message).toBe('test message');
    expect(output.service).toBe('identity');
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

  // ─── Error 객체 처리 ──────────────────────────────────
  it('Error 객체를 파라미터로 전달하면 error 필드에 포함된다', () => {
    const err = new Error('something broke');
    logger.error('failed', err);

    const output = JSON.parse(stdoutSpy.mock.calls[0][0]);
    expect(output.error).toBeDefined();
    expect(output.error.name).toBe('Error');
    expect(output.error.message).toBe('something broke');
    expect(output.error.stack).toBeDefined();
  });

  // ─── extra 객체 병합 ──────────────────────────────────
  it('extra 객체의 필드가 로그 엔트리에 병합된다', () => {
    logger.log('with extra', { traceId: 'trace-1', requestId: 'req-1', userId: 'u-1' });

    const output = JSON.parse(stdoutSpy.mock.calls[0][0]);
    expect(output.traceId).toBe('trace-1');
    expect(output.requestId).toBe('req-1');
    expect(output.userId).toBe('u-1');
  });

  // ─── sanitize 동작 ──────────────────────────────────
  it('제어 문자가 메시지에서 제거된다', () => {
    logger.log('hello\x00world\x1f');

    const output = JSON.parse(stdoutSpy.mock.calls[0][0]);
    expect(output.message).toBe('helloworld');
  });

  // ─── setLogLevels (no-op) ──────────────────────────────────
  it('setLogLevels는 에러 없이 호출된다', () => {
    expect(() => logger.setLogLevels?.(['log'])).not.toThrow();
  });
});
