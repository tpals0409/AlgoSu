/**
 * @file Draft(임시저장) 서비스 — UPSERT + 조회 + 삭제
 * @domain submission
 * @layer service
 * @related Draft, CreateSubmissionDto
 */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Draft } from './draft.entity';
import { UpsertDraftDto } from '../submission/dto/create-submission.dto';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';

/**
 * Draft(임시저장) 서비스
 *
 * UPSERT 전략: (study_id, user_id, problem_id) UNIQUE 제약 기반
 * - 스터디+문제당 사용자 1개 초안만 유지
 * - 정식 제출 시 Draft 삭제
 * - 7일 이상 된 Draft 자동 삭제 (Cron — Day 7 구현)
 */
@Injectable()
export class DraftService {
  private readonly logger: StructuredLoggerService;

  constructor(
    @InjectRepository(Draft)
    private readonly draftRepo: Repository<Draft>,
  ) {
    this.logger = new StructuredLoggerService();
    this.logger.setContext(DraftService.name);
  }

  /**
   * Draft UPSERT — localStorage 30초마다 호출
   */
  async upsert(dto: UpsertDraftDto, userId: string, studyId: string): Promise<Draft> {
    const existing = await this.draftRepo.findOne({
      where: { studyId, userId, problemId: dto.problemId },
    });

    if (existing) {
      // 업데이트
      if (dto.language !== undefined) existing.language = dto.language;
      if (dto.code !== undefined) existing.code = dto.code;
      existing.savedAt = new Date();
      const saved = await this.draftRepo.save(existing);
      this.logger.debug(`Draft 업데이트: studyId=${studyId}, userId=${userId}, problemId=${dto.problemId}`);
      return saved;
    }

    // 신규 생성
    const draft = this.draftRepo.create({
      studyId,
      userId,
      problemId: dto.problemId,
      language: dto.language ?? null,
      code: dto.code ?? null,
      savedAt: new Date(),
    });

    const saved = await this.draftRepo.save(draft);
    this.logger.debug(`Draft 생성: studyId=${studyId}, userId=${userId}, problemId=${dto.problemId}`);
    return saved;
  }

  /**
   * Draft 조회 (스터디+문제별)
   */
  async findByProblem(studyId: string, userId: string, problemId: string): Promise<Draft | null> {
    return this.draftRepo.findOne({
      where: { studyId, userId, problemId },
    });
  }

  /**
   * Draft 삭제 (정식 제출 시)
   */
  async deleteByProblem(studyId: string, userId: string, problemId: string): Promise<void> {
    await this.draftRepo.delete({ studyId, userId, problemId });
    this.logger.debug(`Draft 삭제: studyId=${studyId}, userId=${userId}, problemId=${problemId}`);
  }

  // ─── CRON ─────────────────────────────────

  /** 7일 경과 Draft 자동 삭제 Cron — 최종 수정 기준 */
  private static readonly DRAFT_MAX_AGE_DAYS = 7;

  /**
   * 7일 이상 미수정 Draft 자동 삭제 — 매일 새벽 4시 실행
   * @domain submission
   */
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async cleanupStaleDrafts(): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - DraftService.DRAFT_MAX_AGE_DAYS);

    const { affected } = await this.draftRepo.delete({
      updatedAt: LessThan(cutoff),
    });

    if (affected && affected > 0) {
      this.logger.log(
        `만료 Draft ${affected}건 삭제 (${DraftService.DRAFT_MAX_AGE_DAYS}일 경과)`,
      );
    }
  }
}
