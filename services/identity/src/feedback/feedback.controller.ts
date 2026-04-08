/**
 * @file 피드백 컨트롤러 — InternalKeyGuard 전용 API (Gateway ↔ Identity 내부 통신)
 * @domain identity
 * @layer controller
 * @related feedback.service.ts, InternalKeyGuard
 */
import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { FeedbackService } from './feedback.service';
import { InternalKeyGuard } from '../common/guards/internal-key.guard';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { UpdateFeedbackStatusDto } from './dto/update-feedback-status.dto';

@ApiTags('Feedbacks')
@Controller('api/feedbacks')
@UseGuards(InternalKeyGuard)
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  /**
   * 피드백 생성
   * @route POST /api/feedbacks
   */
  @ApiOperation({ summary: '피드백 생성' })
  @ApiResponse({ status: 201, description: '생성된 피드백' })
  @Post()
  async create(@Body() dto: CreateFeedbackDto) {
    return this.feedbackService.create(dto);
  }

  /**
   * 사용자별 피드백 목록 조회 (최신순, 최대 50개)
   * @route GET /api/feedbacks/by-user/:userId
   */
  @ApiOperation({ summary: '사용자별 피드백 목록 조회' })
  @ApiResponse({ status: 200, description: '피드백 목록' })
  @Get('by-user/:userId')
  async findByUserId(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.feedbackService.findByUserId(userId);
  }

  /**
   * 전체 피드백 목록 조회 (admin용, 페이지네이션)
   * @route GET /api/feedbacks
   */
  @ApiOperation({ summary: '전체 피드백 목록 조회 (admin)' })
  @ApiResponse({ status: 200, description: '피드백 목록 + 전체 건수' })
  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.feedbackService.findAll(
      page ? parseInt(page, 10) : undefined,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  /**
   * 피드백 상태 변경
   * @route PATCH /api/feedbacks/:publicId/status
   */
  @ApiOperation({ summary: '피드백 상태 변경' })
  @ApiResponse({ status: 200, description: '상태 변경된 피드백' })
  @Patch(':publicId/status')
  async updateStatus(
    @Param('publicId', ParseUUIDPipe) publicId: string,
    @Body() dto: UpdateFeedbackStatusDto,
  ) {
    return this.feedbackService.updateStatus(publicId, dto.status);
  }
}
