/**
 * @file GitHub Push 서비스 — 유저 토큰 기반 개인 레포 코드 push
 * @domain github
 * @layer service
 * @related worker.ts, token-manager.ts
 */
import { Octokit } from '@octokit/rest';
import { logger } from './logger';

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
      const { data } = await octokit.repos.getContent({
        owner: input.githubUsername,
        repo: REPO_NAME,
        path: filePath,
      });

      if (!Array.isArray(data) && data.type === 'file') {
        existingSha = data.sha;
      }
    } catch {
      // 파일 없음 → 새로 생성
    }

    // 파일 생성/업데이트
    const { data: result } = await octokit.repos.createOrUpdateFileContents({
      owner: input.githubUsername,
      repo: REPO_NAME,
      path: filePath,
      message: `Submit: ${title} (${input.language})`,
      content: Buffer.from(input.code).toString('base64'),
      sha: existingSha,
    });

    logger.info('GitHub Push 완료', { action: 'PUSH_DONE' });

    return {
      filePath,
      sha: result.content?.sha ?? '',
    };
  }

  /**
   * 파일명에 사용할 수 없는 문자 제거
   */
  private sanitizeFileName(name: string): string {
    return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim() || 'untitled';
  }

  /**
   * 플랫폼명 정규화
   * 예: "백준" → "BOJ", "프로그래머스" → "Programmers"
   */
  private formatPlatform(platform: string): string {
    const map: Record<string, string> = {
      '백준': 'BOJ',
      'baekjoon': 'BOJ',
      'boj': 'BOJ',
      '프로그래머스': 'Programmers',
      'programmers': 'Programmers',
      'leetcode': 'LeetCode',
      'softeer': 'Softeer',
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
   */
  private async ensureRepoExists(octokit: Octokit, username: string): Promise<void> {
    try {
      await octokit.repos.get({
        owner: username,
        repo: REPO_NAME,
      });
    } catch (error: unknown) {
      const status = (error as { status?: number }).status;
      if (status === 404) {
        // 레포 자동 생성 (private)
        await octokit.repos.createForAuthenticatedUser({
          name: REPO_NAME,
          description: 'AlgoSu 알고리즘 제출 자동 저장',
          private: false,
          auto_init: true,
        });
        logger.info('레포 자동 생성 완료', { action: 'REPO_CREATED' });
      } else {
        throw error;
      }
    }
  }
}
