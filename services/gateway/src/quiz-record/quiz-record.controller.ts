/**
 * @file 퀴즈 기록 컨트롤러 — BFF REST 엔드포인트
 * @domain quiz-record
 * @layer controller
 * @related QuizRecordService, SaveQuizRecordDto
 *
 * 인증: JWT 미들웨어(app.module 미들웨어 체인)가 protected 경로에 X-User-ID를 주입한다.
 * `/api/quiz-records`는 exclude 목록에 없으므로 protected — 본 컨트롤러는 추가로
 * X-User-ID 신뢰 경계를 방어적으로 검증한다(헤더 미존재/형식 오류 시 401).
 */
import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Request } from 'express';
import { QuizRecordService } from './quiz-record.service';
import { SaveQuizRecordDto } from './dto/save-quiz-record.dto';

/** UUID v4 형식 검증 — JwtMiddleware와 동일 규격 */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@ApiTags('QuizRecord')
@Controller('api/quiz-records')
export class QuizRecordController {
  constructor(private readonly quizRecordService: QuizRecordService) {}

  /**
   * POST /api/quiz-records — 퀴즈 최고 기록 저장 (높을 때만 갱신)
   * @api POST /quiz-records
   * @guard jwt-auth
   */
  @ApiOperation({ summary: '퀴즈 최고 기록 저장' })
  @ApiResponse({ status: 201, description: '갱신/유지된 best 기록' })
  @Post()
  async save(
    @Req() req: Request,
    @Body() dto: SaveQuizRecordDto,
  ): Promise<Record<string, unknown>> {
    const userId = this.extractUserId(req);
    return this.quizRecordService.save(userId, dto);
  }

  /**
   * GET /api/quiz-records — 내 전체 best 목록
   * @api GET /quiz-records
   * @guard jwt-auth
   */
  @ApiOperation({ summary: '내 퀴즈 best 목록 조회' })
  @ApiResponse({ status: 200, description: 'best 기록 목록' })
  @Get()
  async findMine(@Req() req: Request): Promise<Record<string, unknown>[]> {
    const userId = this.extractUserId(req);
    return this.quizRecordService.findMine(userId);
  }

  /**
   * X-User-ID 추출 + 신뢰 경계 검증.
   * JWT 미들웨어가 주입하므로 정상 흐름에선 항상 존재하지만, 미존재/형식 오류 시 401.
   */
  private extractUserId(req: Request): string {
    const userId = req.headers['x-user-id'];
    if (!userId || typeof userId !== 'string' || !UUID_REGEX.test(userId)) {
      throw new UnauthorizedException('유효한 사용자 인증 정보가 없습니다.');
    }
    return userId;
  }
}
