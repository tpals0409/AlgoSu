import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { Problem, ProblemStatus } from './problem.entity';
import { CreateProblemDto, UpdateProblemDto } from './dto/create-problem.dto';
import { DeadlineCacheService } from '../cache/deadline-cache.service';
import { DualWriteService } from '../database/dual-write.service';

@Injectable()
export class ProblemService {
  private readonly logger = new Logger(ProblemService.name);

  constructor(
    private readonly dualWrite: DualWriteService,
    private readonly deadlineCache: DeadlineCacheService,
  ) {}

  /**
   * 문제 생성 — ADMIN 권한 필수 (컨트롤러에서 studyRole 체크)
   * studyId는 헤더에서 받아 컨트롤러가 전달
   */
  async create(dto: CreateProblemDto, studyId: string, createdBy: string): Promise<Problem> {
    const saved = await this.dualWrite.save({
      title: dto.title,
      description: dto.description ?? null,
      weekNumber: dto.weekNumber,
      difficulty: dto.difficulty ?? null,
      sourceUrl: dto.sourceUrl ?? null,
      sourcePlatform: dto.sourcePlatform ?? null,
      deadline: dto.deadline ? new Date(dto.deadline) : null,
      allowedLanguages: dto.allowedLanguages ?? null,
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
   * 문제 단건 조회 — studyId 스코핑으로 cross-study 접근 차단
   */
  async findById(studyId: string, id: string): Promise<Problem> {
    const problem = await this.dualWrite.findOne({ where: { id, studyId } });
    if (!problem) {
      throw new NotFoundException(`문제를 찾을 수 없습니다: id=${id}`);
    }
    return problem;
  }

  /**
   * 주차별 문제 목록 — studyId 스코핑
   */
  async findByWeekAndStudy(studyId: string, weekNumber: number): Promise<Problem[]> {
    // 캐시 확인
    const cached = await this.deadlineCache.getWeekProblems(studyId, weekNumber);
    if (cached) {
      return JSON.parse(cached) as Problem[];
    }

    const problems = await this.dualWrite.find({
      where: { weekNumber, studyId },
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
  ): Promise<{ deadline: string | null; status: string }> {
    // 캐시 우선
    const cached = await this.deadlineCache.getDeadline(studyId, problemId);
    if (cached !== null) {
      return {
        deadline: cached === 'null' ? null : cached,
        status: 'cache_hit',
      };
    }

    // DB fallback — studyId 스코핑으로 cross-study 접근 차단
    const problem = await this.findById(studyId, problemId);
    await this.deadlineCache.setDeadline(studyId, problem.id, problem.deadline);

    return {
      deadline: problem.deadline ? problem.deadline.toISOString() : null,
      status: 'db_hit',
    };
  }

  /**
   * 문제 수정 — studyId 스코핑
   */
  async update(studyId: string, id: string, dto: UpdateProblemDto): Promise<Problem> {
    const problem = await this.findById(studyId, id);

    // M7: weekNumber 변경 감지용 — 변경 전 값 보존
    const oldWeekNumber = problem.weekNumber;

    if (dto.title !== undefined) problem.title = dto.title;
    if (dto.description !== undefined) problem.description = dto.description;
    if (dto.weekNumber !== undefined) problem.weekNumber = dto.weekNumber;
    if (dto.difficulty !== undefined) problem.difficulty = dto.difficulty;
    if (dto.sourceUrl !== undefined) problem.sourceUrl = dto.sourceUrl;
    if (dto.sourcePlatform !== undefined) problem.sourcePlatform = dto.sourcePlatform;
    if (dto.deadline !== undefined) problem.deadline = dto.deadline ? new Date(dto.deadline) : null;
    if (dto.allowedLanguages !== undefined) {
      problem.allowedLanguages = dto.allowedLanguages ?? null;
    }
    if (dto.status !== undefined) problem.status = dto.status as ProblemStatus;

    const saved = await this.dualWrite.saveExisting(problem);

    // 캐시 무효화
    await this.deadlineCache.invalidateDeadline(studyId, saved.id);
    await this.deadlineCache.invalidateWeekProblems(studyId, saved.weekNumber);

    // M7: weekNumber 변경 시 구 주차 캐시도 무효화
    if (dto.weekNumber !== undefined && dto.weekNumber !== oldWeekNumber) {
      await this.deadlineCache.invalidateWeekProblems(studyId, oldWeekNumber);
    }

    this.logger.log(`문제 수정: id=${saved.id}, studyId=${studyId}`);
    return saved;
  }

  /**
   * M6: 문제 삭제 (soft delete) — ADMIN 권한 필수
   * status를 CLOSED로 변경. Submission 참조 무결성 유지.
   */
  async delete(studyId: string, id: string): Promise<void> {
    const problem = await this.findById(studyId, id);
    problem.status = ProblemStatus.CLOSED;
    await this.dualWrite.saveExisting(problem);

    await this.deadlineCache.invalidateDeadline(studyId, id);
    await this.deadlineCache.invalidateWeekProblems(studyId, problem.weekNumber);

    this.logger.log(`문제 soft delete: id=${id}, studyId=${studyId}`);
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
}
