import * as amqplib from 'amqplib';
import { GitHubPushService } from './github-push.service';
import { TokenManager } from './token-manager';
import { StatusReporter } from './status-reporter';

/**
 * GitHub Worker — RabbitMQ 소비자
 *
 * 보안 요구사항:
 * - GitHub App Token은 Redis에서만 참조 (로그 노출 금지)
 * - 메시지에 토큰/키 포함 금지
 * - Gateway Internal API 호출 시 X-Internal-Key 필수
 * - 스터디 레포 정보 로그 출력 금지
 * - prefetch=2: 동시 처리량 제한 (Free Tier 리소스 보호)
 */

interface GitHubPushEvent {
  submissionId: string;
  studyId: string;
  timestamp: string;
}

interface StudyInfo {
  github_repo: string | null;
}

const QUEUE = 'submission.github_push';
const MAX_RETRIES = parseInt(process.env['MAX_RETRIES'] ?? '3', 10);
const RETRY_DELAY_MS = parseInt(process.env['RETRY_DELAY_MS'] ?? '5000', 10);

export class GitHubWorker {
  private connection: amqplib.ChannelModel | null = null;
  private channel: amqplib.Channel | null = null;
  private pushService: GitHubPushService;
  private tokenManager: TokenManager;
  private statusReporter: StatusReporter;

  private readonly gatewayInternalUrl: string;
  private readonly internalKeyGateway: string;

  constructor() {
    this.tokenManager = new TokenManager();
    this.pushService = new GitHubPushService(this.tokenManager);
    this.statusReporter = new StatusReporter();
    this.gatewayInternalUrl = process.env['GATEWAY_INTERNAL_URL'] ?? 'http://gateway:3000';
    this.internalKeyGateway = process.env['INTERNAL_KEY_GATEWAY'] ?? '';
  }

  async start(): Promise<void> {
    const url = process.env['RABBITMQ_URL'];
    if (!url) throw new Error('RABBITMQ_URL 환경변수가 설정되지 않았습니다.');

    this.connection = await amqplib.connect(url);
    const channel = await this.connection.createChannel();
    this.channel = channel;

    // prefetch=2: 동시 처리량 제한
    await channel.prefetch(2);

    await channel.assertQueue(QUEUE, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': 'submission.events.dlx',
        'x-dead-letter-routing-key': 'github.push.dead',
      },
    });

    console.log(`[GitHub Worker] 큐 구독 시작: ${QUEUE} (prefetch=2)`);

    await channel.consume(QUEUE, async (msg) => {
      if (!msg) return;

      try {
        const event: GitHubPushEvent = JSON.parse(msg.content.toString());
        console.log(`[GitHub Worker] 메시지 수신: submissionId=${event.submissionId}`);

        await this.processWithRetry(event);
        channel.ack(msg);

        console.log(`[GitHub Worker] 처리 완료: submissionId=${event.submissionId}`);
      } catch (error: unknown) {
        const errMsg = (error as Error).message ?? 'Unknown error';
        console.error(`[GitHub Worker] 처리 실패 — DLQ 전송: ${errMsg}`);

        // DLQ로 전송 (nack + requeue=false)
        channel.nack(msg, false, false);
      }
    });
  }

  /**
   * Gateway Internal API로 스터디 github_repo 조회
   * 보안: X-Internal-Key 필수, 레포 정보 로그 출력 금지
   */
  private async getStudyGithubRepo(studyId: string): Promise<string | null> {
    const res = await fetch(
      `${this.gatewayInternalUrl}/internal/studies/${studyId}`,
      {
        headers: {
          'X-Internal-Key': this.internalKeyGateway,
          'Content-Type': 'application/json',
        },
      },
    );

    if (!res.ok) {
      throw new Error(`스터디 조회 실패: ${res.status}`);
    }

    const body = (await res.json()) as { data: StudyInfo };
    return body.data.github_repo ?? null;
  }

  private async processWithRetry(event: GitHubPushEvent): Promise<void> {
    // studyId 필수 검증
    if (!event.studyId) {
      throw new Error(`studyId 누락: submissionId=${event.submissionId}`);
    }

    // 스터디 GitHub 레포 조회
    const githubRepo = await this.getStudyGithubRepo(event.studyId);

    // github_repo 미연결 → SKIPPED 처리 후 ACK
    if (!githubRepo) {
      console.log(`[GitHub Worker] SKIPPED (github_repo 없음): submissionId=${event.submissionId}`);
      await this.statusReporter.reportSkipped(event.submissionId);
      return;
    }

    // github_repo 파싱: "owner/repo" 형식
    const slashIdx = githubRepo.indexOf('/');
    if (slashIdx === -1) {
      throw new Error(`github_repo 형식 오류 (owner/repo 필요): submissionId=${event.submissionId}`);
    }
    const repoOwner = githubRepo.slice(0, slashIdx);
    const repoName = githubRepo.slice(slashIdx + 1);

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        // 제출 데이터 조회
        const submission = await this.statusReporter.getSubmission(event.submissionId);

        // GitHub Push 실행 (레포 정보 동적 전달)
        const result = await this.pushService.push({
          submissionId: event.submissionId,
          userId: submission.userId,
          problemId: submission.problemId,
          language: submission.language,
          code: submission.code,
          repoOwner,
          repoName,
        });

        // 성공: Saga 상태 업데이트 (GITHUB_QUEUED → AI_QUEUED)
        await this.statusReporter.reportSuccess(event.submissionId, result.filePath);

        // Redis Pub/Sub으로 상태 브로드캐스트
        await this.statusReporter.publishStatusChange(event.submissionId, 'github_synced');

        return;
      } catch (error: unknown) {
        lastError = error as Error;
        const isTokenInvalid =
          lastError.message.includes('TOKEN_INVALID') ||
          lastError.message.includes('401') ||
          lastError.message.includes('403');

        if (isTokenInvalid) {
          // TOKEN_INVALID — 재시도 의미 없음
          console.warn(
            `[GitHub Worker] TOKEN_INVALID: submissionId=${event.submissionId}`,
          );
          await this.statusReporter.reportTokenInvalid(event.submissionId);
          await this.statusReporter.publishStatusChange(
            event.submissionId,
            'github_token_invalid',
          );
          return;
        }

        if (attempt < MAX_RETRIES) {
          console.warn(
            `[GitHub Worker] 재시도 ${attempt}/${MAX_RETRIES}: ${lastError.message}`,
          );
          await this.delay(RETRY_DELAY_MS * attempt);
        }
      }
    }

    // 모든 재시도 실패
    console.error(
      `[GitHub Worker] 최종 실패: submissionId=${event.submissionId}`,
    );
    await this.statusReporter.reportFailed(event.submissionId);
    await this.statusReporter.publishStatusChange(event.submissionId, 'github_failed');

    throw lastError ?? new Error('GitHub Push 최종 실패');
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async stop(): Promise<void> {
    if (this.channel) await this.channel.close();
    if (this.connection) await this.connection.close();
    await this.tokenManager.close();
    await this.statusReporter.close();
    console.log('[GitHub Worker] 종료 완료');
  }
}
