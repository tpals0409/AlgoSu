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
import { UpdateAiResultDto } from './dto/update-ai-result.dto';
import { PaginationQueryDto, PaginatedResult } from './dto/pagination-query.dto';
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
   * GitHub 파일 경로 업데이트 — 콜백에서 호출
   */
  async updateGithubFilePath(id: string, filePath: string): Promise<void> {
    await this.submissionRepo.update(id, { githubFilePath: filePath });
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
   * 스터디+사용자별 제출 목록 (페이지네이션)
   * IDOR 방지: studyId + userId 스코핑
   * DoS 방지: limit max 100
   */
  async findByStudyAndUserPaginated(
    studyId: string,
    userId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<Submission>> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const [sortField, sortDirection] = (query.sort ?? 'createdAt_DESC').split('_');

    // M15: SQL Injection 방지 — sortField 화이트리스트
    const allowedSortFields = ['createdAt', 'language', 'sagaStep', 'weekNumber', 'updatedAt'];
    const safeSortField = allowedSortFields.includes(sortField) ? sortField : 'createdAt';

    const qb = this.submissionRepo
      .createQueryBuilder('s')
      .where('s.studyId = :studyId', { studyId })
      .andWhere('s.userId = :userId', { userId });

    if (query.language) {
      qb.andWhere('s.language = :language', { language: query.language });
    }

    if (query.sagaStep) {
      qb.andWhere('s.sagaStep = :sagaStep', { sagaStep: query.sagaStep });
    }

    if (query.weekNumber) {
      qb.andWhere('s.weekNumber = :weekNumber', { weekNumber: query.weekNumber });
    }

    qb.orderBy(
      `s.${safeSortField}`,
      sortDirection === 'ASC' ? 'ASC' : 'DESC',
    );

    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
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
   * 문제별 전체 제출 조회 (스터디 단위) — 내부 API 전용
   * 그룹 분석용: 해당 스터디의 해당 문제 모든 제출
   */
  async findByProblemForStudy(studyId: string, problemId: string): Promise<Submission[]> {
    return this.submissionRepo.find({
      where: { studyId, problemId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * AI 분석 결과 저장 + Saga DONE 전환
   * AI Analysis Service 콜백 — 내부 API 전용
   */
  async updateAiResult(id: string, dto: UpdateAiResultDto): Promise<Submission> {
    const submission = await this.findById(id);

    submission.aiFeedback = dto.feedback;
    submission.aiScore = dto.score;
    submission.aiOptimizedCode = dto.optimizedCode ?? null;
    submission.aiAnalysisStatus = dto.analysisStatus;

    const updated = await this.submissionRepo.save(submission);

    // 분석 완료 시 Saga DONE 전환
    if (dto.analysisStatus === 'completed' || dto.analysisStatus === 'failed') {
      await this.sagaOrchestrator.advanceToDone(id);
    }

    this.logger.log(
      `AI 결과 업데이트: submissionId=${id}, status=${dto.analysisStatus}, score=${dto.score}`,
    );

    return updated;
  }

  /**
   * 스터디 통계 조회 — 내부 API 전용
   * Gateway에서 GET /api/studies/:id/stats 호출 시 사용
   */
  async getStudyStats(studyId: string): Promise<{
    totalSubmissions: number;
    byWeek: { week: number; count: number }[];
    byMember: { userId: string; count: number; doneCount: number }[];
    recentSubmissions: { id: string; userId: string; problemId: string; language: string; sagaStep: string; createdAt: Date }[];
  }> {
    const totalSubmissions = await this.submissionRepo.count({
      where: { studyId },
    });

    // 주차별 통계 — createdAt 기반 ISO week 그룹핑
    const byWeekRaw = await this.submissionRepo
      .createQueryBuilder('s')
      .select('EXTRACT(WEEK FROM s.created_at)::int', 'week')
      .addSelect('COUNT(*)::int', 'count')
      .where('s.study_id = :studyId', { studyId })
      .groupBy('EXTRACT(WEEK FROM s.created_at)')
      .orderBy('week', 'ASC')
      .getRawMany<{ week: number; count: number }>();

    const byWeek = byWeekRaw.map((r) => ({
      week: Number(r.week),
      count: Number(r.count),
    }));

    // 멤버별 통계
    const byMemberRaw = await this.submissionRepo
      .createQueryBuilder('s')
      .select('s.user_id', 'userId')
      .addSelect('COUNT(*)::int', 'count')
      .addSelect(`SUM(CASE WHEN s.saga_step = 'DONE' THEN 1 ELSE 0 END)::int`, 'doneCount')
      .where('s.study_id = :studyId', { studyId })
      .groupBy('s.user_id')
      .getRawMany<{ userId: string; count: number; doneCount: number }>();

    const byMember = byMemberRaw.map((r) => ({
      userId: r.userId,
      count: Number(r.count),
      doneCount: Number(r.doneCount),
    }));

    // 최근 제출 10건
    const recentSubmissions = await this.submissionRepo.find({
      where: { studyId },
      order: { createdAt: 'DESC' },
      take: 10,
      select: ['id', 'userId', 'problemId', 'language', 'sagaStep', 'createdAt'],
    });

    return { totalSubmissions, byWeek, byMember, recentSubmissions };
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
