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

  // ──────────────────────────────────────────────
  // setContext
  // ──────────────────────────────────────────────
  it('setContext: 로그 엔트리에 context 포함', () => {
    logger.setContext('TestContext');
    logger.log('테스트 메시지');

    expect(stdoutSpy).toHaveBeenCalled();
    const entry = JSON.parse(stdoutSpy.mock.calls[0][0]);
    expect(entry.context).toBe('TestContext');
  });

  // ──────────────────────────────────────────────
  // log / warn / error / debug / verbose / fatal
  // ──────────────────────────────────────────────
  it('log(): info 레벨 출력', () => {
    logger.log('정보 메시지');
    const entry = JSON.parse(stdoutSpy.mock.calls[0][0]);
    expect(entry.level).toBe('info');
    expect(entry.message).toBe('정보 메시지');
    expect(entry.service).toBe('problem');
  });

  it('warn(): warn 레벨 출력', () => {
    logger.warn('경고 메시지');
    const entry = JSON.parse(stdoutSpy.mock.calls[0][0]);
    expect(entry.level).toBe('warn');
  });

  it('error(): error 레벨 출력', () => {
    logger.error('에러 메시지');
    const entry = JSON.parse(stdoutSpy.mock.calls[0][0]);
    expect(entry.level).toBe('error');
  });

  it('debug(): debug 레벨 출력 (개발 환경)', () => {
    logger.debug('디버그 메시지');
    const entry = JSON.parse(stdoutSpy.mock.calls[0][0]);
    expect(entry.level).toBe('debug');
  });

  it('verbose(): debug 레벨로 매핑', () => {
    logger.verbose('상세 메시지');
    const entry = JSON.parse(stdoutSpy.mock.calls[0][0]);
    expect(entry.level).toBe('debug');
  });

  it('fatal(): error 레벨로 매핑', () => {
    logger.fatal('치명적 에러');
    const entry = JSON.parse(stdoutSpy.mock.calls[0][0]);
    expect(entry.level).toBe('error');
  });

  // ──────────────────────────────────────────────
  // setLogLevels (no-op)
  // ──────────────────────────────────────────────
  it('setLogLevels: 호출 시 에러 없음', () => {
    expect(() => logger.setLogLevels?.(['log', 'error'])).not.toThrow();
  });

  // ──────────────────────────────────────────────
  // emit 내부 파라미터 처리
  // ──────────────────────────────────────────────
  it('문자열 파라미터: context 오버라이드', () => {
    logger.setContext('Default');
    logger.log('메시지', 'OverrideContext');
    const entry = JSON.parse(stdoutSpy.mock.calls[0][0]);
    expect(entry.context).toBe('OverrideContext');
  });

  it('Error 파라미터: error 필드에 포함', () => {
    const err = new Error('테스트 에러');
    logger.error('에러 발생', err);
    const entry = JSON.parse(stdoutSpy.mock.calls[0][0]);
    expect(entry.error).toBeDefined();
    expect(entry.error.name).toBe('Error');
    expect(entry.error.message).toBe('테스트 에러');
    expect(entry.error.stack).toBeDefined();
  });

  it('객체 파라미터: extra 필드에 병합', () => {
    logger.log('메시지', { traceId: 'trace-123', requestId: 'req-456', custom: 'value' });
    const entry = JSON.parse(stdoutSpy.mock.calls[0][0]);
    expect(entry.traceId).toBe('trace-123');
    expect(entry.requestId).toBe('req-456');
    expect(entry.custom).toBe('value');
  });

  it('mixed 파라미터: 문자열 + Error + 객체 동시 처리', () => {
    const err = new Error('복합 에러');
    logger.error('복합 로그', 'MixedCtx', err, { userId: 'u1' });
    const entry = JSON.parse(stdoutSpy.mock.calls[0][0]);
    expect(entry.context).toBe('MixedCtx');
    expect(entry.error.name).toBe('Error');
    expect(entry.userId).toBe('u1');
  });

  // ──────────────────────────────────────────────
  // sanitize: 제어 문자 제거
  // ──────────────────────────────────────────────
  it('제어 문자가 메시지에서 제거됨', () => {
    logger.log('hello\x00\x1fworld');
    const entry = JSON.parse(stdoutSpy.mock.calls[0][0]);
    expect(entry.message).toBe('helloworld');
  });

  // ──────────────────────────────────────────────
  // LogEntry 기본 필드
  // ──────────────────────────────────────────────
  it('기본 필드: ts, pid, env, version 포함', () => {
    logger.log('필드 확인');
    const entry = JSON.parse(stdoutSpy.mock.calls[0][0]);
    expect(entry.ts).toBeDefined();
    expect(entry.pid).toBe(process.pid);
    expect(entry.env).toBeDefined();
    expect(entry.version).toBeDefined();
  });

  it('traceId/requestId 미제공 시 빈 문자열', () => {
    logger.log('기본값');
    const entry = JSON.parse(stdoutSpy.mock.calls[0][0]);
    expect(entry.traceId).toBe('');
    expect(entry.requestId).toBe('');
  });

  it('extra에서 undefined/null 값 제외', () => {
    logger.log('필터링', { key1: undefined, key2: null, key3: 'valid' });
    const entry = JSON.parse(stdoutSpy.mock.calls[0][0]);
    expect(entry.key1).toBeUndefined();
    expect(entry.key2).toBeUndefined();
    expect(entry.key3).toBe('valid');
  });
});

// ──────────────────────────────────────────────
// Production 환경 (ENV=production) 별도 테스트
// MIN_LEVEL이 'info'가 되어 debug 레벨이 필터링되는 분기 검증
// ──────────────────────────────────────────────
describe('StructuredLoggerService (production ENV)', () => {
  let ProductionLogger: typeof import('./structured-logger.service').StructuredLoggerService;
  let stdoutSpy: jest.SpyInstance;

  beforeAll(async () => {
    jest.resetModules();
    process.env['ENV'] = 'production';
    const mod = await import('./structured-logger.service');
    ProductionLogger = mod.StructuredLoggerService;
  });

  afterAll(() => {
    delete process.env['ENV'];
    jest.resetModules();
  });

  beforeEach(() => {
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
  });

  it('production 환경: debug 레벨 필터링 (MIN_LEVEL=info 분기)', () => {
    // ENV=production → MIN_LEVEL='info' → debug 레벨은 출력 안 됨 (line 54 early return)
    const logger = new ProductionLogger();
    logger.debug('디버그 메시지 (출력 안 됨)');
    expect(stdoutSpy).not.toHaveBeenCalled();
  });

  it('production 환경: info 레벨 출력됨', () => {
    // ENV=production → MIN_LEVEL='info' → info 레벨은 출력됨
    const logger = new ProductionLogger();
    logger.log('인포 메시지');
    expect(stdoutSpy).toHaveBeenCalled();
    const entry = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
    expect(entry.level).toBe('info');
  });

  it('production 환경: error 스택 미포함 (ENV !== production false 분기)', () => {
    // ENV=production → error.stack이 entry.error에 포함되지 않음 (line 87 분기)
    const logger = new ProductionLogger();
    const err = new Error('프로덕션 에러');
    logger.error('에러 발생', err);
    expect(stdoutSpy).toHaveBeenCalled();
    const entry = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
    expect(entry.error).toBeDefined();
    expect(entry.error.stack).toBeUndefined();
  });
});
