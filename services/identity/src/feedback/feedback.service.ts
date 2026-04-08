/**
 * @file 피드백 서비스 — CRUD + 스크린샷 정리
 * @domain identity
 * @layer service
 * @related feedback.controller.ts, feedback.entity.ts
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Feedback, FeedbackStatus } from './feedback.entity';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';

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
   * 전체 피드백 목록 조회 (admin용, 페이지네이션)
   * @param page - 페이지 번호 (1-based, 기본 1)
   * @param limit - 페이지당 항목 수 (기본 20, 최대 100)
   */
  async findAll(
    page = 1,
    limit = 20,
  ): Promise<{ items: Feedback[]; total: number }> {
    const take = Math.min(limit, 100);
    const skip = (Math.max(page, 1) - 1) * take;

    const [items, total] = await this.feedbackRepo.findAndCount({
      order: { createdAt: 'DESC' },
      take,
      skip,
    });

    return { items, total };
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
   * 30일 경과 스크린샷 null 처리 (Cron용)
   * @returns 처리된 건수
   */
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
