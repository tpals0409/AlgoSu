/**
 * @file 코드리뷰 서비스 — Review Comment + Reply CRUD (soft-delete)
 * @domain review
 * @layer service
 * @related ReviewComment, ReviewReply, Submission
 */
import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReviewComment } from './review-comment.entity';
import { ReviewReply } from './review-reply.entity';
import { Submission } from '../submission/submission.entity';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { CreateReplyDto } from './dto/create-reply.dto';
import { UpdateReplyDto } from './dto/update-reply.dto';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';

@Injectable()
export class ReviewService {
  private readonly logger: StructuredLoggerService;

  constructor(
    @InjectRepository(ReviewComment)
    private readonly commentRepo: Repository<ReviewComment>,
    @InjectRepository(ReviewReply)
    private readonly replyRepo: Repository<ReviewReply>,
    @InjectRepository(Submission)
    private readonly submissionRepo: Repository<Submission>,
    logger: StructuredLoggerService,
  ) {
    this.logger = logger;
    this.logger.setContext(ReviewService.name);
  }

  // ─── COMMENT CRUD ──────────────────────────

  /**
   * 댓글 작성 — authorId=userId, studyId IDOR 검증
   * @domain review
   * @guard study-member
   */
  async createComment(
    dto: CreateCommentDto,
    userId: string,
    studyId: string,
  ): Promise<ReviewComment> {
    const submission = await this.submissionRepo.findOne({
      where: { id: dto.submissionId },
    });
    if (!submission) {
      throw new NotFoundException('제출을 찾을 수 없습니다.');
    }
    if (submission.studyId !== studyId) {
      throw new ForbiddenException(
        '해당 스터디의 제출이 아닙니다.',
      );
    }

    const comment = new ReviewComment();
    comment.submissionId = dto.submissionId;
    comment.authorId = userId;
    comment.studyId = studyId;
    comment.lineNumber = dto.lineNumber ?? null;
    comment.content = dto.content;

    const saved = await this.commentRepo.save(comment);
    this.logger.log(
      `댓글 작성: commentId=${saved.publicId}, submissionId=${dto.submissionId}`,
    );
    return saved;
  }

  /**
   * 제출별 댓글 목록 — deletedAt IS NULL (soft-delete 필터)
   * @domain review
   */
  async findCommentsBySubmission(
    submissionId: string,
    studyId: string,
  ): Promise<ReviewComment[]> {
    return this.commentRepo.find({
      where: { submissionId, studyId },
      relations: ['replies'],
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * 댓글 수정 — 본인만 가능 (IDOR 방어)
   * @domain review
   * @guard submission-owner
   */
  async updateComment(
    publicId: string,
    dto: UpdateCommentDto,
    userId: string,
  ): Promise<ReviewComment> {
    const comment = await this.commentRepo.findOne({ where: { publicId } });
    if (!comment) {
      throw new NotFoundException('댓글을 찾을 수 없습니다.');
    }
    if (comment.authorId !== userId) {
      throw new ForbiddenException('본인의 댓글만 수정할 수 있습니다.');
    }

    comment.content = dto.content;
    const updated = await this.commentRepo.save(comment);
    this.logger.log(`댓글 수정: commentPublicId=${publicId}`);
    return updated;
  }

  /**
   * 댓글 soft-delete — 본인만 가능, @DeleteDateColumn 사용
   * @domain review
   * @guard submission-owner
   */
  async deleteComment(publicId: string, userId: string): Promise<void> {
    const comment = await this.commentRepo.findOne({ where: { publicId } });
    if (!comment) {
      throw new NotFoundException('댓글을 찾을 수 없습니다.');
    }
    if (comment.authorId !== userId) {
      throw new ForbiddenException('본인의 댓글만 삭제할 수 있습니다.');
    }

    await this.commentRepo.softDelete(comment.id);
    this.logger.log(`댓글 삭제(soft): commentPublicId=${publicId}`);
  }

  // ─── REPLY CRUD ────────────────────────────

  /**
   * 대댓글 작성 — commentId 참조
   * @domain review
   * @guard study-member
   */
  async createReply(
    dto: CreateReplyDto,
    userId: string,
    studyId: string,
  ): Promise<ReviewReply> {
    const comment = await this.commentRepo.findOne({
      where: { publicId: dto.commentPublicId },
    });
    if (!comment) {
      throw new NotFoundException('원본 댓글을 찾을 수 없습니다.');
    }

    const submission = await this.submissionRepo.findOne({
      where: { id: comment.submissionId },
    });
    if (!submission) {
      throw new NotFoundException('제출을 찾을 수 없습니다.');
    }
    if (submission.studyId !== studyId) {
      throw new ForbiddenException(
        '해당 스터디의 제출이 아닙니다.',
      );
    }

    const reply = new ReviewReply();
    reply.commentId = comment.id;
    reply.authorId = userId;
    reply.content = dto.content;

    const saved = await this.replyRepo.save(reply);
    this.logger.log(
      `답글 작성: replyId=${saved.publicId}, commentPublicId=${dto.commentPublicId}`,
    );
    return saved;
  }

  /**
   * 댓글별 대댓글 목록 — deletedAt IS NULL (soft-delete 필터)
   * @domain review
   */
  async findRepliesByCommentPublicId(commentPublicId: string): Promise<ReviewReply[]> {
    const comment = await this.commentRepo.findOne({
      where: { publicId: commentPublicId },
    });
    if (!comment) {
      throw new NotFoundException('댓글을 찾을 수 없습니다.');
    }
    return this.replyRepo.find({
      where: { commentId: comment.id },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * 답글 수정 — 본인만 가능 (IDOR 방어)
   * @domain review
   * @guard submission-owner
   */
  async updateReply(
    publicId: string,
    dto: UpdateReplyDto,
    userId: string,
  ): Promise<ReviewReply> {
    const reply = await this.replyRepo.findOne({ where: { publicId } });
    if (!reply) {
      throw new NotFoundException('답글을 찾을 수 없습니다.');
    }
    if (reply.authorId !== userId) {
      throw new ForbiddenException('본인의 답글만 수정할 수 있습니다.');
    }

    reply.content = dto.content;
    const updated = await this.replyRepo.save(reply);
    this.logger.log(`답글 수정: replyPublicId=${publicId}`);
    return updated;
  }

  /**
   * 답글 soft-delete — 본인만 가능, @DeleteDateColumn 사용
   * @domain review
   * @guard submission-owner
   */
  async deleteReply(publicId: string, userId: string): Promise<void> {
    const reply = await this.replyRepo.findOne({ where: { publicId } });
    if (!reply) {
      throw new NotFoundException('답글을 찾을 수 없습니다.');
    }
    if (reply.authorId !== userId) {
      throw new ForbiddenException('본인의 답글만 삭제할 수 있습니다.');
    }

    await this.replyRepo.softDelete(reply.id);
    this.logger.log(`답글 삭제(soft): replyPublicId=${publicId}`);
  }
}
