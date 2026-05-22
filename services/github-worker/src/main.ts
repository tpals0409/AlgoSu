/**
 * @file main.ts — GitHub Worker 엔트리포인트 (RabbitMQ 소비자 기동)
 * @domain github-worker
 * @layer config
 * @related worker.ts, config.ts, logger.ts, circuit-breaker.ts
 */
// @ci-measurement: sprint-105-post-baseline (Sprint 105 [B] 실측 앵커, 제거 금지)
import { GitHubWorker } from './worker';
import { logger } from './logger';
import { startMetricsServer, registry } from './metrics';
import { CircuitBreakerManager } from './circuit-breaker';

/**
 * GitHub Worker 부트스트랩 — 메트릭 서버·CircuitBreaker·RabbitMQ 소비자 조립
 *
 * 진입점 직접 실행 시 반환값은 무시되며, 반환되는 핸들은
 * graceful shutdown 및 부트스트랩 스모크 테스트의 teardown(타이머/연결 정리)용이다.
 *
 * @returns 조립된 worker/cbManager 핸들
 */
export async function main(): Promise<{
  worker: GitHubWorker;
  cbManager: CircuitBreakerManager;
}> {
  logger.info('GitHub Worker 시작');

  startMetricsServer();

  const cbManager = new CircuitBreakerManager(registry);
  const worker = new GitHubWorker(cbManager);
  await worker.start();

  // Graceful Shutdown
  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`${signal} 수신 — 종료 중`, { tag: 'SHUTDOWN' });
    await worker.stop();
    cbManager.shutdown();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  return { worker, cbManager };
}

// 진입점으로 직접 실행될 때만 부트스트랩한다.
// 테스트에서 import 시 main()이 자동 실행되지 않도록 require.main 가드로 분리.
if (require.main === module) {
  void main().catch((err) => {
    logger.error('치명적 오류', { err, tag: 'FATAL' });
    process.exit(1);
  });
}
