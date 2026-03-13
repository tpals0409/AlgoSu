/**
 * @file GitHub Worker 중앙 Config — 환경변수 관리 + 필수값 검증
 * @domain github
 * @layer config
 * @related worker.ts, token-manager.ts, status-reporter.ts
 *
 * 모든 환경변수를 한 곳에서 읽고, 필수값 검증 포함.
 * 각 모듈에서는 config.xxx로 참조.
 */

function getRequired(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`필수 환경변수 누락: ${key}`);
  }
  return value;
}

function getOptional(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

/**
 * 프로덕션 필수 환경변수 — NODE_ENV=test 에서만 빈 문자열 기본값 허용
 * 보안 키가 빈 문자열로 동작하면 무인가 호출 가능하므로 startup 차단
 */
function getRequiredInProd(key: string): string {
  const value = process.env[key] ?? '';
  if (!value && process.env['NODE_ENV'] !== 'test') {
    throw new Error(`필수 환경변수 누락: ${key} (프로덕션에서 빈 문자열 허용 불가)`);
  }
  return value;
}

export const config = {
  rabbitmqUrl: getRequired('RABBITMQ_URL'),
  redisUrl: getOptional('REDIS_URL', 'redis://localhost:6379'),

  gatewayInternalUrl: getOptional('GATEWAY_INTERNAL_URL', 'http://gateway:3000'),
  internalKeyGateway: getRequiredInProd('INTERNAL_KEY_GATEWAY'),

  submissionServiceUrl: getOptional('SUBMISSION_SERVICE_URL', 'http://submission-service:3003'),
  submissionServiceKey: getRequiredInProd('SUBMISSION_SERVICE_KEY'),

  problemServiceUrl: getOptional('PROBLEM_SERVICE_URL', 'http://problem-service:3002'),
  problemServiceKey: getRequiredInProd('PROBLEM_SERVICE_KEY'),

  maxRetries: parseInt(getOptional('MAX_RETRIES', '3'), 10),
  retryDelayMs: parseInt(getOptional('RETRY_DELAY_MS', '5000'), 10),

  githubAppId: process.env['GITHUB_APP_ID'] ?? '',
  githubAppPrivateKeyBase64: process.env['GITHUB_APP_PRIVATE_KEY_BASE64'] ?? '',

  githubTokenEncryptionKey: getRequired('GITHUB_TOKEN_ENCRYPTION_KEY'),

  githubTokenTtl: parseInt(getOptional('GITHUB_TOKEN_TTL', '3600'), 10),
  githubTokenRefreshInterval: parseInt(getOptional('GITHUB_TOKEN_REFRESH_INTERVAL', String(50 * 60 * 1000)), 10),
};
