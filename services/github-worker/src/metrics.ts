/**
 * @file GitHub Worker Prometheus 메트릭 — DLQ 카운터 + /metrics HTTP 서버
 * @domain github
 * @layer util
 * @related worker.ts, logger.ts
 *
 * 네이밍: algosu_github_worker_{metric}_{unit}
 * 보안: /metrics 인증 없이 접근 가능 (클러스터 내부 Prometheus scraper 전용)
 * 고카디널리티 라벨 금지: userId, traceId, submissionId
 */

import { createServer, IncomingMessage, ServerResponse } from 'http';
import {
  Registry,
  Counter,
  collectDefaultMetrics,
} from 'prom-client';

/**
 * 전역 prom-client Registry — CircuitBreakerManager 등 다른 모듈과 공유
 * @see circuit-breaker.ts
 */
export const registry = new Registry();
const PREFIX = 'algosu_github_worker';

collectDefaultMetrics({ register: registry, prefix: `${PREFIX}_` });

// ─── DLQ 메트릭 ────────────────────────────

/**
 * DLQ 전송 카운터 — nack(requeue=false) 시 증가
 * 라벨: reason (parse_error, process_failure)
 */
export const dlqMessagesTotal = new Counter({
  name: `${PREFIX}_dlq_messages_total`,
  help: 'Total messages sent to DLQ',
  labelNames: ['reason'] as const,
  registers: [registry],
});

/**
 * 알려진 DLQ reason 라벨 — worker.ts의 실제 inc 호출과 일치 (zero-init 대상)
 * @see worker.ts (parse_error, process_failure)
 */
export const DLQ_REASONS = ['parse_error', 'process_failure'] as const;

/**
 * DLQ 라벨 series를 0으로 사전 초기화(zero-init).
 * counter series는 .inc() 첫 호출 시 지연 생성되어 Prometheus가 값 1로 처음 관측 → DLQReceived
 * alert의 increase(...[5m])가 비교할 baseline(0) 부재로 첫 DLQ 이벤트를 놓친다(Critic R2 P2).
 * 프로세스 시작 시 0으로 초기화하면 increase가 0→1 변화를 정확히 포착한다.
 */
for (const reason of DLQ_REASONS) {
  dlqMessagesTotal.inc({ reason }, 0);
}

/**
 * MQ 메시지 처리 카운터
 * 라벨: result (ack, nack_dlq, skipped)
 */
export const mqMessagesProcessedTotal = new Counter({
  name: `${PREFIX}_mq_messages_processed_total`,
  help: 'Total MQ messages processed',
  labelNames: ['result'] as const,
  registers: [registry],
});

// ─── GitHub API Rate Limit 메트릭 ─────────────

/**
 * GitHub API Rate Limit 경고 카운터 — remaining < threshold 시 증가
 */
export const githubRateLimitWarningsTotal = new Counter({
  name: `${PREFIX}_github_rate_limit_warnings_total`,
  help: 'Total GitHub API rate limit warnings (remaining below threshold)',
  registers: [registry],
});

/**
 * GitHub API 429 (Rate Limited) 카운터
 */
export const githubRateLimitedTotal = new Counter({
  name: `${PREFIX}_github_rate_limited_total`,
  help: 'Total GitHub API 429 rate-limited responses',
  registers: [registry],
});

// ─── /metrics HTTP 서버 ─────────────────────

const METRICS_PORT = parseInt(process.env['METRICS_PORT'] ?? '9100', 10);

/**
 * /metrics HTTP 서버 시작 — Prometheus scraper 전용
 * /health 엔드포인트도 함께 제공
 */
export function startMetricsServer(): void {
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    if (req.url === '/metrics' && req.method === 'GET') {
      const metrics = await registry.metrics();
      res.writeHead(200, { 'Content-Type': registry.contentType });
      res.end(metrics);
      return;
    }
    if (req.url === '/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  server.listen(METRICS_PORT);
}
