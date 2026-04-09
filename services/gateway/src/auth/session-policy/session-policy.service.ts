/**
 * @file Session Policy 서비스 — JWT TTL / refresh threshold / heartbeat SSoT
 * @domain identity
 * @layer service
 * @related auth.module.ts, token-refresh.interceptor.ts, oauth.service.ts, session-policy.controller.ts
 *
 * 세션 관련 모든 파라미터의 단일 진실원천(Single Source of Truth).
 * - 서버: JWT 발급 expiresIn, refresh 임계값
 * - 클라이언트: GET /auth/session-policy 로 조회하여 heartbeat/timeout 동기화
 *
 * 환경변수:
 *   JWT_EXPIRES_IN            — 기본 2h (기존 유지)
 *   JWT_DEMO_EXPIRES_IN       — 기본: JWT_EXPIRES_IN
 *   SESSION_REFRESH_THRESHOLD — 기본 1h
 *   SESSION_HEARTBEAT_INTERVAL— 기본 10m
 *   SESSION_TIMEOUT_BUFFER    — 기본 5m
 *
 * 포맷: "Nh" | "Nm" | "Ns" | 숫자(초) 허용. 잘못된 포맷은 fallback 적용 + warn 로그.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * 클라이언트(FE)에게 노출되는 세션 정책 DTO.
 * sessionTimeoutMs = accessTokenTtlMs + timeoutBufferMs
 */
export interface ClientSessionPolicyDto {
  accessTokenTtlMs: number;
  heartbeatIntervalMs: number;
  sessionTimeoutMs: number;
  refreshThresholdMs: number;
}

const DEFAULT_ACCESS_TTL = '2h';
const DEFAULT_REFRESH_THRESHOLD = '1h';
const DEFAULT_HEARTBEAT_INTERVAL = '10m';
const DEFAULT_TIMEOUT_BUFFER = '5m';

/**
 * 간단 duration 파서 — Nh/Nm/Ns 또는 순수 초 숫자만 허용.
 * ms 패키지 직접 의존을 피하고(transitive만 존재) 허용 포맷을 축소하여 오용을 방지한다.
 */
const DURATION_REGEX = /^\s*(\d+(?:\.\d+)?)\s*(ms|s|m|h|d)?\s*$/i;

function parseDurationMs(input: string | number | undefined): number | null {
  if (input === undefined || input === null) return null;
  if (typeof input === 'number') {
    return Number.isFinite(input) && input > 0 ? input * 1000 : null;
  }
  const match = DURATION_REGEX.exec(input);
  if (!match) return null;
  const value = parseFloat(match[1]);
  const unit = (match[2] ?? 's').toLowerCase();
  if (!Number.isFinite(value) || value <= 0) return null;
  switch (unit) {
    case 'ms':
      return value;
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      return null;
  }
}

@Injectable()
export class SessionPolicyService {
  private readonly logger = new Logger(SessionPolicyService.name);

  private readonly accessTokenTtl: string;
  private readonly accessTokenTtlMs: number;
  private readonly demoTokenTtl: string;
  private readonly demoTokenTtlMs: number;
  private readonly refreshThresholdMs: number;
  private readonly heartbeatIntervalMs: number;
  private readonly sessionTimeoutBufferMs: number;

  constructor(private readonly configService: ConfigService) {
    // JWT_EXPIRES_IN (기존 SSoT — cookie.util은 발급 토큰 exp claim을 직접 디코딩)
    const rawAccess = this.configService.get<string>('JWT_EXPIRES_IN', DEFAULT_ACCESS_TTL);
    const parsedAccess = parseDurationMs(rawAccess);
    if (parsedAccess === null) {
      this.logger.warn(
        `JWT_EXPIRES_IN 포맷 오류 "${rawAccess}" — 기본값 ${DEFAULT_ACCESS_TTL} 적용`,
      );
      this.accessTokenTtl = DEFAULT_ACCESS_TTL;
      this.accessTokenTtlMs = parseDurationMs(DEFAULT_ACCESS_TTL)!;
    } else {
      this.accessTokenTtl = rawAccess;
      this.accessTokenTtlMs = parsedAccess;
    }

    // JWT_DEMO_EXPIRES_IN (fallback: access)
    const rawDemo = this.configService.get<string>('JWT_DEMO_EXPIRES_IN');
    const parsedDemo = rawDemo ? parseDurationMs(rawDemo) : null;
    if (rawDemo && parsedDemo === null) {
      this.logger.warn(
        `JWT_DEMO_EXPIRES_IN 포맷 오류 "${rawDemo}" — access TTL(${this.accessTokenTtl})로 fallback`,
      );
      this.demoTokenTtl = this.accessTokenTtl;
      this.demoTokenTtlMs = this.accessTokenTtlMs;
    } else if (rawDemo && parsedDemo !== null) {
      this.demoTokenTtl = rawDemo;
      this.demoTokenTtlMs = parsedDemo;
    } else {
      this.demoTokenTtl = this.accessTokenTtl;
      this.demoTokenTtlMs = this.accessTokenTtlMs;
    }

    // SESSION_REFRESH_THRESHOLD
    const rawRefresh = this.configService.get<string>(
      'SESSION_REFRESH_THRESHOLD',
      DEFAULT_REFRESH_THRESHOLD,
    );
    const parsedRefresh = parseDurationMs(rawRefresh);
    if (parsedRefresh === null) {
      this.logger.warn(
        `SESSION_REFRESH_THRESHOLD 포맷 오류 "${rawRefresh}" — 기본값 ${DEFAULT_REFRESH_THRESHOLD} 적용`,
      );
      this.refreshThresholdMs = parseDurationMs(DEFAULT_REFRESH_THRESHOLD)!;
    } else {
      this.refreshThresholdMs = parsedRefresh;
    }

    // SESSION_HEARTBEAT_INTERVAL
    const rawHeartbeat = this.configService.get<string>(
      'SESSION_HEARTBEAT_INTERVAL',
      DEFAULT_HEARTBEAT_INTERVAL,
    );
    const parsedHeartbeat = parseDurationMs(rawHeartbeat);
    if (parsedHeartbeat === null) {
      this.logger.warn(
        `SESSION_HEARTBEAT_INTERVAL 포맷 오류 "${rawHeartbeat}" — 기본값 ${DEFAULT_HEARTBEAT_INTERVAL} 적용`,
      );
      this.heartbeatIntervalMs = parseDurationMs(DEFAULT_HEARTBEAT_INTERVAL)!;
    } else {
      this.heartbeatIntervalMs = parsedHeartbeat;
    }

    // SESSION_TIMEOUT_BUFFER
    const rawBuffer = this.configService.get<string>(
      'SESSION_TIMEOUT_BUFFER',
      DEFAULT_TIMEOUT_BUFFER,
    );
    const parsedBuffer = parseDurationMs(rawBuffer);
    if (parsedBuffer === null) {
      this.logger.warn(
        `SESSION_TIMEOUT_BUFFER 포맷 오류 "${rawBuffer}" — 기본값 ${DEFAULT_TIMEOUT_BUFFER} 적용`,
      );
      this.sessionTimeoutBufferMs = parseDurationMs(DEFAULT_TIMEOUT_BUFFER)!;
    } else {
      this.sessionTimeoutBufferMs = parsedBuffer;
    }
  }

  /** jsonwebtoken.sign 에 직접 넘길 expiresIn 문자열 */
  getAccessTokenTtl(): string {
    return this.accessTokenTtl;
  }

  getAccessTokenTtlMs(): number {
    return this.accessTokenTtlMs;
  }

  getDemoTokenTtl(): string {
    return this.demoTokenTtl;
  }

  getDemoTokenTtlMs(): number {
    return this.demoTokenTtlMs;
  }

  getRefreshThresholdMs(): number {
    return this.refreshThresholdMs;
  }

  getHeartbeatIntervalMs(): number {
    return this.heartbeatIntervalMs;
  }

  getSessionTimeoutBufferMs(): number {
    return this.sessionTimeoutBufferMs;
  }

  /**
   * 클라이언트 노출 정책.
   * sessionTimeoutMs = accessTokenTtlMs + timeoutBuffer — FE 자동 로그아웃 여유 시간 계산에 사용.
   */
  getClientPolicy(): ClientSessionPolicyDto {
    return {
      accessTokenTtlMs: this.accessTokenTtlMs,
      heartbeatIntervalMs: this.heartbeatIntervalMs,
      sessionTimeoutMs: this.accessTokenTtlMs + this.sessionTimeoutBufferMs,
      refreshThresholdMs: this.refreshThresholdMs,
    };
  }
}
