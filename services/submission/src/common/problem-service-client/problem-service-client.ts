/**
 * @file problem-service-client.ts -- Problem Service HTTP 호출 + 호스트 단일 CB 보호 (Sprint 135 D9 — Wave C)
 * @domain common
 * @layer service
 * @related circuit-breaker.service.ts, saga-orchestrator.service.ts, submission.service.ts
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type CircuitBreaker from 'opossum';
import { StructuredLoggerService } from '../logger/structured-logger.service';
import { CircuitBreakerService } from '../circuit-breaker';
import { buildHttpError } from '../circuit-breaker/circuit-breaker.constants';

/** Problem Service 호환 op 타입 */
export type ProblemOp = 'getSourcePlatform' | 'getDeadline';

/** 호스트 단일 CB로 전달되는 요청 페이로드 */
export interface ProblemRequest {
  op: ProblemOp;
  problemId: string;
  studyId: string;
  userId?: string;
}

/** sourcePlatform 조회 응답 스키마 */
interface SourcePlatformResponse {
  data: { sourcePlatform?: string };
}

/** 마감 시간 조회 응답 스키마 */
interface DeadlineResponse {
  data: { deadline: string | null; weekNumber: string | null; status: string };
}

/** 마감 시간 조회 결과 */
export interface DeadlineResult {
  isLate: boolean;
  weekNumber: string | null;
}

/** fetch timeout (ms) — Problem Service 응답 SLA 5초 */
const FETCH_TIMEOUT_MS = 5_000;

/**
 * Problem Service HTTP 클라이언트 — 호스트 단일 CB(`problem-service-internal`) 보호.
 *
 * Sprint 135 D9 — Wave C (Critic 3차 패턴 동일 적용):
 * - 호스트 1개 = CB 1개 원칙 — submission 서비스의 Problem Service 호출 2곳을 통합 보호
 * - generic dispatcher(`_dispatch`)로 2개 op(getSourcePlatform/getDeadline) 공유
 * - 호스트 장애 시 모든 op 동시 차단 → dead host 부하 증폭 방지
 * - op별 fallback으로 graceful degradation 유지 (기존 catch 로직과 동일)
 *
 * 보안: x-internal-key/x-study-id/x-user-id 헤더 사용, 토큰/키 로그 출력 금지
 */
@Injectable()
export class ProblemServiceClient implements OnModuleInit {
  private readonly logger: StructuredLoggerService;
  private readonly problemServiceUrl: string;
  private readonly problemServiceKey: string;
  private hostBreaker!: CircuitBreaker<[ProblemRequest], unknown>;

  constructor(
    private readonly configService: ConfigService,
    private readonly cbService: CircuitBreakerService,
  ) {
    this.logger = new StructuredLoggerService();
    this.logger.setContext(ProblemServiceClient.name);
    this.problemServiceUrl = this.configService.get<string>(
      'PROBLEM_SERVICE_URL',
      'http://problem-service:3002',
    );
    this.problemServiceKey = this.configService.get<string>(
      'PROBLEM_SERVICE_KEY',
      '',
    );
  }

  /**
   * 호스트 단일 CB 등록 — 5xx/auth/timeout 시 OPEN.
   *
   * 4xx 중 화이트리스트({404,410,422})는 DEFAULT_ERROR_FILTER가 filtered 처리(failure 미카운트).
   * Problem Service의 dynamic endpoint(`/internal/{problemId}` 등)이므로 404 = "problem not found"
   * 자연스러운 비즈니스 에러로 간주 가능.
   */
  onModuleInit(): void {
    this.hostBreaker = this.cbService.createBreaker<[ProblemRequest], unknown>(
      'problem-service-internal',
      this._dispatch.bind(this),
      {
        fallback: this._fallback.bind(this) as (...args: unknown[]) => unknown,
      },
    );
  }

  /**
   * sourcePlatform 조회 — CB 보호.
   *
   * @param problemId 문제 ID
   * @param studyId 스터디 ID
   * @param userId 사용자 ID (필수)
   * @returns sourcePlatform 문자열 또는 undefined (조회 실패 / CB OPEN)
   */
  async getSourcePlatform(
    problemId: string,
    studyId: string,
    userId: string,
  ): Promise<string | undefined> {
    // env miss 시 즉시 fallback — fetch slow path 회피 (Critic 1차 P2).
    // 기존 `submission.service.checkLateSubmission`의 `getOrThrow` 즉시 fallback 동작 보존.
    if (!this.problemServiceKey) {
      this.logger.warn(
        'PROBLEM_SERVICE_KEY 미설정 — getSourcePlatform 즉시 fallback (env 검증 필요)',
      );
      return undefined;
    }
    try {
      const result = await this.hostBreaker.fire({
        op: 'getSourcePlatform',
        problemId,
        studyId,
        userId,
      });
      return result as string | undefined;
    } catch (error: unknown) {
      this.logger.warn(
        `getSourcePlatform 예외: problemId=${problemId}, error=${(error as Error).message}`,
      );
      return undefined;
    }
  }

  /**
   * 마감 시간 조회 — CB 보호.
   *
   * @param problemId 문제 ID
   * @param studyId 스터디 ID
   * @param userId 사용자 ID (옵셔널)
   * @returns 마감 시간 결과 (조회 실패 / CB OPEN 시 fallback `{isLate: false, weekNumber: null}`)
   */
  async getDeadline(
    problemId: string,
    studyId: string,
    userId?: string,
  ): Promise<DeadlineResult> {
    // env miss 시 즉시 fallback — fetch slow path 회피 (Critic 1차 P2).
    // 기존 `submission.service.checkLateSubmission`의 `getOrThrow` 즉시 fallback 동작 보존.
    if (!this.problemServiceKey) {
      this.logger.warn(
        'PROBLEM_SERVICE_KEY 미설정 — getDeadline 즉시 fallback (env 검증 필요)',
      );
      return { isLate: false, weekNumber: null };
    }
    try {
      const result = await this.hostBreaker.fire({
        op: 'getDeadline',
        problemId,
        studyId,
        userId,
      });
      return result as DeadlineResult;
    } catch (error: unknown) {
      this.logger.warn(
        `getDeadline 예외: problemId=${problemId}, error=${(error as Error).message}`,
      );
      return { isLate: false, weekNumber: null };
    }
  }

  /**
   * dispatcher — op별 endpoint 호출 (action 본체).
   */
  private async _dispatch(req: ProblemRequest): Promise<unknown> {
    const { op } = req;
    if (op === 'getSourcePlatform') {
      return await this._doGetSourcePlatform(req);
    }
    if (op === 'getDeadline') {
      return await this._doGetDeadline(req);
    }
    throw new Error(`Unknown ProblemOp: ${op as string}`);
  }

  /**
   * sourcePlatform fetch 본체 — non-2xx 시 status 첨부 throw.
   */
  private async _doGetSourcePlatform(
    req: ProblemRequest,
  ): Promise<string | undefined> {
    const { problemId, studyId, userId } = req;
    const headers = this._buildHeaders(studyId, userId);

    const resp = await fetch(
      `${this.problemServiceUrl}/internal/${problemId}`,
      { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
    );

    if (!resp.ok) {
      throw buildHttpError(
        `sourcePlatform 조회 실패: problemId=${problemId}, status=${resp.status}`,
        resp.status,
      );
    }

    const body = (await resp.json()) as SourcePlatformResponse;
    return body.data.sourcePlatform || undefined;
  }

  /**
   * 마감 시간 fetch 본체 — non-2xx 시 status 첨부 throw.
   */
  private async _doGetDeadline(req: ProblemRequest): Promise<DeadlineResult> {
    const { problemId, studyId, userId } = req;
    const headers = this._buildHeaders(studyId, userId);

    const resp = await fetch(
      `${this.problemServiceUrl}/internal/deadline/${problemId}`,
      { method: 'GET', headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
    );

    if (!resp.ok) {
      throw buildHttpError(
        `마감 시간 조회 실패: problemId=${problemId}, status=${resp.status}`,
        resp.status,
      );
    }

    const body = (await resp.json()) as DeadlineResponse;
    const { deadline, weekNumber } = body.data;

    if (!deadline) {
      return { isLate: false, weekNumber: weekNumber ?? null };
    }
    return {
      isLate: new Date(deadline) < new Date(),
      weekNumber: weekNumber ?? null,
    };
  }

  /**
   * 공용 헤더 빌더 — userId 옵셔널 분기 흡수.
   */
  private _buildHeaders(studyId: string, userId?: string): Record<string, string> {
    const headers: Record<string, string> = {
      'x-internal-key': this.problemServiceKey,
      'x-study-id': studyId,
      'Content-Type': 'application/json',
    };
    if (userId) headers['x-user-id'] = userId;
    return headers;
  }

  /**
   * CB OPEN 시 op별 fallback — 기존 graceful degradation 유지.
   */
  private _fallback(req: ProblemRequest): unknown {
    if (req.op === 'getSourcePlatform') return undefined;
    if (req.op === 'getDeadline') return { isLate: false, weekNumber: null };
    return null;
  }
}
