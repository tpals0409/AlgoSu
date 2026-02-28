import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { SubmissionService } from './submission.service';
import { InternalKeyGuard } from '../common/guards/internal-key.guard';
import { UpdateAiResultDto } from './dto/update-ai-result.dto';

/**
 * Internal Submission Controller
 * AI Analysis Service 등 내부 서비스 전용 API
 *
 * 보안: InternalKeyGuard만 적용 (StudyMemberGuard 불필요 — 서비스 간 통신)
 */
@Controller('internal')
@UseGuards(InternalKeyGuard)
export class SubmissionInternalController {
  private readonly logger = new Logger(SubmissionInternalController.name);

  constructor(private readonly submissionService: SubmissionService) {}

  /**
   * GET /internal/:id — 내부 서비스용 제출 데이터 조회
   * AI Analysis Worker에서 코드+언어 정보 조회 시 사용
   */
  @Get(':id')
  async findByIdInternal(@Param('id', ParseUUIDPipe) id: string) {
    const submission = await this.submissionService.findById(id);
    return { data: submission };
  }

  /**
   * PATCH /internal/:id/ai-result — AI 분석 결과 저장
   * AI Analysis Service worker에서 분석 완료 후 콜백
   */
  @Patch(':id/ai-result')
  async updateAiResult(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAiResultDto,
  ) {
    const updated = await this.submissionService.updateAiResult(id, dto);
    this.logger.log(
      `AI 분석 결과 저장: submissionId=${id}, status=${dto.analysisStatus}, score=${dto.score}`,
    );
    return { data: updated };
  }

  /**
   * GET /internal/by-problem/:problemId — 문제별 전체 제출 (스터디 스코핑)
   * 그룹 분석용: AI Analysis Service에서 호출
   */
  @Get('by-problem/:problemId')
  async findByProblemForStudy(
    @Param('problemId', ParseUUIDPipe) problemId: string,
    @Query('studyId') studyId: string,
  ) {
    if (!studyId) {
      return { statusCode: 400, message: 'studyId 쿼리 파라미터가 필요합니다.' };
    }
    const submissions = await this.submissionService.findByProblemForStudy(studyId, problemId);
    return { data: submissions };
  }

  /**
   * GET /internal/stats/:studyId — 스터디 통계 조회
   * Gateway StudyService에서 호출
   */
  @Get('stats/:studyId')
  async getStudyStats(@Param('studyId', ParseUUIDPipe) studyId: string) {
    const stats = await this.submissionService.getStudyStats(studyId);
    return { data: stats };
  }
}
