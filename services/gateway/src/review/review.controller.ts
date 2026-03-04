/**
 * @file 코드리뷰 프록시 컨트롤러 — Gateway → Submission Service
 * @domain review
 * @layer controller
 * @related ReviewService(Submission), InternalKeyGuard
 */
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Req,
  Logger,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  HttpException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@ApiTags('Review')
@Controller('api/reviews')
export class ReviewProxyController {
  private readonly logger = new Logger(ReviewProxyController.name);

  constructor(private readonly configService: ConfigService) {}

  // ─── COMMENTS ──────────────────────────────

  /**
   * POST /api/reviews/comments — 댓글 작성
   * @api POST /api/reviews/comments
   * @guard jwt-auth
   */
  @ApiOperation({ summary: '댓글 작성' })
  @ApiResponse({ status: 201, description: '댓글 생성 완료' })
  @Post('comments')
  async createComment(@Req() req: Request, @Body() body: unknown) {
    return this.proxyToSubmission(req, '/review/comments', 'POST', body);
  }

  /**
   * GET /api/reviews/comments — 제출별 댓글 목록
   * @api GET /api/reviews/comments
   * @guard jwt-auth
   */
  @ApiOperation({ summary: '제출별 댓글 목록 조회' })
  @ApiResponse({ status: 200, description: '댓글 목록' })
  @Get('comments')
  async findComments(@Req() req: Request) {
    const params = new URLSearchParams();
    const submissionId = req.query['submissionId'] as string | undefined;
    const studyId = req.query['studyId'] as string | undefined;
    if (submissionId) params.set('submissionId', submissionId);
    if (studyId) params.set('studyId', studyId);
    return this.proxyToSubmission(req, `/review/comments?${params.toString()}`, 'GET');
  }

  /**
   * PATCH /api/reviews/comments/:id — 댓글 수정
   * @api PATCH /api/reviews/comments/:id
   * @guard jwt-auth
   */
  @Patch('comments/:publicId')
  async updateComment(
    @Param('publicId', ParseUUIDPipe) publicId: string,
    @Req() req: Request,
    @Body() body: unknown,
  ) {
    return this.proxyToSubmission(req, `/review/comments/${publicId}`, 'PATCH', body);
  }

  /**
   * DELETE /api/reviews/comments/:id — 댓글 삭제
   * @api DELETE /api/reviews/comments/:id
   * @guard jwt-auth
   */
  @Delete('comments/:publicId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteComment(
    @Param('publicId', ParseUUIDPipe) publicId: string,
    @Req() req: Request,
  ): Promise<void> {
    await this.proxyToSubmission(req, `/review/comments/${publicId}`, 'DELETE');
  }

  // ─── REPLIES ───────────────────────────────

  /**
   * POST /api/reviews/replies — 대댓글 작성
   * @api POST /api/reviews/replies
   * @guard jwt-auth
   */
  @Post('replies')
  async createReply(@Req() req: Request, @Body() body: unknown) {
    return this.proxyToSubmission(req, '/review/replies', 'POST', body);
  }

  /**
   * GET /api/reviews/replies — 댓글별 대댓글 목록
   * @api GET /api/reviews/replies
   * @guard jwt-auth
   */
  @Get('replies')
  async findReplies(@Req() req: Request) {
    const params = new URLSearchParams();
    const commentPublicId = req.query['commentPublicId'] as string | undefined;
    if (commentPublicId) params.set('commentPublicId', commentPublicId);
    return this.proxyToSubmission(req, `/review/replies?${params.toString()}`, 'GET');
  }

  /**
   * PATCH /api/reviews/replies/:publicId — 답글 수정
   * @api PATCH /api/reviews/replies/:publicId
   * @guard jwt-auth
   */
  @Patch('replies/:publicId')
  async updateReply(
    @Param('publicId', ParseUUIDPipe) publicId: string,
    @Req() req: Request,
    @Body() body: unknown,
  ) {
    return this.proxyToSubmission(req, `/review/replies/${publicId}`, 'PATCH', body);
  }

  /**
   * DELETE /api/reviews/replies/:publicId — 답글 soft-delete
   * @api DELETE /api/reviews/replies/:publicId
   * @guard jwt-auth
   */
  @Delete('replies/:publicId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteReply(
    @Param('publicId', ParseUUIDPipe) publicId: string,
    @Req() req: Request,
  ): Promise<void> {
    await this.proxyToSubmission(req, `/review/replies/${publicId}`, 'DELETE');
  }

  // ─── PROXY HELPER ─────────────────────────

  /**
   * Submission Service로 프록시 요청
   * Internal Key + x-user-id + x-study-id 헤더 첨부
   */
  private async proxyToSubmission(
    req: Request,
    path: string,
    method: string,
    body?: unknown,
  ): Promise<unknown> {
    const submissionUrl = this.configService.getOrThrow<string>('SUBMISSION_SERVICE_URL');
    const internalKey = this.configService.getOrThrow<string>('INTERNAL_KEY_SUBMISSION');

    const userId = req.headers['x-user-id'] as string;
    const studyId = req.headers['x-study-id'] as string;

    const headers: Record<string, string> = {
      'x-internal-key': internalKey,
      'Content-Type': 'application/json',
    };
    if (userId) headers['x-user-id'] = userId;
    if (studyId) headers['x-study-id'] = studyId;

    const url = `${submissionUrl}${path}`;

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (response.status === 204) {
        return undefined;
      }

      const data: unknown = await response.json();

      if (!response.ok) {
        this.logger.warn(`Submission Service 응답 오류: ${response.status}, path=${path}`);
        const errorData = data as { message?: string; statusCode?: number };
        throw new HttpException(
          errorData.message ?? 'Internal service error',
          errorData.statusCode ?? response.status,
        );
      }

      return data;
    } catch (error: unknown) {
      this.logger.error(`Submission Service 프록시 실패: path=${path}, ${(error as Error).message}`);
      throw new InternalServerErrorException('코드리뷰 서비스 요청에 실패했습니다.');
    }
  }
}
