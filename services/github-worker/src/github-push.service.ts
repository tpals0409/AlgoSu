import { Octokit } from '@octokit/rest';
import { TokenManager } from './token-manager';

/**
 * GitHub Push 서비스
 *
 * 파일 경로 규칙: submissions/{week}/{user_id}/{submission_id}.{ext}
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
  repoOwner: string;
  repoName: string;
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

export class GitHubPushService {
  constructor(private readonly tokenManager: TokenManager) {}

  async push(input: PushInput): Promise<PushResult> {
    const token = await this.tokenManager.getTokenForRepo(input.repoOwner, input.repoName);
    const octokit = new Octokit({ auth: token });

    const ext = LANGUAGE_EXT[input.language] ?? 'txt';
    const filePath = `submissions/${input.userId}/${input.problemId}/${input.submissionId}.${ext}`;

    // 기존 파일 확인 (업데이트 or 생성)
    let existingSha: string | undefined;

    try {
      const { data } = await octokit.repos.getContent({
        owner: input.repoOwner,
        repo: input.repoName,
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
      owner: input.repoOwner,
      repo: input.repoName,
      path: filePath,
      message: `Submit: ${input.problemId} (${input.language})`,
      content: Buffer.from(input.code).toString('base64'),
      sha: existingSha,
    });

    console.log(
      `[GitHubPush] 완료: submissionId=${input.submissionId}, path=${filePath}`,
    );

    return {
      filePath,
      sha: result.content?.sha ?? '',
    };
  }
}
