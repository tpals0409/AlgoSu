/**
 * @file Submission 서비스 — 제출 CRUD + Saga 연동 + 통계
 * @domain submission
 * @layer service
 * @related Submission, SagaOrchestratorService, CreateSubmissionDto
 */
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { Submission, SagaStep } from './submission.entity';
import { AiSatisfaction } from './ai-satisfaction.entity';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { UpdateAiResultDto } from './dto/update-ai-result.dto';
import { CreateAiSatisfactionDto } from './dto/create-ai-satisfaction.dto';
import { PaginationQueryDto, PaginatedResult } from './dto/pagination-query.dto';
import { SagaOrchestratorService } from '../saga/saga-orchestrator.service';
import { StatsCacheService } from '../cache/stats-cache.service';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';
import { ProblemServiceClient } from '../common/problem-service-client';

/** 목록 조회 시 선택할 필드 — code/aiFeedback/aiOptimizedCode 대용량 텍스트 제외 */
const SUBMISSION_LIST_FIELDS: (keyof Submission)[] = [
  'id', 'publicId', 'studyId', 'userId', 'problemId',
  'language', 'sagaStep', 'githubSyncStatus', 'githubFilePath',
  'weekNumber', 'idempotencyKey', 'aiScore', 'aiAnalysisStatus',
  'aiSkipped', 'isLate', 'createdAt', 'updatedAt',
];

/** getStudyStats 반환 타입 — Redis 캐시 직렬화/역직렬화 대상 */
export interface StudyStatsResult {
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
}

@Injectable()
export class SubmissionService {
  private readonly logger: StructuredLoggerService;

  constructor(
    @InjectRepository(Submission)
    private readonly submissionRepo: Repository<Submission>,
    @InjectRepository(AiSatisfaction)
    private readonly satisfactionRepo: Repository<AiSatisfaction>,
    private readonly sagaOrchestrator: SagaOrchestratorService,
    private readonly dataSource: DataSource,
    private readonly problemClient: ProblemServiceClient,
    private readonly statsCache: StatsCacheService,
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
    // 멱등성 검사 — (studyId, userId, idempotencyKey) 3-tuple 스코핑으로 IDOR 방지
    if (dto.idempotencyKey) {
      const existing = await this.submissionRepo.findOne({
        where: { idempotencyKey: dto.idempotencyKey, studyId, userId },
      });
      if (existing) {
        this.logger.log(`멱등성 히트: idempotencyKey 기존 제출 반환`);
        return existing;
      }
    }

    // 지각 체크 + 문제 정보 조회를 병렬화 — incident 시 직렬 호출로 timeout 2배 방지 (Critic R1 P2)
    // 동일 호스트 단일 CB가 OPEN되면 둘 다 즉시 fallback이므로 병렬화는 안전
    const [
      { isLate, weekNumber },
      { title: problemTitle, description: problemDescription, difficulty, level },
    ] = await Promise.all([
      this.checkLateSubmission(studyId, dto.problemId, userId),
      this.problemClient.getProblemInfo(dto.problemId, studyId, userId),
    ]);

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
      // 빈 문자열로 정규화 (Critic R2 P2) — null로 저장하면 ai-analysis worker의
      // dict.get이 None 반환 → prompt builder가 "설명: None" 문자열을 LLM에 직렬화
      problemTitle: problemTitle ?? '',
      problemDescription: problemDescription ?? '',
      difficulty: difficulty ?? null,
      level: level ?? null,
    });

    const saved = await this.submissionRepo.save(submission);
    this.logger.log(`제출 저장: submissionId=${saved.id}, studyId=${studyId}, saga_step=DB_SAVED`);

    // 통계 캐시 무효화 — 제출 생성으로 통계 변경
    await this.statsCache.invalidate(studyId);

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
   * 재분석 요청 — AI 일일 한도 초과로 건너뛴(aiSkipped) 제출을 다시 AI 분석 큐에 진입시킨다.
   *
   * 한도가 초기화된 뒤 본인이 호출한다. saga 상태를 GITHUB_QUEUED로 되돌린 뒤
   * 기존 advanceToAiQueued(한도 재확인 + 큐 발행)를 재실행한다. 한도가 여전히
   * 초과 상태면 advanceToAiQueued가 다시 aiSkipped=true로 되돌린다.
   *
   * @param id 제출 ID
   * @param userId 요청자 ID (본인만 허용)
   * @returns 재진입 후 상태 — aiSkipped=false면 분석 큐잉 성공, true면 한도 여전히 초과
   * @throws NotFoundException 제출 없음
   * @throws ForbiddenException 본인 제출 아님
   * @throws BadRequestException 재분석 대상 아님 (한도 초과로 스킵된 제출이 아님)
   */
  async requestReanalysis(
    id: string,
    userId: string,
  ): Promise<{ analysisStatus: string; aiSkipped: boolean }> {
    const submission = await this.submissionRepo.findOne({ where: { id } });
    if (!submission) {
      throw new NotFoundException(`제출을 찾을 수 없습니다: id=${id}`);
    }
    if (submission.userId !== userId) {
      throw new ForbiddenException('본인 제출만 재분석을 요청할 수 있습니다.');
    }
    if (!submission.aiSkipped) {
      throw new BadRequestException(
        'AI 한도 초과로 건너뛴 제출만 재분석을 요청할 수 있습니다.',
      );
    }

    // 재진입 준비: DONE(aiSkipped) → GITHUB_QUEUED 로 원자적 되돌림 (중복 트리거 방지)
    const reset = await this.submissionRepo.update(
      { id, sagaStep: SagaStep.DONE, aiSkipped: true },
      {
        sagaStep: SagaStep.GITHUB_QUEUED,
        aiSkipped: false,
        aiAnalysisStatus: 'pending',
      },
    );

    // 경쟁: 이미 다른 요청이 재진입시켰거나 상태가 바뀜 — 현재 상태 그대로 반환
    if (reset.affected === 0) {
      const fresh = await this.submissionRepo.findOne({ where: { id } });
      return {
        analysisStatus: fresh?.aiAnalysisStatus ?? 'pending',
        aiSkipped: fresh?.aiSkipped ?? false,
      };
    }

    // 한도 재확인 + 큐 발행 (한도 여전히 초과면 내부에서 다시 skipped 처리)
    await this.sagaOrchestrator.advanceToAiQueued(id, true);

    const updated = await this.submissionRepo.findOne({ where: { id } });
    this.logger.log(
      `재분석 요청 처리: submissionId=${id}, aiSkipped=${updated?.aiSkipped}, status=${updated?.aiAnalysisStatus}`,
    );
    return {
      analysisStatus: updated?.aiAnalysisStatus ?? 'pending',
      aiSkipped: updated?.aiSkipped ?? false,
    };
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
      // 불변식: 완료/실패한 AI 분석 결과는 종단 상태이므로 sagaStep은 반드시 DONE이어야 한다.
      // aiAnalysisStatus와 sagaStep을 동일 엔티티에 실어 단일 row-write로 원자 저장한다.
      // (기존: advanceToDone의 낙관적 락 affected=0 시 조용히 return → completed만 커밋되고
      //  sagaStep이 AI_QUEUED에 잔류하여 스터디룸이 영영 "분석중"으로 표시되는 불일치 발생)
      submission.sagaStep = SagaStep.DONE;

      // 트랜잭션으로 save를 원자적으로 처리
      const qr = this.dataSource.createQueryRunner();
      await qr.connect();
      await qr.startTransaction();
      try {
        const updated = await qr.manager.save(Submission, submission);
        await qr.commitTransaction();

        // 통계 캐시 무효화 — AI 분석 완료로 통계 변경
        await this.statsCache.invalidate(submission.studyId);

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
  async getStudyStats(studyId: string, weekNumber?: string, userId?: string, activeProblemIds?: string[]): Promise<StudyStatsResult> {
    // activeProblemIds가 빈 배열이면 ACTIVE 문제가 없으므로 즉시 빈 결과 반환 (캐시 전 — Critic P2)
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

    // Cache-Aside: 캐시 조회 (activeProblemIds fingerprint 포함)
    const cached = await this.statsCache.get(studyId, weekNumber, userId, activeProblemIds);
    if (cached !== null) return cached as StudyStatsResult;

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

    const result = { totalSubmissions, uniqueSubmissions: Number(uniqueSubmissions), uniqueAnalyzed: Number(uniqueAnalyzed), byWeek, byWeekPerUser, byMember, byMemberWeek, recentSubmissions, solvedProblemIds, userSubmissions, submitterCountByProblem };

    // Cache-Aside: 집계 결과 캐싱 (activeProblemIds fingerprint 포함)
    await this.statsCache.set(studyId, result, weekNumber, userId, activeProblemIds);

    return result;
  }

  /**
   * A3: 마감 시간 체크 + weekNumber 조회 — ProblemServiceClient 위임 (CB 보호).
   *
   * deadline이 지났으면 isLate=true, 아직이면 false. weekNumber: Problem에 설정된 주차 정보.
   * client 내부에서 CB OPEN/조회 실패 시 fallback `{isLate: false, weekNumber: null}` 반환 →
   * 제출 차단하지 않음 (graceful degradation 유지).
   *
   * @domain submission
   * @guard problem-deadline
   */
  private async checkLateSubmission(
    studyId: string,
    problemId: string,
    userId?: string,
  ): Promise<{ isLate: boolean; weekNumber: string | null }> {
    return this.problemClient.getDeadline(problemId, studyId, userId);
  }

  // ── AI 만족도 ──────────────────────────────────────────

  /**
   * AI 만족도 등록/수정 (UPSERT)
   * 동일 submissionId+userId 조합이 이미 있으면 rating/comment 업데이트
   *
   * IDOR 방지: studyId 검증 — 요청자의 x-study-id에 속하지 않는 제출에 대한
   * 만족도 쓰기를 차단합니다.
   */
  async rateSatisfaction(
    submissionId: string,
    userId: string,
    studyId: string,
    dto: CreateAiSatisfactionDto,
  ): Promise<AiSatisfaction> {
    // 제출 존재 여부 확인
    const submission = await this.findById(submissionId);

    // IDOR 방지: 요청한 스터디의 제출인지 검증
    if (submission.studyId !== studyId) {
      throw new ForbiddenException('다른 스터디의 제출에 접근할 수 없습니다.');
    }

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
