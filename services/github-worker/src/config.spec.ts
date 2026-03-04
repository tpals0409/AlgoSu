/**
 * config.ts 단위 테스트
 */

describe('config', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    // 필수 환경변수 설정
    process.env['RABBITMQ_URL'] = 'amqp://test:5672';
    process.env['GITHUB_TOKEN_ENCRYPTION_KEY'] = 'a'.repeat(64);
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('필수 환경변수가 설정되면 config 객체를 정상 반환', () => {
    const { config } = require('./config');

    expect(config.rabbitmqUrl).toBe('amqp://test:5672');
    expect(config.githubTokenEncryptionKey).toBe('a'.repeat(64));
  });

  it('선택 환경변수 기본값 적용', () => {
    const { config } = require('./config');

    expect(config.redisUrl).toBe('redis://localhost:6379');
    expect(config.gatewayInternalUrl).toBe('http://gateway:3000');
    expect(config.maxRetries).toBe(3);
    expect(config.retryDelayMs).toBe(5000);
  });

  it('선택 환경변수 커스텀 값 적용', () => {
    process.env['REDIS_URL'] = 'redis://custom:6380';
    process.env['MAX_RETRIES'] = '5';
    process.env['RETRY_DELAY_MS'] = '10000';
    process.env['GATEWAY_INTERNAL_URL'] = 'http://custom-gw:4000';

    const { config } = require('./config');

    expect(config.redisUrl).toBe('redis://custom:6380');
    expect(config.maxRetries).toBe(5);
    expect(config.retryDelayMs).toBe(10000);
    expect(config.gatewayInternalUrl).toBe('http://custom-gw:4000');
  });

  it('RABBITMQ_URL 누락 시 에러', () => {
    delete process.env['RABBITMQ_URL'];

    expect(() => require('./config')).toThrow('필수 환경변수 누락: RABBITMQ_URL');
  });

  it('GITHUB_TOKEN_ENCRYPTION_KEY 누락 시 에러', () => {
    delete process.env['GITHUB_TOKEN_ENCRYPTION_KEY'];

    expect(() => require('./config')).toThrow('필수 환경변수 누락: GITHUB_TOKEN_ENCRYPTION_KEY');
  });

  it('githubAppId / githubAppPrivateKeyBase64 기본값은 빈 문자열', () => {
    const { config } = require('./config');

    expect(config.githubAppId).toBe('');
    expect(config.githubAppPrivateKeyBase64).toBe('');
  });
});
