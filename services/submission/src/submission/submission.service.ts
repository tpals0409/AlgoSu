/**
 * @file Submission 서비스 — 제출 CRUD + Saga 연동 + 통계
 * @domain submission
 * @layer service
 * @related Submission, SagaOrchestratorService, CreateSubmissionDto
 */
import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Submission, SagaStep } from './submission.entity';
import { AiSatisfaction } from './ai-satisfaction.entity';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { UpdateAiResultDto } from './dto/update-ai-result.dto';
import { CreateAiSatisfactionDto } from './dto/create-ai-satisfaction.dto';
import { PaginationQueryDto, PaginatedResult } from './dto/pagination-query.dto';
import { SagaOrchestratorService } from '../saga/saga-orchestrator.service';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';

/** 목록 조회 시 선택할 필드 — code/aiFeedback/aiOptimizedCode 대용량 텍스트 제외 */
const SUBMISSION_LIST_FIELDS: (keyof Submission)[] = [
  'id', 'publicId', 'studyId', 'userId', 'problemId',
  'language', 'sagaStep', 'githubSyncStatus', 'githubFilePath',
  'weekNumber', 'idempotencyKey', 'aiScore', 'aiAnalysisStatus',
  'aiSkipped', 'isLate', 'createdAt', 'updatedAt',
];

@Injectable()
export class SubmissionService {
  private readonly logger: StructuredLoggerService;

  constructor(
    @InjectRepository(Submission)
    private readonly submissionRepo: Repository<Submission>,
    @InjectRepository(AiSatisfaction)
    private readonly satisfactionRepo: Repository<AiSatisfaction>,
    private readonly sagaOrchestrator: SagaOrchestratorService,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {
    this.logger = new StructuredLoggerService();
    this.logger.setContext(SubmissionService.name);
  }

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

    // A3: 지각 제출 체크 — 마감 시간 초과 시 isLate=true (제출은 허용)
    const { isLate, weekNumber } = await this.checkLateSubmission(studyId, dto.problemId, userId);

    // DB 저장 (Step 1)
    const submission = this.submissionRepo.create({
      studyId,
      userId,
      problemId: dto.problemId,
      language: dto.language,
      code: dto.code,
      sagaStep: SagaStep.DB_SAVED,
      idempotencyKey: dto.idempotencyKey ?? null,
      isLate,
      weekNumber,
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
   * 성능: code/aiFeedback/aiOptimizedCode 대용량 텍스트 제외
   */
  async findByStudyAndUser(studyId: string, userId: string): Promise<Submission[]> {
    return this.submissionRepo.find({
      where: { studyId, userId },
      order: { createdAt: 'DESC' },
      select: SUBMISSION_LIST_FIELDS,
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
      .select(SUBMISSION_LIST_FIELDS.map((f) => `s.${f}`))
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

    if (query.problemId) {
      qb.andWhere('s.problemId = :problemId', { problemId: query.problemId });
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
   * 성능: code/aiFeedback/aiOptimizedCode 대용량 텍스트 제외
   */
  async findByProblem(studyId: string, userId: string, problemId: string): Promise<Submission[]> {
    return this.submissionRepo.find({
      where: { studyId, userId, problemId },
      order: { createdAt: 'DESC' },
      select: SUBMISSION_LIST_FIELDS,
    });
  }

  /**
   * 문제별 전체 제출 조회 (스터디 단위) — 내부 API 전용
   * 그룹 분석용: 해당 스터디의 해당 문제 모든 제출
   * 성능: code/aiFeedback/aiOptimizedCode 대용량 텍스트 제외
   */
  /**
   * 스터디 전체 제출 목록 (code 제외) — 게스트 공유용
   */
  async findAllByStudy(studyId: string): Promise<Submission[]> {
    return this.submissionRepo.find({
      where: { studyId },
      order: { createdAt: 'DESC' },
      select: SUBMISSION_LIST_FIELDS,
    });
  }

  async findByProblemForStudy(studyId: string, problemId: string): Promise<Submission[]> {
    return this.submissionRepo.find({
      where: { studyId, problemId },
      order: { createdAt: 'DESC' },
      select: SUBMISSION_LIST_FIELDS,
    });
  }

  /**
   * AI 분석 결과 저장 + Saga DONE 전환
   * AI Analysis Service 콜백 — 내부 API 전용
   * QueryRunner 트랜잭션으로 save + sagaStep 업데이트를 원자적으로 처리
   */
  async updateAiResult(id: string, dto: UpdateAiResultDto): Promise<Submission> {
    const submission = await this.findById(id);

    submission.aiFeedback = dto.feedback;
    submission.aiScore = dto.score;
    submission.aiOptimizedCode = dto.optimizedCode ?? null;
    submission.aiAnalysisStatus = dto.analysisStatus;

    const needsDoneTransition =
      dto.analysisStatus === 'completed' || dto.analysisStatus === 'failed';

    if (needsDoneTransition) {
      // 트랜잭션으로 save + sagaStep DONE 전환을 원자적으로 처리
      const qr = this.dataSource.createQueryRunner();
      await qr.connect();
      await qr.startTransaction();
      try {
        const updated = await qr.manager.save(Submission, submission);
        await this.sagaOrchestrator.advanceToDone(id, qr);
        await qr.commitTransaction();

        this.logger.log(
          `AI 결과 업데이트: submissionId=${id}, status=${dto.analysisStatus}, score=${dto.score}`,
        );
        return updated;
      } catch (err) {
        await qr.rollbackTransaction();
        throw err;
      } finally {
        await qr.release();
      }
    }

    // DONE 전환 불필요 시 (delayed 등) 단순 save
    const updated = await this.submissionRepo.save(submission);

    this.logger.log(
      `AI 결과 업데이트: submissionId=${id}, status=${dto.analysisStatus}, score=${dto.score}`,
    );

    return updated;
  }

  /**
   * 스터디 통계 조회 — 내부 API 전용
   * Gateway에서 GET /api/studies/:id/stats 호출 시 사용
   */
  async getStudyStats(studyId: string, weekNumber?: string, userId?: string, activeProblemIds?: string[]): Promise<{
    totalSubmissions: number;
    uniqueSubmissions: number;
    uniqueAnalyzed: number;
    byWeek: { week: string; count: number }[];
    byWeekPerUser: { userId: string; week: string; count: number }[];
    byMember: { userId: string; count: number; doneCount: number; uniqueProblemCount: number; uniqueDoneCount: number }[];
    byMemberWeek: { userId: string; count: number }[] | null;
    recentSubmissions: { id: string; userId: string; problemId: string; language: string; sagaStep: string; aiScore: number | null; createdAt: Date }[];
    solvedProblemIds: string[] | null;
    userSubmissions: { problemId: string; aiScore: number | null; createdAt: Date }[] | null;
    submitterCountByProblem: { problemId: string; count: number; analyzedCount: number }[];
  }> {
    // activeProblemIds가 빈 배열이면 ACTIVE 문제가 없으므로 즉시 빈 결과 반환
    if (activeProblemIds && activeProblemIds.length === 0) {
      return {
        totalSubmissions: 0,
        uniqueSubmissions: 0,
        uniqueAnalyzed: 0,
        byWeek: [],
        byWeekPerUser: [],
        byMember: [],
        byMemberWeek: weekNumber ? [] : null,
        recentSubmissions: [],
        solvedProblemIds: userId ? [] : null,
        userSubmissions: userId ? [] : null,
        submitterCountByProblem: [],
      };
    }

    // 헬퍼: QueryBuilder에 activeProblemIds 필터 추가
    const applyProblemFilter = (qb: { andWhere: (condition: string, params?: Record<string, unknown>) => unknown }) => {
      if (activeProblemIds) {
        qb.andWhere('s.problem_id IN (:...activeProblemIds)', { activeProblemIds });
      }
    };

    const totalSubmissions = activeProblemIds
      ? await this.submissionRepo
          .createQueryBuilder('s')
          .where('s.study_id = :studyId', { studyId })
          .andWhere('s.problem_id IN (:...activeProblemIds)', { activeProblemIds })
          .getCount()
      : await this.submissionRepo.count({ where: { studyId } });

    // 고유 제출 수 (problemId+userId 기준 dedup) — 인원별 중복 제출은 1건으로 처리
    const uniqueSubmissionsQb = this.submissionRepo
      .createQueryBuilder('s')
      .select('COUNT(DISTINCT (s.problem_id, s.user_id))::int', 'cnt')
      .where('s.study_id = :studyId', { studyId });
    applyProblemFilter(uniqueSubmissionsQb);
    const [{ cnt: uniqueSubmissions }] = await uniqueSubmissionsQb.getRawMany<{ cnt: number }>();

    // 고유 분석 완료 수 (problemId+userId 기준 dedup, sagaStep=DONE)
    const uniqueAnalyzedQb = this.submissionRepo
      .createQueryBuilder('s')
      .select('COUNT(DISTINCT (s.problem_id, s.user_id))::int', 'cnt')
      .where('s.study_id = :studyId', { studyId })
      .andWhere("s.saga_step = 'DONE'");
    applyProblemFilter(uniqueAnalyzedQb);
    const [{ cnt: uniqueAnalyzed }] = await uniqueAnalyzedQb.getRawMany<{ cnt: number }>();

    const parseWeekKey = (w: string) => {
      const m = w.match(/^(\d+)월(\d+)주차$/);
      return m ? Number(m[1]) * 100 + Number(m[2]) : 0;
    };

    // 주차별 통계 — 스터디 전체 총 제출 건수
    const byWeekQb = this.submissionRepo
      .createQueryBuilder('s')
      .select('s.week_number', 'week')
      .addSelect('COUNT(*)::int', 'count')
      .where('s.study_id = :studyId', { studyId })
      .andWhere('s.week_number IS NOT NULL');
    applyProblemFilter(byWeekQb);
    byWeekQb.groupBy('s.week_number');
    const byWeekRaw = await byWeekQb.getRawMany<{ week: string; count: number }>();

    const byWeek = byWeekRaw
      .map((r) => ({ week: String(r.week), count: Number(r.count) }))
      .sort((a, b) => parseWeekKey(a.week) - parseWeekKey(b.week));

    // 유저별 주차 통계 — 개인별 고유 문제 수
    const byWeekPerUserQb = this.submissionRepo
      .createQueryBuilder('s')
      .select('s.user_id', 'userId')
      .addSelect('s.week_number', 'week')
      .addSelect('COUNT(DISTINCT s.problem_id)::int', 'count')
      .where('s.study_id = :studyId', { studyId })
      .andWhere('s.week_number IS NOT NULL');
    applyProblemFilter(byWeekPerUserQb);
    byWeekPerUserQb.groupBy('s.user_id').addGroupBy('s.week_number');
    const byWeekPerUserRaw = await byWeekPerUserQb.getRawMany<{ userId: string; week: string; count: number }>();

    const byWeekPerUser = byWeekPerUserRaw
      .map((r) => ({ userId: r.userId, week: String(r.week), count: Number(r.count) }))
      .sort((a, b) => parseWeekKey(a.week) - parseWeekKey(b.week));

    // 멤버별 통계
    const byMemberQb = this.submissionRepo
      .createQueryBuilder('s')
      .select('s.user_id', 'userId')
      .addSelect('COUNT(*)::int', 'count')
      .addSelect(`SUM(CASE WHEN s.saga_step = 'DONE' THEN 1 ELSE 0 END)::int`, 'doneCount')
      .addSelect('COUNT(DISTINCT s.problem_id)::int', 'uniqueProblemCount')
      .addSelect(`COUNT(DISTINCT CASE WHEN s.saga_step = 'DONE' THEN s.problem_id END)::int`, 'uniqueDoneCount')
      .where('s.study_id = :studyId', { studyId });
    applyProblemFilter(byMemberQb);
    byMemberQb.groupBy('s.user_id');
    const byMemberRaw = await byMemberQb.getRawMany<{ userId: string; count: number; doneCount: number; uniqueProblemCount: number; uniqueDoneCount: number }>();

    const byMember = byMemberRaw.map((r) => ({
      userId: r.userId,
      count: Number(r.count),
      doneCount: Number(r.doneCount),
      uniqueProblemCount: Number(r.uniqueProblemCount),
      uniqueDoneCount: Number(r.uniqueDoneCount),
    }));

    // 최근 제출 10건 (표시용)
    const recentSubmissions = activeProblemIds
      ? await this.submissionRepo.find({
          where: { studyId, problemId: In(activeProblemIds) },
          order: { createdAt: 'DESC' },
          take: 10,
          select: ['id', 'userId', 'problemId', 'language', 'sagaStep', 'aiScore', 'createdAt'],
        })
      : await this.submissionRepo.find({
          where: { studyId },
          order: { createdAt: 'DESC' },
          take: 10,
          select: ['id', 'userId', 'problemId', 'language', 'sagaStep', 'aiScore', 'createdAt'],
        });

    // 문제별 유니크 제출자 수 + 분석 완료 수 — 스터디룸 문제카드 X/N명 표시용
    const submitterCountByProblemQb = this.submissionRepo
      .createQueryBuilder('s')
      .select('s.problem_id', 'problemid')
      .addSelect('COUNT(DISTINCT s.user_id)::int', 'cnt')
      .addSelect(`COUNT(DISTINCT CASE WHEN s.saga_step = 'DONE' THEN s.user_id END)::int`, 'donecnt')
      .where('s.study_id = :studyId', { studyId });
    applyProblemFilter(submitterCountByProblemQb);
    submitterCountByProblemQb.groupBy('s.problem_id');
    const submitterCountByProblemRaw = await submitterCountByProblemQb.getRawMany<{ problemid: string; cnt: number; donecnt: number }>();

    const submitterCountByProblem = submitterCountByProblemRaw.map((r) => ({
      problemId: r.problemid,
      count: Number(r.cnt),
      analyzedCount: Number(r.donecnt),
    }));

    // 주차별 멤버 통계 — 고유 문제 수 (weekNumber 파라미터가 있을 때만)
    let byMemberWeek: { userId: string; count: number }[] | null = null;
    if (weekNumber) {
      const byMemberWeekQb = this.submissionRepo
        .createQueryBuilder('s')
        .select('s.user_id', 'userId')
        .addSelect('COUNT(DISTINCT s.problem_id)::int', 'count')
        .where('s.study_id = :studyId', { studyId })
        .andWhere('s.week_number = :weekNumber', { weekNumber });
      applyProblemFilter(byMemberWeekQb);
      byMemberWeekQb.groupBy('s.user_id');
      const byMemberWeekRaw = await byMemberWeekQb.getRawMany<{ userId: string; count: number }>();

      byMemberWeek = byMemberWeekRaw.map((r) => ({
        userId: r.userId,
        count: Number(r.count),
      }));
    }

    // 특정 유저의 완료(DONE) 문제 ID 목록 (analytics 태그/난이도 분포용)
    let solvedProblemIds: string[] | null = null;
    let userSubmissions: { problemId: string; aiScore: number | null; createdAt: Date }[] | null = null;
    if (userId) {
      const solvedQb = this.submissionRepo
        .createQueryBuilder('s')
        .select('DISTINCT s.problem_id', 'problemId')
        .where('s.study_id = :studyId', { studyId })
        .andWhere('s.user_id = :userId', { userId })
        .andWhere("s.saga_step = 'DONE'");
      applyProblemFilter(solvedQb);
      const rows = await solvedQb.getRawMany<{ problemId: string }>();
      solvedProblemIds = rows.map((r) => r.problemId);

      // 유저 전체 제출 내역 (AI 점수 계산용) — recentSubmissions(10건)과 별도
      const userSubQuery: Record<string, unknown> = { studyId, userId };
      const userSubWhere = activeProblemIds
        ? { studyId, userId, problemId: In(activeProblemIds) }
        : userSubQuery;
      userSubmissions = await this.submissionRepo.find({
        where: userSubWhere as Record<string, unknown>,
        order: { createdAt: 'DESC' },
        select: ['problemId', 'aiScore', 'createdAt'],
      });
    }

    return { totalSubmissions, uniqueSubmissions: Number(uniqueSubmissions), uniqueAnalyzed: Number(uniqueAnalyzed), byWeek, byWeekPerUser, byMember, byMemberWeek, recentSubmissions, solvedProblemIds, userSubmissions, submitterCountByProblem };
  }

  /**
   * A3: 마감 시간 체크 + weekNumber 조회 — Problem Service 내부 API 호출
   * deadline이 지났으면 isLate=true, 아직이면 false
   * weekNumber: Problem에 설정된 주차 정보
   * 조회 실패 시 안전하게 { isLate: false, weekNumber: null } 반환 (제출 차단하지 않음)
   * @domain submission
   * @guard problem-deadline
   */
  private async checkLateSubmission(
    studyId: string,
    problemId: string,
    userId?: string,
  ): Promise<{ isLate: boolean; weekNumber: string | null }> {
    try {
      const problemServiceUrl = this.configService.getOrThrow<string>('PROBLEM_SERVICE_URL');
      const internalKey = this.configService.getOrThrow<string>('PROBLEM_SERVICE_KEY');

      const headers: Record<string, string> = {
        'x-internal-key': internalKey,
        'x-study-id': studyId,
        'Content-Type': 'application/json',
      };
      if (userId) {
        headers['x-user-id'] = userId;
      }

      const response = await fetch(
        `${problemServiceUrl}/internal/deadline/${problemId}`,
        { method: 'GET', headers },
      );

      if (!response.ok) {
        this.logger.warn(`마감 시간 조회 실패: problemId=${problemId}, status=${response.status}`);
        return { isLate: false, weekNumber: null };
      }

      const result = (await response.json()) as {
        data: { deadline: string | null; weekNumber: string | null; status: string };
      };
      const { deadline, weekNumber } = result.data;

      if (!deadline) {
        return { isLate: false, weekNumber: weekNumber ?? null };
      }

      return {
        isLate: new Date(deadline) < new Date(),
        weekNumber: weekNumber ?? null,
      };
    } catch (error: unknown) {
      this.logger.warn(`마감 시간 조회 에러: problemId=${problemId}, ${(error as Error).message}`);
      return { isLate: false, weekNumber: null };
    }
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

  // ── AI 만족도 ──────────────────────────────────────────

  /**
   * AI 만족도 등록/수정 (UPSERT)
   * 동일 submissionId+userId 조합이 이미 있으면 rating/comment 업데이트
   */
  async rateSatisfaction(
    submissionId: string,
    userId: string,
    dto: CreateAiSatisfactionDto,
  ): Promise<AiSatisfaction> {
    // 제출 존재 여부 확인
    await this.findById(submissionId);

    await this.satisfactionRepo.upsert(
      {
        submissionId,
        userId,
        rating: dto.rating,
        comment: dto.comment ?? null,
      },
      {
        conflictPaths: ['submissionId', 'userId'],
      },
    );

    const saved = await this.satisfactionRepo.findOneOrFail({
      where: { submissionId, userId },
    });

    this.logger.log(
      `AI 만족도 등록: submissionId=${submissionId}, userId=${userId}, rating=${dto.rating}`,
    );

    return saved;
  }

  /**
   * 내 AI 만족도 조회
   */
  async getSatisfaction(
    submissionId: string,
    userId: string,
  ): Promise<AiSatisfaction | null> {
    return this.satisfactionRepo.findOne({
      where: { submissionId, userId },
    });
  }

  /**
   * AI 만족도 통계 (제출별 up/down 집계)
   */
  async getSatisfactionStats(
    submissionId: string,
  ): Promise<{ up: number; down: number }> {
    const rows = await this.satisfactionRepo
      .createQueryBuilder('s')
      .select('s.rating', 'rating')
      .addSelect('COUNT(*)::int', 'cnt')
      .where('s.submission_id = :submissionId', { submissionId })
      .groupBy('s.rating')
      .getRawMany<{ rating: number; cnt: number }>();

    let up = 0;
    let down = 0;
    for (const row of rows) {
      if (Number(row.rating) === 1) up = Number(row.cnt);
      if (Number(row.rating) === -1) down = Number(row.cnt);
    }

    return { up, down };
  }
}
