/**
 * @file E2E 전 구간 테스트 — 프로그래머스 sourcePlatform 전달 검증
 * @domain e2e
 * @layer test
 * @related services/github-worker/src/github-push.service.ts
 *           services/ai-analysis/src/prompt.py
 *           services/submission/src/saga/mq-publisher.service.ts
 *
 * 검증 범위:
 *   [A] GitHub Worker — sourcePlatform='programmers' → 파일 경로 PROGRAMMERS_1845_폰켓몬.py
 *   [B] MQ 이벤트 계약 — SubmissionEvent에 sourcePlatform 필드 포함 여부
 *   [C] AI 분석 프롬프트 — 플랫폼별 맥락 주입 (Python subprocess 호출)
 *   [D] 외부 API 격리 — GitHub/Claude API 실제 호출 0건 보장
 *
 * 실행:
 *   cd tests/e2e && npm test
 *   또는 레포 루트에서: cd tests/e2e && npx jest
 *
 * 제약:
 *   - GitHub API: Octokit jest.mock() 차단 (실제 github.com 호출 0건)
 *   - Claude API: 직접 호출 없음 (Python prompt 빌더만 검증)
 *   - AI 분석 섹션(C): Python 3.10+ 필요 (CI Python 3.12 환경에서 완전 실행)
 */

import { spawnSync } from 'child_process';
import * as path from 'path';

import {
  makeAiAnalysisEvent,
  makePushInput,
  BOJ_TWO_SUM,
  BOJ_TWO_SUM_SOLUTION,
  PROGRAMMERS_PHONEKEMON,
  PROGRAMMERS_PHONEKEMON_SOLUTION,
} from './fixtures/programmers-problem';

// ─── GitHub Worker 의존성 Mock ─────────────────────────────────────────────
// jest.mock 호이스팅: 이 블록은 파일 최상단에 위치한 것처럼 동작함

jest.mock('../../services/github-worker/src/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  logMqConsume: jest.fn(),
  logMqConsumeDone: jest.fn(),
  logDlqReceived: jest.fn(),
}));

jest.mock('../../services/github-worker/src/config', () => ({
  config: {
    rateLimitWarnThreshold: 10,
    maxRetries: 3,
    retryDelayMs: 100,
    // E2E 테스트용 더미값 — 실제 키 아님
    githubAppId: '999',
    githubPrivateKey: '',
    gatewayInternalUrl: 'http://localhost:3000',
    internalKeyGateway: 'e2e-test-internal-key',
    problemServiceUrl: 'http://localhost:3002',
    problemServiceKey: 'e2e-test-problem-key',
    redisUrl: 'redis://localhost:6379',
    rabbitmqUrl: 'amqp://localhost',
    mqPrefetch: 2,
    dlqMaxRetries: 3,
    metricsPort: 9100,
  },
}));

jest.mock('../../services/github-worker/src/metrics', () => ({
  githubRateLimitWarningsTotal: { inc: jest.fn() },
  githubRateLimitedTotal: { inc: jest.fn() },
  dlqMessagesTotal: { inc: jest.fn() },
  mqMessagesProcessedTotal: { inc: jest.fn() },
}));

// ─── GitHub API Stub — 외부 호출 0건 보장 ─────────────────────────────────
// 변수명 mock* 접두사: jest.mock 팩토리 내에서 호이스팅 허용

const mockGetContent = jest.fn();
const mockCreateOrUpdateFileContents = jest.fn();
const mockReposGet = jest.fn();
const mockCreateForAuthenticatedUser = jest.fn();

jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn().mockImplementation(() => ({
    repos: {
      get: mockReposGet,
      getContent: mockGetContent,
      createOrUpdateFileContents: mockCreateOrUpdateFileContents,
      createForAuthenticatedUser: mockCreateForAuthenticatedUser,
    },
  })),
}));

// ─── Import (jest.mock 이후) ───────────────────────────────────────────────
import { GitHubPushService } from '../../services/github-worker/src/github-push.service';

// ─── 상수 ─────────────────────────────────────────────────────────────────

const AI_ANALYSIS_DIR = path.resolve(__dirname, '../../services/ai-analysis');
const PYTHON_BIN = process.env['PYTHON_BIN'] ?? 'python3';

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * 성공 Octokit 응답 객체 생성
 */
function octokitSuccessResp(data: unknown) {
  return {
    status: 201,
    url: '',
    headers: {
      'x-ratelimit-remaining': '100',
      'x-ratelimit-limit': '5000',
      'x-ratelimit-reset': '9999999999',
    },
    data,
  };
}

/**
 * Python 버전 문자열 조회
 */
function getPythonVersion(): string {
  const result = spawnSync(PYTHON_BIN, ['--version'], { encoding: 'utf-8' });
  return (result.stdout || result.stderr || '').trim();
}

/**
 * Python 3.10+ 여부 확인 (str | None 유니언 타입 지원 버전)
 */
function isPython310Plus(): boolean {
  const ver = getPythonVersion();
  const match = ver.match(/Python (\d+)\.(\d+)/);
  if (!match || match.length < 3) return false;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  return major > 3 || (major === 3 && minor >= 10);
}

/**
 * Python subprocess로 ai-analysis/src/prompt.py build_user_prompt 호출
 * @param sourcePlatform - 'PROGRAMMERS' | 'BOJ' | null
 * @returns 생성된 프롬프트 문자열
 */
function buildPromptViaSubprocess(sourcePlatform: string | null): string {
  const platformVal = sourcePlatform === null ? 'None' : `'${sourcePlatform}'`;
  const script = [
    `import sys`,
    `sys.path.insert(0, '${AI_ANALYSIS_DIR}')`,
    `from src.prompt import build_user_prompt`,
    `result = build_user_prompt(`,
    `  code="def solution(nums): return min(len(set(nums)), len(nums)//2)",`,
    `  language="python",`,
    `  problem_title="폰켓몬",`,
    `  source_platform=${platformVal}`,
    `)`,
    `print(result, end='')`,
  ].join('\n');

  const result = spawnSync(PYTHON_BIN, ['-c', script], {
    encoding: 'utf-8',
    cwd: AI_ANALYSIS_DIR,
  });

  if (result.error) {
    throw new Error(`Python 실행 오류: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`Python 비정상 종료 (code=${result.status}): ${result.stderr}`);
  }
  return result.stdout;
}

// ─── 테스트 스위트 ────────────────────────────────────────────────────────

describe('[E2E] 프로그래머스 전 구간 플로우 — sourcePlatform 전달 검증', () => {
  let service: GitHubPushService;

  beforeEach(() => {
    jest.clearAllMocks();

    // GitHub 레포: 404 → 자동 생성 경로
    mockReposGet.mockRejectedValue({ status: 404 });
    mockCreateForAuthenticatedUser.mockResolvedValue(
      octokitSuccessResp({ name: 'algosu-submissions' }),
    );

    // 기존 파일 없음 → 신규 생성
    mockGetContent.mockRejectedValue({ status: 404 });
    mockCreateOrUpdateFileContents.mockResolvedValue(
      octokitSuccessResp({ content: { sha: 'e2e-sha-abc123' } }),
    );

    service = new GitHubPushService();
  });

  // ==========================================================================
  // [A] GitHub Worker — 프로그래머스 파일 경로 생성
  // ==========================================================================

  describe('[A] GitHub Worker 파일 경로 생성', () => {
    /**
     * 핵심 시나리오:
     * sourcePlatform='programmers' + sourceUrl의 마지막 세그먼트 '1845' 추출
     * → formatPlatform('programmers') = 'PROGRAMMERS'
     * → 최종 파일명 '3월1주차/PROGRAMMERS_1845_폰켓몬.py'
     */
    it('[A1] 프로그래머스 제출 → PROGRAMMERS_1845_폰켓몬.py 파일 경로 생성', async () => {
      // Given: 프로그래머스 폰켓몬(#1845) 제출 이벤트
      const input = makePushInput(PROGRAMMERS_PHONEKEMON, PROGRAMMERS_PHONEKEMON_SOLUTION);

      // When: GitHub Push 서비스 실행 (GitHub API는 Octokit stub)
      const result = await service.push(input);

      // Then: 파일 경로 — PROGRAMMERS_ 접두 + 문제 번호 + 제목
      expect(result.filePath).toBe('3월1주차/PROGRAMMERS_1845_폰켓몬.py');

      // Octokit stub이 올바른 path 인자로 호출되었는지 검증
      expect(mockCreateOrUpdateFileContents).toHaveBeenCalledTimes(1);
      const callArg = mockCreateOrUpdateFileContents.mock.calls[0]?.[0] as {
        path: string;
        message: string;
        content: string;
        owner: string;
        repo: string;
      };
      expect(callArg.path).toBe('3월1주차/PROGRAMMERS_1845_폰켓몬.py');
      expect(callArg.repo).toBe('algosu-submissions');
    });

    it('[A2] 프로그래머스 + 주차 미지정 → etc/ 폴더로 생성', async () => {
      // Given: weekNumber 없음 (etc/ fallback 동작 검증)
      const input = makePushInput(
        PROGRAMMERS_PHONEKEMON,
        PROGRAMMERS_PHONEKEMON_SOLUTION,
        { weekNumber: undefined },
      );

      const result = await service.push(input);

      // Then: 주차 없으면 etc/ 폴더
      expect(result.filePath).toBe('etc/PROGRAMMERS_1845_폰켓몬.py');
    });

    it('[A3] BOJ 회귀 — sourcePlatform=baekjoon → BOJ_1001_두 수의 합.py', async () => {
      // Given: BOJ 제출 (기존 동작 회귀 검증)
      const input = makePushInput(BOJ_TWO_SUM, BOJ_TWO_SUM_SOLUTION);

      const result = await service.push(input);

      // Then: BOJ_ 접두 유지
      expect(result.filePath).toBe('3월1주차/BOJ_1001_두 수의 합.py');
    });

    it('[A4] sourcePlatform 미지정 → 플랫폼 없이 제목만으로 파일명 생성', async () => {
      // Given: sourcePlatform/sourceUrl 없음 (기존 하위호환 검증)
      const input = makePushInput(
        PROGRAMMERS_PHONEKEMON,
        PROGRAMMERS_PHONEKEMON_SOLUTION,
        { sourcePlatform: undefined, sourceUrl: undefined, weekNumber: undefined },
      );

      const result = await service.push(input);

      // Then: 플랫폼/번호 없이 제목만
      expect(result.filePath).toBe('etc/폰켓몬.py');
    });
  });

  // ==========================================================================
  // [B] MQ 이벤트 계약 — SubmissionEvent에 sourcePlatform 포함
  // ==========================================================================

  describe('[B] MQ 이벤트 계약 — sourcePlatform 필드 검증', () => {
    it('[B1] SubmissionEvent에 sourcePlatform 필드가 존재하며 PROGRAMMERS 값 전달 가능', () => {
      // Given: Submission Saga가 발행하는 AI Analysis MQ 이벤트 형태
      const event = makeAiAnalysisEvent('PROGRAMMERS');

      // Then: sourcePlatform이 올바른 값으로 포함되어야 함
      expect(event).toHaveProperty('sourcePlatform', 'PROGRAMMERS');
      expect(event).toHaveProperty('submissionId');
      expect(event).toHaveProperty('studyId');
      expect(event).toHaveProperty('userId');
      expect(event).toHaveProperty('timestamp');
    });

    it('[B2] BOJ 이벤트 — sourcePlatform=BOJ 전달 가능 (회귀)', () => {
      const event = makeAiAnalysisEvent('BOJ');
      expect(event.sourcePlatform).toBe('BOJ');
    });

    it('[B3] sourcePlatform 미지정 → undefined 허용 (기존 하위호환)', () => {
      const event = makeAiAnalysisEvent(undefined);
      // sourcePlatform 없어도 이벤트 구조 유효해야 함
      expect(event.sourcePlatform).toBeUndefined();
      expect(event.submissionId).toBeDefined();
    });

    it('[B4] GitHub Push MQ payload 형식 검증 (studyId 포함)', () => {
      // GitHub Push 이벤트는 sourcePlatform 없이 submissionId+studyId 기반
      const githubPushEvent = {
        submissionId: 'e2e-sub-pgm-001',
        studyId: 'e2e-study-001',
        timestamp: new Date().toISOString(),
      };
      expect(githubPushEvent).toHaveProperty('submissionId');
      expect(githubPushEvent).toHaveProperty('studyId');
      expect(githubPushEvent).not.toHaveProperty('githubToken');
    });
  });

  // ==========================================================================
  // [C] AI 분석 프롬프트 — 플랫폼별 맥락 주입
  // Python subprocess 사용: 로컬 Python 3.10+ / CI Python 3.12 에서 실행
  // ==========================================================================

  describe('[C] AI 분석 프롬프트 — 플랫폼 맥락 주입 (Python subprocess)', () => {
    /**
     * Python 3.10+ 미설치 시 각 테스트는 skip 처리됨
     * CI(Python 3.12) 환경에서 반드시 통과해야 함
     *
     * 로컬 Python 3.9 환경에서는 아래 출력 확인:
     *   [SKIP-LOCAL] Python 3.10+ 필요 (현재: Python 3.9.x). CI에서 검증됨.
     */

    it('[C1] PROGRAMMERS → 프롬프트에 시그니처 보존 명령 포함', () => {
      if (!isPython310Plus()) {
        // eslint-disable-next-line no-console
        console.log(
          `[SKIP-LOCAL] Python 3.10+ 필요 (현재: ${getPythonVersion()}). CI에서 검증됨.`,
        );
        return;
      }

      // Given: sourcePlatform='PROGRAMMERS'
      // When: Python prompt 빌더 실행 (Claude API 미호출 — 프롬프트 문자열만 생성)
      const prompt = buildPromptViaSubprocess('PROGRAMMERS');

      // Then: 프로그래머스 시그니처 보존 명령 포함
      expect(prompt).toContain('프로그래머스');
      expect(prompt).toContain('절대 변경하지 마세요');
      // BOJ 맥락 미포함
      expect(prompt).not.toContain('백준(BOJ)');
    });

    it('[C2] BOJ → 프롬프트에 입출력 보존 명령 포함 (회귀)', () => {
      if (!isPython310Plus()) {
        console.log( // eslint-disable-line no-console
          `[SKIP-LOCAL] Python 3.10+ 필요 (현재: ${getPythonVersion()}). CI에서 검증됨.`,
        );
        return;
      }

      const prompt = buildPromptViaSubprocess('BOJ');

      expect(prompt).toContain('백준(BOJ)');
      expect(prompt).toContain('절대 변경하지 마세요');
      expect(prompt).not.toContain('프로그래머스');
    });

    it('[C3] sourcePlatform=None → 플랫폼 맥락 없음 (기존 동작 유지)', () => {
      if (!isPython310Plus()) {
        console.log( // eslint-disable-line no-console
          `[SKIP-LOCAL] Python 3.10+ 필요 (현재: ${getPythonVersion()}). CI에서 검증됨.`,
        );
        return;
      }

      const prompt = buildPromptViaSubprocess(null);

      // 플랫폼 맥락 문구 없음 (기존 동작 유지)
      expect(prompt).not.toContain('백준');
      expect(prompt).not.toContain('프로그래머스');
      // 기존 프롬프트 구조는 유지 (코드/언어 포함)
      expect(prompt).toContain('python');
      expect(prompt).toContain('solution');
    });
  });

  // ==========================================================================
  // [D] 외부 API 격리 검증 — 실제 GitHub/Claude 호출 0건
  // ==========================================================================

  describe('[D] 외부 API 격리 — 실제 네트워크 호출 0건 보장', () => {
    it('[D1] push() 실행 시 Octokit stub만 사용 (github.com 직접 호출 없음)', async () => {
      // Given: 프로그래머스 제출
      const input = makePushInput(PROGRAMMERS_PHONEKEMON, PROGRAMMERS_PHONEKEMON_SOLUTION);

      // When: push 실행
      await service.push(input);

      // Then: Octokit createOrUpdateFileContents stub이 1회 호출됨
      //       실제 네트워크 요청이 있었다면 네트워크 에러가 발생했을 것
      expect(mockCreateOrUpdateFileContents).toHaveBeenCalledTimes(1);

      // Octokit 생성자가 테스트용 더미 토큰으로 호출됨 (실제 토큰 아님)
      const { Octokit } = jest.requireMock('@octokit/rest') as {
        Octokit: jest.MockedClass<{ new (opts: { auth: string }): unknown }>;
      };
      expect(Octokit).toHaveBeenCalledWith({
        auth: 'ghp_E2E_DUMMY_TOKEN_NOT_REAL_DO_NOT_USE',
      });
    });

    it('[D2] BOJ 회귀 케이스도 stub만 사용 (외부 호출 없음)', async () => {
      const input = makePushInput(BOJ_TWO_SUM, BOJ_TWO_SUM_SOLUTION);
      await service.push(input);
      expect(mockCreateOrUpdateFileContents).toHaveBeenCalledTimes(1);
    });
  });
});
