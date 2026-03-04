/**
 * @file 코드리뷰 컨트롤러 — Comment + Reply CRUD 엔드포인트
 * @domain review
 * @layer controller
 * @related ReviewService, InternalKeyGuard, StudyMemberGuard
 */
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Headers,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ReviewService } from './review.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { CreateReplyDto } from './dto/create-reply.dto';
import { UpdateReplyDto } from './dto/update-reply.dto';
import { InternalKeyGuard } from '../common/guards/internal-key.guard';
import { StudyMemberGuard } from '../common/guards/study-member.guard';

@Controller('review')
@UseGuards(InternalKeyGuard, StudyMemberGuard)
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  // ─── COMMENTS ──────────────────────────────

  /**
   * POST /review/comments — 댓글 작성
   * @api POST /review/comments
   * @guard study-member
   */
  @Post('comments')
  async createComment(
    @Body() dto: CreateCommentDto,
    @Headers('x-user-id') userId: string,
    @Headers('x-study-id') studyId: string,
  ) {
    const comment = await this.reviewService.createComment(dto, userId, studyId);
    return { data: comment };
  }

  /**
   * GET /review/comments — 제출별 댓글 목록
   * @api GET /review/comments
   * @guard study-member
   */
  @Get('comments')
  async findComments(
    @Query('submissionId', ParseUUIDPipe) submissionId: string,
    @Headers('x-study-id') studyId: string,
  ) {
    const comments = await this.reviewService.findCommentsBySubmission(
      submissionId,
      studyId,
    );
    return { data: comments };
  }

  /**
   * PATCH /review/comments/:id — 댓글 수정 (본인만)
   * @api PATCH /review/comments/:id
   * @guard study-member, submission-owner
   */
  @Patch('comments/:publicId')
  async updateComment(
    @Param('publicId', ParseUUIDPipe) publicId: string,
    @Body() dto: UpdateCommentDto,
    @Headers('x-user-id') userId: string,
  ) {
    const comment = await this.reviewService.updateComment(publicId, dto, userId);
    return { data: comment };
  }

  /**
   * DELETE /review/comments/:id — 댓글 soft-delete (본인만)
   * @api DELETE /review/comments/:id
   * @guard study-member, submission-owner
   */
  @Delete('comments/:publicId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteComment(
    @Param('publicId', ParseUUIDPipe) publicId: string,
    @Headers('x-user-id') userId: string,
  ): Promise<void> {
    await this.reviewService.deleteComment(publicId, userId);
  }

  // ─── REPLIES ───────────────────────────────

  /**
   * POST /review/replies — 대댓글 작성
   * @api POST /review/replies
   * @guard study-member
   */
  @Post('replies')
  async createReply(
    @Body() dto: CreateReplyDto,
    @Headers('x-user-id') userId: string,
  ) {
    const reply = await this.reviewService.createReply(dto, userId);
    return { data: reply };
  }

  /**
   * GET /review/replies — 댓글별 대댓글 목록
   * @api GET /review/replies
   * @guard study-member
   */
  @Get('replies')
  async findReplies(
    @Query('commentPublicId', ParseUUIDPipe) commentPublicId: string,
  ) {
    const replies = await this.reviewService.findRepliesByCommentPublicId(commentPublicId);
    return { data: replies };
  }

  /**
   * PATCH /review/replies/:publicId — 답글 수정 (본인만)
   * @api PATCH /review/replies/:publicId
   * @guard study-member, submission-owner
   */
  @Patch('replies/:publicId')
  async updateReply(
    @Param('publicId', ParseUUIDPipe) publicId: string,
    @Body() dto: UpdateReplyDto,
    @Headers('x-user-id') userId: string,
  ) {
    const reply = await this.reviewService.updateReply(publicId, dto, userId);
    return { data: reply };
  }

  /**
   * DELETE /review/replies/:publicId — 답글 soft-delete (본인만)
   * @api DELETE /review/replies/:publicId
   * @guard study-member, submission-owner
   */
  @Delete('replies/:publicId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteReply(
    @Param('publicId', ParseUUIDPipe) publicId: string,
    @Headers('x-user-id') userId: string,
  ): Promise<void> {
    await this.reviewService.deleteReply(publicId, userId);
  }
}
