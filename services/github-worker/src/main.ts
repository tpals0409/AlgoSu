/**
 * @file main.ts — GitHub Worker 엔트리포인트 (RabbitMQ 소비자 기동)
 * @domain github-worker
 * @layer config
 * @related worker.ts, config.ts, logger.ts
 */
// @ci-measurement: sprint-105-post-baseline (Sprint 105 [B] 실측 앵커, 제거 금지)
import { GitHubWorker } from './worker';
import { logger } from './logger';
import { startMetricsServer } from './metrics';

async function main(): Promise<void> {
  logger.info('GitHub Worker 시작');

  startMetricsServer();

  const worker = new GitHubWorker();
  await worker.start();

  // Graceful Shutdown
  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`${signal} 수신 — 종료 중`, { tag: 'SHUTDOWN' });
    await worker.stop();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

void main().catch((err) => {
  logger.error('치명적 오류', { err, tag: 'FATAL' });
  process.exit(1);
});
