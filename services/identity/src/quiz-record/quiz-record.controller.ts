/**
 * @file QuizRecord 컨트롤러 — Internal API (서비스 간 통신 전용)
 * @domain identity
 * @layer controller
 * @related quiz-record.service.ts, internal-key.guard.ts
 */
import { Controller, Get, Post, Param, Body, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { InternalKeyGuard } from '../common/guards/internal-key.guard';
import { QuizRecordService } from './quiz-record.service';
import { UpsertQuizRecordDto } from './dto/upsert-quiz-record.dto';

@ApiTags('QuizRecords')
@Controller('api/quiz-records')
@UseGuards(InternalKeyGuard)
export class QuizRecordController {
  constructor(private readonly quizRecordService: QuizRecordService) {}

  /** 퀴즈 최고 기록 upsert (높을 때만 갱신) */
  @ApiOperation({ summary: '퀴즈 최고 기록 upsert' })
  @ApiResponse({ status: 201, description: '갱신/유지된 best 기록 반환' })
  @Post()
  async upsertBest(@Body() dto: UpsertQuizRecordDto) {
    const record = await this.quizRecordService.upsertBest(dto);
    return { data: record };
  }

  /** 사용자의 전체 best 목록 조회 */
  @ApiOperation({ summary: '사용자 퀴즈 best 목록 조회' })
  @ApiResponse({ status: 200, description: 'best 기록 목록' })
  @Get('by-user/:userId')
  async findByUser(@Param('userId', ParseUUIDPipe) userId: string) {
    const records = await this.quizRecordService.findByUser(userId);
    return { data: records };
  }
}
