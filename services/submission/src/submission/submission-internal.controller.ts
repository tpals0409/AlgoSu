/**
 * @file Internal Submission Controller — 내부 서비스 전용 API
 * @domain submission
 * @layer controller
 * @related SubmissionService, SagaOrchestratorService, InternalKeyGuard
 */
import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { SubmissionService } from './submission.service';
import { SagaOrchestratorService } from '../saga/saga-orchestrator.service';
import { InternalKeyGuard } from '../common/guards/internal-key.guard';
import { UpdateAiResultDto } from './dto/update-ai-result.dto';
import { GithubSuccessCallbackDto } from './dto/github-success-callback.dto';
import { GitHubSyncStatus } from './submission.entity';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';

/**
 * Internal Submission Controller
 * AI Analysis Service 등 내부 서비스 전용 API
 *
 * 보안: InternalKeyGuard만 적용 (StudyMemberGuard 불필요 — 서비스 간 통신)
 */
@Controller('internal')
@UseGuards(InternalKeyGuard)
export class SubmissionInternalController {
  private readonly logger: StructuredLoggerService;

  constructor(
    private readonly submissionService: SubmissionService,
    private readonly sagaOrchestrator: SagaOrchestratorService,
  ) {
    this.logger = new StructuredLoggerService();
    this.logger.setContext(SubmissionInternalController.name);
  }

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
   * GET /internal/submissions/:id/owner — 제출 소유자 조회 (SSE S6 소유권 검증)
   * @guard submission-owner
   */
  @Get('submissions/:id/owner')
  async getSubmissionOwner(@Param('id', ParseUUIDPipe) id: string) {
    const submission = await this.submissionService.findById(id);
    return { userId: submission.userId };
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
      throw new BadRequestException('studyId 쿼리 파라미터가 필요합니다.');
    }
    const submissions = await this.submissionService.findByProblemForStudy(studyId, problemId);
    return { data: submissions };
  }

  /**
   * GET /internal/stats/:studyId — 스터디 통계 조회
   * Gateway StudyService에서 호출
   */
  @Get('stats/:studyId')
  async getStudyStats(
    @Param('studyId', ParseUUIDPipe) studyId: string,
    @Query('weekNumber') weekNumber?: string,
    @Query('userId') userId?: string,
  ) {
    const stats = await this.submissionService.getStudyStats(studyId, weekNumber, userId);
    return { data: stats };
  }

  /**
   * POST /internal/:id/github-success
   * GitHub Push 성공 콜백 — Saga를 AI_QUEUED 단계로 진행
   */
  @Post(':id/github-success')
  @HttpCode(HttpStatus.OK)
  async githubSuccess(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GithubSuccessCallbackDto,
  ) {
    await this.submissionService.updateGithubFilePath(id, dto.filePath);
    await this.sagaOrchestrator.advanceToAiQueued(id);
    this.logger.log(`GitHub 성공 콜백: submissionId=${id}, filePath=${dto.filePath}`);
    return { success: true };
  }

  /**
   * POST /internal/:id/github-failed
   * GitHub Push 실패 콜백 — 보상 트랜잭션 (AI 분석은 계속 진행)
   */
  @Post(':id/github-failed')
  @HttpCode(HttpStatus.OK)
  async githubFailed(@Param('id', ParseUUIDPipe) id: string) {
    await this.sagaOrchestrator.compensateGitHubFailed(id, GitHubSyncStatus.FAILED);
    this.logger.warn(`GitHub 실패 콜백: submissionId=${id}`);
    return { success: true };
  }

  /**
   * POST /internal/:id/github-token-invalid
   * GitHub Token 무효 콜백 — AI 분석도 스킵
   */
  @Post(':id/github-token-invalid')
  @HttpCode(HttpStatus.OK)
  async githubTokenInvalid(@Param('id', ParseUUIDPipe) id: string) {
    await this.sagaOrchestrator.compensateGitHubFailed(id, GitHubSyncStatus.TOKEN_INVALID);
    this.logger.warn(`GitHub TOKEN_INVALID 콜백: submissionId=${id}`);
    return { success: true };
  }

  /**
   * POST /internal/:id/github-skipped
   * GitHub 레포 미연결 — SKIPPED 처리 후 AI 분석은 계속 진행
   */
  @Post(':id/github-skipped')
  @HttpCode(HttpStatus.OK)
  async githubSkipped(@Param('id', ParseUUIDPipe) id: string) {
    await this.sagaOrchestrator.compensateGitHubFailed(id, GitHubSyncStatus.SKIPPED);
    this.logger.log(`GitHub SKIPPED 콜백: submissionId=${id}`);
    return { success: true };
  }
}
