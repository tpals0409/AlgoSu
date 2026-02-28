import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Submission, SagaStep } from './submission.entity';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { SagaOrchestratorService } from '../saga/saga-orchestrator.service';

@Injectable()
export class SubmissionService {
  private readonly logger = new Logger(SubmissionService.name);

  constructor(
    @InjectRepository(Submission)
    private readonly submissionRepo: Repository<Submission>,
    private readonly sagaOrchestrator: SagaOrchestratorService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 코드 제출 — Saga Step 1 (DB 저장)
   *
   * 사전 검증: github_connected 확인 (v1.2)
   * 멱등성: idempotencyKey 기반 중복 제출 방지
   * 순서: DB 저장(saga_step=DB_SAVED) → Saga 진행(GITHUB_QUEUED)
   */
  async create(dto: CreateSubmissionDto, userId: string, studyId: string): Promise<Submission> {
    // github_connected 사전 검증 (v1.2)
    await this.verifyGitHubConnected(userId);

    // 멱등성 검사
    if (dto.idempotencyKey) {
      const existing = await this.submissionRepo.findOne({
        where: { idempotencyKey: dto.idempotencyKey, studyId },
      });
      if (existing) {
        this.logger.log(`멱등성 히트: idempotencyKey 기존 제출 반환`);
        return existing;
      }
    }

    // DB 저장 (Step 1)
    const submission = this.submissionRepo.create({
      studyId,
      userId,
      problemId: dto.problemId,
      language: dto.language,
      code: dto.code,
      sagaStep: SagaStep.DB_SAVED,
      idempotencyKey: dto.idempotencyKey ?? null,
    });

    const saved = await this.submissionRepo.save(submission);
    this.logger.log(`제출 저장: submissionId=${saved.id}, studyId=${studyId}, saga_step=DB_SAVED`);

    // Saga 진행 (비동기 — DB 업데이트 먼저, MQ 발행 나중)
    try {
      await this.sagaOrchestrator.advanceToGitHubQueued(saved.id, studyId);
    } catch (error: unknown) {
      // Saga 진행 실패해도 DB 저장은 완료 — startup hook에서 재개
      this.logger.error(
        `Saga 진행 실패: submissionId=${saved.id}, error=${(error as Error).message}`,
      );
    }

    return saved;
  }

  /**
   * 제출 조회 (단건)
   */
  async findById(id: string): Promise<Submission> {
    const submission = await this.submissionRepo.findOne({ where: { id } });
    if (!submission) {
      throw new NotFoundException(`제출을 찾을 수 없습니다: id=${id}`);
    }
    return submission;
  }

  /**
   * 스터디+사용자별 제출 목록
   * IDOR 방지: studyId + userId 조합 확인
   */
  async findByStudyAndUser(studyId: string, userId: string): Promise<Submission[]> {
    return this.submissionRepo.find({
      where: { studyId, userId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * 문제별 제출 목록 (스터디+사용자 본인만)
   */
  async findByProblem(studyId: string, userId: string, problemId: string): Promise<Submission[]> {
    return this.submissionRepo.find({
      where: { studyId, userId, problemId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * github_connected 사전 검증 (v1.2)
   * Gatekeeper Internal API 호출: GET /internal/users/:user_id/github-status
   */
  private async verifyGitHubConnected(userId: string): Promise<void> {
    const gatewayUrl = this.configService.getOrThrow<string>('GATEWAY_INTERNAL_URL');
    const internalKey = this.configService.getOrThrow<string>('INTERNAL_KEY_GATEWAY');

    try {
      const response = await fetch(
        `${gatewayUrl}/internal/users/${userId}/github-status`,
        {
          method: 'GET',
          headers: {
            'x-internal-key': internalKey,
            'Content-Type': 'application/json',
          },
        },
      );

      if (!response.ok) {
        this.logger.error(`GitHub 연동 상태 확인 실패: status=${response.status}`);
        throw new ForbiddenException('GitHub 연동 상태 확인에 실패했습니다.');
      }

      const data = (await response.json()) as { github_connected: boolean; github_username: string | null };

      if (!data.github_connected) {
        throw new ForbiddenException('GitHub 연동이 필요합니다.');
      }
    } catch (error: unknown) {
      if (error instanceof ForbiddenException) throw error;

      this.logger.error(`GitHub 연동 상태 확인 실패: ${(error as Error).message}`);
      throw new ForbiddenException('GitHub 연동 상태 확인에 실패했습니다.');
    }
  }
}
