import { GitHubWorker } from './worker';
import { logger } from './logger';

/**
 * GitHub Worker Entry Point
 *
 * RabbitMQ 소비자: submission.github_push 큐 구독
 * - prefetch=2 (동시 처리량 제한 — Free Tier 안정성)
 * - 실패 시 Retry → DLQ
 */
async function main(): Promise<void> {
  logger.info('GitHub Worker 시작');

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
