/**
 * @file saga-quota.service.ts -- AI 일일 한도 체크 (Circuit Breaker 경유 AI Analysis Service 호출)
 * @domain submission
 * @layer service
 * @related saga-orchestrator.service.ts, circuit-breaker.service.ts, AIAnalysisWorker
 * @guard ai-quota
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';
import { CircuitBreakerService } from '../common/circuit-breaker';
import { buildHttpError } from '../common/circuit-breaker/circuit-breaker.constants';

/**
 * Saga Quota Service -- AI 일일 한도 체크 전담
 *
 * SagaOrchestratorService에서 분리(ADR-030 Q-2): 한도 체크 + Circuit Breaker 소유.
 * AI Analysis Service `/quota/check` 엔드포인트를 CB 경유로 호출한다.
 *
 * 의존 방향: SagaOrchestratorService -> SagaQuotaService (단방향, 순환 없음)
 */
@Injectable()
export class SagaQuotaService {
  private readonly logger: StructuredLoggerService;
  private readonly aiAnalysisServiceUrl: string;
  private readonly aiAnalysisInternalKey: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly cbService: CircuitBreakerService,
  ) {
    this.logger = new StructuredLoggerService();
    this.logger.setContext(SagaQuotaService.name);
    this.aiAnalysisServiceUrl = this.configService.get<string>(
      'AI_ANALYSIS_SERVICE_URL',
      'http://ai-analysis-service:8000',
    );
    this.aiAnalysisInternalKey = this.configService.getOrThrow<string>(
      'INTERNAL_KEY_AI_ANALYSIS',
    );
    this.registerQuotaBreaker();
  }

  /**
   * AI Quota 체크 Circuit Breaker 등록
   *
   * 생성자 시점 등록(ADR-030 Q-2): NestJS provider 의존 그래프에서 SagaQuotaService가
   * SagaOrchestratorService보다 먼저 인스턴스화되므로, checkAiQuota 최초 호출 전에 CB 존재 보장.
   *
   * errorFilter override 이유 (Critic 1차 P1):
   * `fetchAiQuota`는 고정 endpoint(`/quota/check`)만 호출하므로 404/410/422도
   * resource-not-found 의미가 아닌 "AI Analysis Service 라우트 misconfig 또는 서비스 부재"
   * 시그널이다. default 화이트리스트({404,410,422})를 그대로 적용하면 dead service에
   * fetchAiQuota가 무한 호출되고 CB가 OPEN으로 보호되지 않아 알람이 발화하지 않는다.
   * 따라서 `errorFilter: () => false`로 모든 비-2xx 에러를 CB failure로 카운트하여
   * volumeThreshold 도달 시 OPEN → fallback `() => true`로 사용자 영향 0 + 알람 시그널 확보.
   */
  private registerQuotaBreaker(): void {
    this.cbService.createBreaker(
      'aiQuotaCheck',
      this.fetchAiQuota.bind(this),
      {
        fallback: () => true,
        errorFilter: () => false,
      },
    );
  }

  /**
   * AI 일일 한도 체크 -- Circuit Breaker 경유 AI Analysis Service 호출
   *
   * CB OPEN 시 fallback → true (허용) -- 기존 catch 로직과 동일
   *
   * @guard ai-quota
   * @param userId 사용자 ID
   * @returns true: 허용, false: 한도 초과
   */
  async checkAiQuota(userId: string): Promise<boolean> {
    try {
      const breaker = this.cbService.getBreaker('aiQuotaCheck');
      return (await breaker!.fire(userId)) as boolean;
    } catch {
      // fallback이 처리하므로 여기 도달하지 않음 (방어적 코드)
      return true;
    }
  }

  /**
   * AI Analysis Service /quota/check 직접 호출 (CB action 본체)
   *
   * 실패 시 throw -- CB가 failure로 기록 → threshold 도달 시 OPEN 전이
   * 생성자(registerQuotaBreaker)에서 createBreaker 인자로 binding됨
   *
   * @param userId 사용자 ID
   * @returns true: 허용, false: 한도 초과
   * @throws AI quota check failed (non-2xx) 또는 fetch error
   */
  private async fetchAiQuota(userId: string): Promise<boolean> {
    const resp = await fetch(
      `${this.aiAnalysisServiceUrl}/quota/check?userId=${encodeURIComponent(userId)}`,
      {
        method: 'POST',
        headers: {
          'X-Internal-Key': this.aiAnalysisInternalKey,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!resp.ok) {
      // status 첨부 — CB errorFilter(DEFAULT_ERROR_FILTER)가 화이트리스트(404/410/422) 여부 분기 (Sprint 135 D8)
      throw buildHttpError(`AI quota check failed: status=${resp.status}`, resp.status);
    }
    const body = (await resp.json()) as {
      data: { allowed: boolean; used: number; limit: number };
    };
    return body.data.allowed;
  }
}
