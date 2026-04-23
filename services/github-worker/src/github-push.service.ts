/**
 * @file GitHub Push 서비스 — 유저 토큰 기반 개인 레포 코드 push
 * @domain github
 * @layer service
 * @related worker.ts, token-manager.ts
 *
 * Rate Limit 정책:
 * - 모든 GitHub API 응답에서 X-RateLimit-* 헤더 감시
 * - remaining < threshold(기본 10) 시 WARN 로그 + 메트릭 증가
 * - 429 응답 시 Retry-After 기반 대기 후 1회 재시도
 */
import { Octokit } from '@octokit/rest';
import { OctokitResponse } from '@octokit/types';
import { logger } from './logger';
import { config } from './config';
import {
  githubRateLimitWarningsTotal,
  githubRateLimitedTotal,
} from './metrics';

/**
 * GitHub Push 서비스 — 유저 토큰 기반 개인 레포 push
 *
 * 파일 경로 규칙: {주차}/{플랫폼}_{번호}_{제목}.{ext}
 * 레포: {username}/algosu-submissions (private, 자동 생성)
 *
 * 보안:
 * - GitHub API 호출 시 토큰 로그 출력 금지
 * - 코드 내용은 로그에 기록하지 않음
 * - 레포 정보(owner/repo) 로그 출력 금지
 */

interface PushInput {
  submissionId: string;
  userId: string;
  problemId: string;
  language: string;
  code: string;
  githubUsername: string;
  githubToken: string;
  problemTitle?: string;
  weekNumber?: string;
  sourcePlatform?: string;
  sourceUrl?: string;
}

interface PushResult {
  filePath: string;
  sha: string;
}

const LANGUAGE_EXT: Record<string, string> = {
  python: 'py',
  java: 'java',
  cpp: 'cpp',
  c: 'c',
  javascript: 'js',
  typescript: 'ts',
  go: 'go',
  rust: 'rs',
  kotlin: 'kt',
  swift: 'swift',
  ruby: 'rb',
  csharp: 'cs',
};

const REPO_NAME = 'algosu-submissions';

/**
 * GitHub API Rate Limit 초과 에러
 * Retry-After 기반 대기를 위해 retryAfterMs 필드 포함
 */
export class GitHubRateLimitError extends Error {
  readonly retryAfterMs: number;
  constructor(retryAfterMs: number) {
    super(`GitHub API rate limited — retry after ${retryAfterMs}ms`);
    this.name = 'GitHubRateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

export class GitHubPushService {
  constructor() {}

  async push(input: PushInput): Promise<PushResult> {
    const octokit = new Octokit({ auth: input.githubToken });

    // 레포 존재 확인 + 자동 생성
    await this.ensureRepoExists(octokit, input.githubUsername);

    const ext = LANGUAGE_EXT[input.language] ?? 'txt';
    const weekFolder = input.weekNumber || 'etc';
    const platform = this.formatPlatform(input.sourcePlatform ?? '');
    const problemNumber = this.extractProblemNumber(input.sourceUrl ?? '');
    const title = this.sanitizeFileName(input.problemTitle ?? input.problemId);
    const fileName = [platform, problemNumber, title].filter(Boolean).join('_');
    const filePath = `${weekFolder}/${fileName}.${ext}`;

    // 기존 파일 확인 (업데이트 or 생성)
    let existingSha: string | undefined;

    try {
      const resp = await octokit.repos.getContent({
        owner: input.githubUsername,
        repo: REPO_NAME,
        path: filePath,
      });

      this.inspectRateLimit(resp);

      if (!Array.isArray(resp.data) && resp.data.type === 'file') {
        existingSha = resp.data.sha;
      }
    } catch (err) {
      // Rate Limit 429 → 대기 후 1회 재시도
      if (err instanceof GitHubRateLimitError) {
        await this.waitAndLog(err.retryAfterMs);
        // 재시도 — 여전히 실패 시 상위로 throw
        const retryResp = await octokit.repos.getContent({
          owner: input.githubUsername,
          repo: REPO_NAME,
          path: filePath,
        });
        this.inspectRateLimit(retryResp);
        if (!Array.isArray(retryResp.data) && retryResp.data.type === 'file') {
          existingSha = retryResp.data.sha;
        }
      }
      // 파일 없음(404 등) → 무시, 새로 생성
    }

    // 파일 생성/업데이트 — Rate Limit 429 시 1회 재시도
    let createResp;
    try {
      createResp = await this.createOrUpdate(octokit, input, filePath, title, existingSha);
    } catch (err) {
      if (err instanceof GitHubRateLimitError) {
        await this.waitAndLog(err.retryAfterMs);
        createResp = await this.createOrUpdate(octokit, input, filePath, title, existingSha);
      } else {
        throw err;
      }
    }

    logger.info('GitHub Push 완료', { action: 'PUSH_DONE' });

    return {
      filePath,
      sha: createResp.content?.sha ?? '',
    };
  }

  /**
   * 파일 생성/업데이트 호출 (Rate Limit 검사 포함)
   */
  private async createOrUpdate(
    octokit: Octokit,
    input: PushInput,
    filePath: string,
    title: string,
    existingSha: string | undefined,
  ) {
    const resp = await octokit.repos.createOrUpdateFileContents({
      owner: input.githubUsername,
      repo: REPO_NAME,
      path: filePath,
      message: `Submit: ${title} (${input.language})`,
      content: Buffer.from(input.code).toString('base64'),
      sha: existingSha,
    });

    this.inspectRateLimit(resp);

    return resp.data;
  }

  /**
   * GitHub API 응답에서 Rate Limit 헤더 검사
   *
   * - remaining < threshold → WARN 로그 + 메트릭
   * - status 429 → GitHubRateLimitError throw (Retry-After 포함)
   *
   * @throws {GitHubRateLimitError} 429 응답 시
   */
  inspectRateLimit(response: OctokitResponse<unknown>): void {
    const headers = response.headers;
    const status = response.status;

    // 429 Rate Limited 처리
    if (status === 429) {
      const retryAfter = parseInt(String(headers['retry-after'] ?? '60'), 10);
      const retryAfterMs = retryAfter * 1000;
      githubRateLimitedTotal.inc();
      logger.error('GitHub API Rate Limited (429)', {
        tag: 'GITHUB_RATE_LIMIT',
        code: 'GHW_RATE_001',
      });
      throw new GitHubRateLimitError(retryAfterMs);
    }

    // Rate Limit 잔여량 감시
    const remaining = parseInt(String(headers['x-ratelimit-remaining'] ?? ''), 10);
    const limit = parseInt(String(headers['x-ratelimit-limit'] ?? ''), 10);
    const resetEpoch = parseInt(String(headers['x-ratelimit-reset'] ?? ''), 10);

    if (!isNaN(remaining) && remaining < config.rateLimitWarnThreshold) {
      const resetAt = !isNaN(resetEpoch)
        ? new Date(resetEpoch * 1000).toISOString()
        : 'unknown';

      githubRateLimitWarningsTotal.inc();
      logger.warn('GitHub API Rate Limit 임박', {
        tag: 'GITHUB_RATE_LIMIT',
        code: 'GHW_RATE_002',
      });

      logger.debug('Rate Limit 상세', {
        tag: 'GITHUB_RATE_LIMIT',
      });

      // 별도 debug 로그로 수치 기록 (production에서는 출력 안 됨)
      logger.debug(`remaining=${remaining} limit=${limit} resetAt=${resetAt}`, {
        tag: 'GITHUB_RATE_LIMIT',
      });
    }
  }

  /**
   * Rate Limit 재시도 전 대기 + 로깅
   */
  private async waitAndLog(ms: number): Promise<void> {
    logger.warn(`Rate Limit 재시도 대기 ${ms}ms`, {
      tag: 'GITHUB_RATE_LIMIT',
      code: 'GHW_RATE_003',
    });
    await this.delay(ms);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 파일명에 사용할 수 없는 문자 제거
   */
  private sanitizeFileName(name: string): string {
    return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim() || 'untitled';
  }

  /**
   * 플랫폼명 대문자 풀네임 정규화
   * 예: "백준" → "BOJ", "프로그래머스" → "PROGRAMMERS"
   * 파일명 규칙: {weekFolder}/{PLATFORM}_{problemNumber}_{title}.{ext}
   */
  private formatPlatform(platform: string): string {
    const map: Record<string, string> = {
      '백준': 'BOJ',
      'baekjoon': 'BOJ',
      'boj': 'BOJ',
      '프로그래머스': 'PROGRAMMERS',
      'programmers': 'PROGRAMMERS',
      'leetcode': 'LEETCODE',
      'softeer': 'SOFTEER',
      'swea': 'SWEA',
    };
    return map[platform.toLowerCase()] ?? platform;
  }

  /**
   * source_url에서 문제 번호 추출
   * 예: https://www.acmicpc.net/problem/1001 → "1001"
   */
  private extractProblemNumber(url: string): string {
    if (!url) return '';
    const segments = url.replace(/\/+$/, '').split('/');
    return segments[segments.length - 1] ?? '';
  }

  /**
   * 유저의 algosu-submissions 레포 존재 확인, 없으면 자동 생성
   *
   * 보안 정책:
   * - 신규 레포는 반드시 private:true 로 생성 (제출 코드 공개 노출 방지)
   * - 기존 레포가 public인 경우 즉시 private으로 전환
   */
  private async ensureRepoExists(octokit: Octokit, username: string): Promise<void> {
    try {
      const repoResp = await octokit.repos.get({
        owner: username,
        repo: REPO_NAME,
      });

      // 공개 레포 → private 전환 (제출 코드 공개 노출 방지)
      if (repoResp.data.private === false) {
        await octokit.repos.update({
          owner: username,
          repo: REPO_NAME,
          private: true,
        });
        logger.warn('공개 레포를 private으로 전환', { action: 'REPO_VISIBILITY_FIXED' });
      }
    } catch (error: unknown) {
      const status = (error as { status?: number }).status;
      if (status === 404) {
        // 레포 자동 생성 (private 강제 — 제출 코드 공개 노출 방지)
        await octokit.repos.createForAuthenticatedUser({
          name: REPO_NAME,
          description: 'AlgoSu 알고리즘 제출 자동 저장',
          private: true,
          auto_init: true,
        });
        logger.info('레포 자동 생성 완료', { action: 'REPO_CREATED' });
      } else {
        throw error;
      }
    }
  }
}
