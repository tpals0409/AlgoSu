/**
 * @file 피드백 서비스 — CRUD + 스크린샷 정리
 * @domain identity
 * @layer service
 * @related feedback.controller.ts, feedback.entity.ts
 */
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { Feedback, FeedbackStatus } from './feedback.entity';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';

/** 허용된 상태 전이 맵 — 역전이 차단 */
const ALLOWED_TRANSITIONS: Record<FeedbackStatus, FeedbackStatus[]> = {
  [FeedbackStatus.OPEN]: [FeedbackStatus.IN_PROGRESS, FeedbackStatus.CLOSED],
  [FeedbackStatus.IN_PROGRESS]: [FeedbackStatus.RESOLVED, FeedbackStatus.OPEN, FeedbackStatus.CLOSED],
  [FeedbackStatus.RESOLVED]: [FeedbackStatus.CLOSED],
  [FeedbackStatus.CLOSED]: [],
};

@Injectable()
export class FeedbackService {
  constructor(
    @InjectRepository(Feedback)
    private readonly feedbackRepo: Repository<Feedback>,
    private readonly logger: StructuredLoggerService,
  ) {
    this.logger.setContext(FeedbackService.name);
  }

  /**
   * 피드백 생성
   * @param dto - 피드백 생성 파라미터
   * @returns 생성된 피드백 엔티티
   */
  async create(dto: CreateFeedbackDto): Promise<Feedback> {
    const feedback = this.feedbackRepo.create({
      userId: dto.userId,
      category: dto.category,
      content: dto.content,
      pageUrl: dto.pageUrl ?? null,
      browserInfo: dto.browserInfo ?? null,
      screenshot: dto.screenshot ?? null,
    });
    const saved = await this.feedbackRepo.save(feedback);
    this.logger.log(
      `피드백 생성: userId=${dto.userId}, category=${dto.category}, publicId=${saved.publicId}`,
    );
    return saved;
  }

  /**
   * 사용자별 피드백 목록 조회 (최신순, 최대 50개)
   * @param userId - 대상 사용자 ID
   */
  async findByUserId(userId: string): Promise<Feedback[]> {
    return this.feedbackRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  /**
   * 전체 피드백 목록 조회 (admin용, 페이지네이션 + 필터)
   * @param page - 페이지 번호 (1-based, 기본 1)
   * @param limit - 페이지당 항목 수 (기본 20, 최대 100)
   * @param category - 카테고리 필터 (optional)
   * @param search - 내용 검색 키워드 (optional)
   */
  async findAll(
    page = 1,
    limit = 20,
    category?: string,
    search?: string,
  ): Promise<{ items: Feedback[]; total: number }> {
    const take = Math.min(limit, 100);
    const skip = (Math.max(page, 1) - 1) * take;

    const qb = this.feedbackRepo
      .createQueryBuilder('f')
      .orderBy('f.created_at', 'DESC')
      .take(take)
      .skip(skip);

    if (category) {
      qb.andWhere('f.category = :category', { category });
    }

    if (search) {
      qb.andWhere('f.content ILIKE :search', { search: `%${search}%` });
    }

    const [items, total] = await qb.getManyAndCount();

    return { items, total };
  }

  /**
   * 피드백 단건 조회 (screenshot 포함)
   * @param publicId - 피드백 publicId
   */
  async findByPublicId(publicId: string): Promise<Record<string, unknown>> {
    const feedback = await this.feedbackRepo.findOne({
      where: { publicId },
    });

    if (!feedback) {
      throw new NotFoundException('피드백을 찾을 수 없습니다.');
    }

    // toJSON()이 screenshot을 제외하므로 수동으로 모든 필드 포함
    const { id, ...rest } = feedback as unknown as Record<string, unknown>;
    return rest;
  }

  /**
   * 피드백 상태 변경
   * @param publicId - 피드백 publicId
   * @param status - 변경할 상태
   */
  async updateStatus(publicId: string, status: FeedbackStatus): Promise<Feedback> {
    const feedback = await this.feedbackRepo.findOne({
      where: { publicId },
    });

    if (!feedback) {
      throw new NotFoundException('피드백을 찾을 수 없습니다.');
    }

    const allowed = ALLOWED_TRANSITIONS[feedback.status];
    if (!allowed.includes(status)) {
      throw new BadRequestException(
        `상태 전이 불가: ${feedback.status} → ${status}`,
      );
    }

    feedback.status = status;

    if (status === FeedbackStatus.RESOLVED) {
      feedback.resolvedAt = new Date();
    }

    const saved = await this.feedbackRepo.save(feedback);
    this.logger.log(
      `피드백 상태 변경: publicId=${publicId}, status=${status}`,
    );
    return saved;
  }

  /**
   * 30일 경과 스크린샷 null 처리 — 매일 03:00 자동 실행
   * @returns 처리된 건수
   */
  @Cron('0 0 3 * * *')
  async deleteOldScreenshots(): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    const result = await this.feedbackRepo
      .createQueryBuilder()
      .update(Feedback)
      .set({ screenshot: null })
      .where('screenshot IS NOT NULL')
      .andWhere('created_at < :cutoff', { cutoff })
      .execute();

    const count = result.affected ?? 0;
    if (count > 0) {
      this.logger.log(`오래된 스크린샷 ${count}건 정리 (30일 경과)`);
    }
    return count;
  }
}
