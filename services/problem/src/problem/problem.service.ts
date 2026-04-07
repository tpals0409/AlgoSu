/**
 * @file Problem 서비스 — 문제 CRUD + 마감 시간 캐시 연동
 * @domain problem
 * @layer service
 * @related problem.controller.ts, problem.entity.ts, deadline-cache.service.ts
 */
import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { DataSource, In, LessThanOrEqual, Not } from 'typeorm';
import { Problem, ProblemStatus } from './problem.entity';
import { CreateProblemDto, UpdateProblemDto } from './dto/create-problem.dto';
import { DeadlineCacheService } from '../cache/deadline-cache.service';
import { DualWriteService } from '../database/dual-write.service';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';

/**
 * 허용된 상태 전이 맵 — 현재 상태 → 전이 가능한 상태 목록
 * DRAFT → ACTIVE
 * ACTIVE → CLOSED, DELETED
 * CLOSED → ACTIVE (재개), DELETED
 * DELETED → (전이 불가)
 */
const ALLOWED_STATUS_TRANSITIONS: Record<ProblemStatus, ProblemStatus[]> = {
  [ProblemStatus.DRAFT]: [ProblemStatus.ACTIVE],
  [ProblemStatus.ACTIVE]: [ProblemStatus.CLOSED, ProblemStatus.DELETED],
  [ProblemStatus.CLOSED]: [ProblemStatus.ACTIVE, ProblemStatus.DELETED],
  [ProblemStatus.DELETED]: [],
};

@Injectable()
export class ProblemService {
  constructor(
    private readonly dualWrite: DualWriteService,
    private readonly deadlineCache: DeadlineCacheService,
    private readonly logger: StructuredLoggerService,
    private readonly dataSource: DataSource,
  ) {
    this.logger.setContext(ProblemService.name);
  }

  /**
   * 문제 생성 — ADMIN 권한 필수 (컨트롤러에서 studyRole 체크)
   * studyId는 헤더에서 받아 컨트롤러가 전달
   */
  async create(dto: CreateProblemDto, studyId: string, createdBy: string): Promise<Problem> {
    // 같은 스터디 + 같은 주차에서 sourceUrl 중복 체크
    if (dto.sourceUrl) {
      const existing = await this.dualWrite.findOne({
        where: { studyId, weekNumber: dto.weekNumber, sourceUrl: dto.sourceUrl, status: ProblemStatus.ACTIVE },
      });
      if (existing) {
        throw new ConflictException('같은 주차에 이미 등록된 문제입니다.');
      }
    }

    const saved = await this.dualWrite.save({
      title: dto.title,
      description: dto.description ?? null,
      weekNumber: dto.weekNumber,
      difficulty: dto.difficulty ?? null,
      level: dto.level ?? null,
      sourceUrl: dto.sourceUrl ?? null,
      sourcePlatform: dto.sourcePlatform ?? null,
      deadline: dto.deadline ? new Date(dto.deadline) : null,
      allowedLanguages: dto.allowedLanguages ?? null,
      tags: dto.tags ?? null,
      status: ProblemStatus.ACTIVE,
      studyId,
      createdBy,
    });
    this.logger.log(`문제 생성: id=${saved.id}, studyId=${studyId}, week=${saved.weekNumber}`);

    // 캐시 설정
    await this.deadlineCache.setDeadline(studyId, saved.id, saved.deadline);
    await this.deadlineCache.invalidateWeekProblems(studyId, saved.weekNumber);

    return saved;
  }

  /**
   * 문제 단건 조회 (외부 API용) — DELETED 상태 제외, studyId 스코핑
   */
  async findById(studyId: string, id: string): Promise<Problem> {
    const problem = await this.dualWrite.findOne({
      where: { id, studyId, status: Not(ProblemStatus.DELETED) },
    });
    if (!problem) {
      throw new NotFoundException(`문제를 찾을 수 없습니다: id=${id}`);
    }
    return problem;
  }

  /**
   * 문제 단건 조회 (내부용) — DELETED 포함 전체 상태 조회, studyId 스코핑
   * Submission 연동, 마감 시간 조회 등 내부 서비스에서 사용
   */
  async findByIdInternal(studyId: string, id: string): Promise<Problem> {
    const problem = await this.dualWrite.findOne({ where: { id, studyId } });
    if (!problem) {
      throw new NotFoundException(`문제를 찾을 수 없습니다: id=${id}`);
    }
    return problem;
  }

  /**
   * 주차별 문제 목록 — studyId 스코핑
   */
  async findByWeekAndStudy(studyId: string, weekNumber: string): Promise<Problem[]> {
    // 캐시 확인
    const cached = await this.deadlineCache.getWeekProblems(studyId, weekNumber);
    if (cached) {
      return JSON.parse(cached) as Problem[];
    }

    const problems = await this.dualWrite.find({
      where: { weekNumber, studyId, status: ProblemStatus.ACTIVE },
      order: { createdAt: 'ASC' },
    });

    // 캐시 저장
    await this.deadlineCache.setWeekProblems(studyId, weekNumber, JSON.stringify(problems));
    return problems;
  }

  /**
   * 마감 시간 조회 (Submission Service 내부 HTTP 연동용)
   * studyId 컨텍스트 포함 — 캐시 우선 → DB fallback
   */
  async getDeadline(
    studyId: string,
    problemId: string,
  ): Promise<{ deadline: string | null; weekNumber: string | null; status: string }> {
    // 캐시 우선 — weekNumber는 캐시에 없으므로 DB fallback 필요
    const cached = await this.deadlineCache.getDeadline(studyId, problemId);
    if (cached !== null) {
      // weekNumber 조회를 위해 DB에서 problem을 가져옴 (내부용 — DELETED 포함)
      const problem = await this.findByIdInternal(studyId, problemId);
      return {
        deadline: cached === 'null' ? null : cached,
        weekNumber: problem.weekNumber ?? null,
        status: 'cache_hit',
      };
    }

    // DB fallback — studyId 스코핑으로 cross-study 접근 차단 (내부용 — DELETED 포함)
    const problem = await this.findByIdInternal(studyId, problemId);
    await this.deadlineCache.setDeadline(studyId, problem.id, problem.deadline);

    return {
      deadline: problem.deadline ? problem.deadline.toISOString() : null,
      weekNumber: problem.weekNumber ?? null,
      status: 'db_hit',
    };
  }

  /**
   * 문제 수정 — studyId 스코핑
   * QueryRunner 트랜잭션 + FOR UPDATE 비관적 락으로 Lost Update 방지
   * 캐시 무효화는 트랜잭션 커밋 후 실행
   */
  async update(studyId: string, id: string, dto: UpdateProblemDto): Promise<Problem> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      // FOR UPDATE 비관적 락으로 동시 수정 방지
      const problem = await qr.manager.findOne(Problem, {
        where: { id, studyId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!problem) {
        throw new NotFoundException(`문제를 찾을 수 없습니다: id=${id}`);
      }

      // M7: weekNumber 변경 감지용 — 변경 전 값 보존
      const oldWeekNumber = problem.weekNumber;

      if (dto.title !== undefined) problem.title = dto.title;
      if (dto.description !== undefined) problem.description = dto.description;
      if (dto.weekNumber !== undefined) problem.weekNumber = dto.weekNumber;
      if (dto.difficulty !== undefined) problem.difficulty = dto.difficulty;
      if (dto.level !== undefined) problem.level = dto.level;
      if (dto.sourceUrl !== undefined) problem.sourceUrl = dto.sourceUrl;
      if (dto.sourcePlatform !== undefined) problem.sourcePlatform = dto.sourcePlatform;
      if (dto.deadline !== undefined) problem.deadline = dto.deadline ? new Date(dto.deadline) : null;
      if (dto.allowedLanguages !== undefined) {
        problem.allowedLanguages = dto.allowedLanguages ?? null;
      }
      if (dto.tags !== undefined) {
        problem.tags = dto.tags ?? null;
      }
      if (dto.status !== undefined) {
        const newStatus = dto.status as ProblemStatus;
        const allowed = ALLOWED_STATUS_TRANSITIONS[problem.status];
        if (!allowed || !allowed.includes(newStatus)) {
          throw new BadRequestException(
            `상태 전이 불가: ${problem.status} → ${newStatus}`,
          );
        }
        problem.status = newStatus;
      }

      const saved = await qr.manager.save(Problem, problem);
      await qr.commitTransaction();

      // 캐시 무효화 — 트랜잭션 커밋 후 실행
      await this.deadlineCache.invalidateDeadline(studyId, saved.id);
      await this.deadlineCache.invalidateWeekProblems(studyId, saved.weekNumber);

      // M7: weekNumber 변경 시 구 주차 캐시도 무효화
      if (dto.weekNumber !== undefined && dto.weekNumber !== oldWeekNumber) {
        await this.deadlineCache.invalidateWeekProblems(studyId, oldWeekNumber);
      }

      // Dual Write — 트랜잭션 커밋 후 비동기 쓰기
      if (this.dualWrite.isActive) {
        void this.dualWrite.saveExisting(saved);
      }

      this.logger.log(`문제 수정: id=${saved.id}, studyId=${studyId}`);
      return saved;
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  /**
   * M6: 문제 삭제 (soft delete) — ADMIN 권한 필수
   * status를 DELETED로 변경. Submission 참조 무결성 유지.
   * QueryRunner 트랜잭션 + FOR UPDATE 비관적 락으로 동시 삭제/수정 충돌 방지
   */
  async delete(studyId: string, id: string): Promise<void> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      // FOR UPDATE 비관적 락으로 동시 수정 방지
      const problem = await qr.manager.findOne(Problem, {
        where: { id, studyId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!problem) {
        throw new NotFoundException(`문제를 찾을 수 없습니다: id=${id}`);
      }

      const allowed = ALLOWED_STATUS_TRANSITIONS[problem.status];
      if (!allowed || !allowed.includes(ProblemStatus.DELETED)) {
        throw new BadRequestException(
          `상태 전이 불가: ${problem.status} → ${ProblemStatus.DELETED}`,
        );
      }

      problem.status = ProblemStatus.DELETED;
      await qr.manager.save(Problem, problem);
      await qr.commitTransaction();

      // 캐시 무효화 — 트랜잭션 커밋 후 실행
      await this.deadlineCache.invalidateDeadline(studyId, id);
      await this.deadlineCache.invalidateWeekProblems(studyId, problem.weekNumber);

      // Dual Write — 트랜잭션 커밋 후 비동기 쓰기
      if (this.dualWrite.isActive) {
        void this.dualWrite.saveExisting(problem);
      }

      this.logger.log(`문제 soft delete: id=${id}, studyId=${studyId}`);
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  /**
   * 활성 문제 목록 — studyId 스코핑
   */
  async findActiveByStudy(studyId: string): Promise<Problem[]> {
    const problems = await this.dualWrite.find({
      where: { status: ProblemStatus.ACTIVE, studyId },
      order: { weekNumber: 'DESC', createdAt: 'ASC' },
    });
    return problems;
  }

  /**
   * 전체 문제 목록 (ACTIVE + CLOSED) — studyId 스코핑
   */
  async findAllByStudy(studyId: string): Promise<Problem[]> {
    const problems = await this.dualWrite.find({
      where: { studyId, status: In([ProblemStatus.ACTIVE, ProblemStatus.CLOSED]) },
      order: { weekNumber: 'ASC', createdAt: 'ASC' },
    });
    return problems;
  }

  /**
   * 만료된 ACTIVE 문제를 CLOSED로 일괄 전환 — DeadlineSchedulerService에서 호출
   * 조건: status=ACTIVE AND deadline IS NOT NULL AND deadline <= NOW()
   * 캐시 무효화: 각 문제의 deadline + weekProblems 캐시 무효화
   * @returns 전환 건수 + 영향받은 문제 정보 (로깅/모니터링용)
   */
  async closeExpiredProblems(): Promise<{
    count: number;
    affected: Array<{ id: string; studyId: string; weekNumber: string }>;
  }> {
    const now = new Date();

    const expiredProblems = await this.dualWrite.find({
      where: {
        status: ProblemStatus.ACTIVE,
        deadline: LessThanOrEqual(now),
      },
    });

    if (expiredProblems.length === 0) {
      return { count: 0, affected: [] };
    }

    const affected: Array<{ id: string; studyId: string; weekNumber: string }> = [];

    for (const problem of expiredProblems) {
      problem.status = ProblemStatus.CLOSED;
      await this.dualWrite.saveExisting(problem);

      // 캐시 무효화 — deadline 캐시 + 주차별 목록 캐시
      await this.deadlineCache.invalidateDeadline(problem.studyId, problem.id);
      await this.deadlineCache.invalidateWeekProblems(problem.studyId, problem.weekNumber);

      affected.push({
        id: problem.id,
        studyId: problem.studyId,
        weekNumber: problem.weekNumber,
      });
    }

    this.logger.log(
      `만료 문제 일괄 종료 완료: ${affected.length}건`,
      { affected },
    );

    return { count: affected.length, affected };
  }
}
