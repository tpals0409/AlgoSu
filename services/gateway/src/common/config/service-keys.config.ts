/**
 * @file 서비스별 Internal API Key + 라우팅 테이블 관리
 * @domain common
 * @layer config
 * @related proxy.module.ts, internal-key.guard.ts
 *
 * 보안 요구사항:
 * - 서비스별 고유 Key 발급 (서비스 간 Key 공유 금지)
 * - 키 값은 환경변수에서만 주입 (코드 하드코딩 절대 금지)
 * - k3s Secret으로 관리
 * - 로그에 키 원문 출력 금지
 */

export interface ServiceKeyConfig {
  /** 내부 라우팅 프리픽스 */
  prefix: string;
  /** 환경변수 키 이름 (서비스 URL) */
  urlEnvKey: string;
  /** 환경변수 키 이름 (Internal API Key) */
  keyEnvKey: string;
  /** 서비스 설명 */
  description: string;
}

/**
 * 라우팅 테이블 — 서비스별 프리픽스 + 키 매핑
 *
 * 화이트리스트 기반: 여기에 등록된 서비스만 라우팅 허용
 */
export const SERVICE_ROUTING_TABLE: ServiceKeyConfig[] = [
  // /auth/* 및 /api/studies/* 는 Gateway 내부 모듈(OAuthModule, StudyModule)이 직접 처리
  // /internal/* 는 Gateway 내부 모듈(InternalModule)이 직접 처리
  {
    prefix: '/api/problems',
    urlEnvKey: 'PROBLEM_SERVICE_URL',
    keyEnvKey: 'INTERNAL_KEY_PROBLEM',
    description: 'Problem Service — 주차별 문제 관리, 마감 시간',
  },
  {
    prefix: '/api/submissions',
    urlEnvKey: 'SUBMISSION_SERVICE_URL',
    keyEnvKey: 'INTERNAL_KEY_SUBMISSION',
    description: 'Submission Service — 코드 제출 CRUD, Saga',
  },
  {
    prefix: '/api/analysis',
    urlEnvKey: 'AI_ANALYSIS_SERVICE_URL',
    keyEnvKey: 'INTERNAL_KEY_AI_ANALYSIS',
    description: 'AI Analysis Service — Claude 기반 코드 분석',
  },
];

/**
 * 서비스간 내부 통신용 라우팅 (비-Gateway 경유)
 * Submission → Problem Service 마감 시간 조회 등
 */
export const INTERNAL_SERVICE_ROUTES = {
  SUBMISSION_TO_PROBLEM: {
    urlEnvKey: 'PROBLEM_SERVICE_URL',
    keyEnvKey: 'INTERNAL_KEY_SUBMISSION',
    description: 'Submission Service → Problem Service 마감 시간 조회',
  },
} as const;
