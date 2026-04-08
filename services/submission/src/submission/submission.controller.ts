/**
 * @file Submission Controller — 코드 제출 + Draft CRUD + AI 만족도
 * @domain submission
 * @layer controller
 * @related SubmissionService, DraftService, InternalKeyGuard, StudyMemberGuard
 */
import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  Headers,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SubmissionService } from './submission.service';
import { DraftService } from '../draft/draft.service';
import { CreateSubmissionDto, UpsertDraftDto } from './dto/create-submission.dto';
import { CreateAiSatisfactionDto } from './dto/create-ai-satisfaction.dto';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { InternalKeyGuard } from '../common/guards/internal-key.guard';
import { StudyMemberGuard } from '../common/guards/study-member.guard';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';

/**
 * Submission Controller
 *
 * 모든 엔드포인트는 InternalKeyGuard + StudyMemberGuard로 보호
 * X-User-ID + X-Study-ID 기반 IDOR 방지: 스터디 멤버 본인 데이터만 접근
 */
@ApiTags('Submissions')
@Controller()
@UseGuards(InternalKeyGuard, StudyMemberGuard)
export class SubmissionController {
  private readonly logger: StructuredLoggerService;

  constructor(
    private readonly submissionService: SubmissionService,
    private readonly draftService: DraftService,
  ) {
    this.logger = new StructuredLoggerService();
    this.logger.setContext(SubmissionController.name);
  }

  /**
   * POST / — 코드 제출 (Saga 시작)
   */
  @ApiOperation({ summary: '코드 제출 (Saga 시작)' })
  @ApiResponse({ status: 201, description: '생성된 제출 정보' })
  @ApiResponse({ status: 400, description: '잘못된 요청' })
  @Post()
  async create(
    @Body() dto: CreateSubmissionDto,
    @Headers('x-user-id') userId: string,
    @Headers('x-study-id') studyId: string,
  ) {
    const submission = await this.submissionService.create(dto, userId, studyId);

    // 정식 제출 시 Draft 삭제
    await this.draftService.deleteByProblem(studyId, userId, dto.problemId);

    return { data: submission };
  }

  /**
   * GET / — 스터디+사용자 본인 제출 목록 (페이지네이션)
   */
  @ApiOperation({ summary: '본인 제출 목록 조회 (페이지네이션)' })
  @ApiResponse({ status: 200, description: '제출 목록' })
  @Get()
  async findByStudyAndUser(
    @Query() query: PaginationQueryDto,
    @Headers('x-user-id') userId: string,
    @Headers('x-study-id') studyId: string,
  ) {
    return this.submissionService.findByStudyAndUserPaginated(studyId, userId, query);
  }

  /**
   * GET /study-submissions/:problemId — 스터디 전체 제출 목록 (본인 제출 후 열람 가능)
   *
   * 본인이 해당 문제에 제출한 경우에만 스터디 전체 제출 목록 반환.
   * SUBMISSION_LIST_FIELDS만 반환 (code 제외).
   */
  @ApiOperation({ summary: '스터디 전체 제출 목록 (문제별)' })
  @ApiResponse({ status: 200, description: '스터디 전체 제출 목록' })
  @ApiResponse({ status: 403, description: '본인 제출 후 열람 가능' })
  @Get('study-submissions/:problemId')
  async findByProblemForStudy(
    @Param('problemId', ParseUUIDPipe) problemId: string,
    @Headers('x-user-id') userId: string,
    @Headers('x-study-id') studyId: string,
  ) {
    // 본인 제출 여부 확인
    const mySubmissions = await this.submissionService.findByProblem(studyId, userId, problemId);

    if (!mySubmissions || mySubmissions.length === 0) {
      throw new ForbiddenException(
        '이 문제에 제출한 후 다른 스터디원의 풀이를 볼 수 있습니다.',
      );
    }

    // 스터디 전체 제출 반환 (SUBMISSION_LIST_FIELDS — code 제외)
    const submissions = await this.submissionService.findByProblemForStudy(studyId, problemId);
    return { data: submissions };
  }

  /**
   * GET /:id — 제출 단건 조회
   */
  @ApiOperation({ summary: '제출 단건 조회' })
  @ApiResponse({ status: 200, description: '제출 정보' })
  @ApiResponse({ status: 403, description: '접근 권한 없음' })
  @ApiResponse({ status: 404, description: '제출 없음' })
  @Get(':id')
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-user-id') userId: string,
    @Headers('x-study-id') studyId: string,
  ) {
    const submission = await this.submissionService.findById(id);

    // IDOR 방지: 동일 스터디 필수
    if (submission.studyId !== studyId) {
      throw new ForbiddenException('다른 사용자의 제출에 접근할 수 없습니다.');
    }

    // 본인이 아닌 경우: 해당 문제에 요청자의 제출이 있어야 열람 가능
    if (submission.userId !== userId) {
      const mySubmissions = await this.submissionService.findByProblem(
        studyId,
        userId,
        submission.problemId,
      );

      if (!mySubmissions || mySubmissions.length === 0) {
        throw new ForbiddenException(
          '이 문제에 제출한 후 다른 스터디원의 풀이를 볼 수 있습니다.',
        );
      }
    }

    return { data: submission };
  }

  /**
   * GET /:id/analysis — AI 분석 결과 조회
   * IDOR 방지: userId + studyId 검증
   */
  @ApiOperation({ summary: 'AI 분석 결과 조회' })
  @ApiResponse({ status: 200, description: 'AI 분석 결과' })
  @ApiResponse({ status: 403, description: '접근 권한 없음' })
  @Get(':id/analysis')
  async getAnalysis(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-user-id') userId: string,
    @Headers('x-study-id') studyId: string,
  ) {
    const submission = await this.submissionService.findById(id);

    // IDOR 방지: 동일 스터디 필수
    if (submission.studyId !== studyId) {
      throw new ForbiddenException('다른 사용자의 분석 결과에 접근할 수 없습니다.');
    }

    // 본인이 아닌 경우: 해당 문제에 요청자의 제출이 있어야 열람 가능
    if (submission.userId !== userId) {
      const mySubmissions = await this.submissionService.findByProblem(
        studyId,
        userId,
        submission.problemId,
      );

      if (!mySubmissions || mySubmissions.length === 0) {
        throw new ForbiddenException(
          '이 문제에 제출한 후 다른 스터디원의 풀이를 볼 수 있습니다.',
        );
      }
    }

    return {
      data: {
        feedback: submission.aiFeedback,
        score: submission.aiScore,
        optimizedCode: submission.aiOptimizedCode,
        analysisStatus: submission.aiAnalysisStatus,
      },
    };
  }

  /**
   * GET /problem/:problemId — 문제별 제출 목록 (스터디+본인)
   */
  @ApiOperation({ summary: '문제별 본인 제출 목록 조회' })
  @ApiResponse({ status: 200, description: '제출 목록' })
  @Get('problem/:problemId')
  async findByProblem(
    @Param('problemId', ParseUUIDPipe) problemId: string,
    @Headers('x-user-id') userId: string,
    @Headers('x-study-id') studyId: string,
  ) {
    const submissions = await this.submissionService.findByProblem(studyId, userId, problemId);
    return { data: submissions };
  }

  // ── Draft API ──────────────────────────────────────────

  /**
   * POST /drafts — Draft UPSERT (Auto-save)
   */
  @ApiOperation({ summary: 'Draft 저장 (UPSERT)' })
  @ApiResponse({ status: 200, description: '저장된 Draft' })
  @Post('drafts')
  async upsertDraft(
    @Body() dto: UpsertDraftDto,
    @Headers('x-user-id') userId: string,
    @Headers('x-study-id') studyId: string,
  ) {
    const draft = await this.draftService.upsert(dto, userId, studyId);
    return { data: draft };
  }

  /**
   * GET /drafts/:problemId — Draft 조회
   */
  @ApiOperation({ summary: 'Draft 조회' })
  @ApiResponse({ status: 200, description: 'Draft 정보' })
  @Get('drafts/:problemId')
  async findDraft(
    @Param('problemId', ParseUUIDPipe) problemId: string,
    @Headers('x-user-id') userId: string,
    @Headers('x-study-id') studyId: string,
  ) {
    const draft = await this.draftService.findByProblem(studyId, userId, problemId);
    return { data: draft };
  }

  /**
   * DELETE /drafts/:problemId — Draft 삭제 (명시적)
   */
  @ApiOperation({ summary: 'Draft 삭제' })
  @ApiResponse({ status: 204, description: '삭제 완료' })
  @Delete('drafts/:problemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteDraft(
    @Param('problemId', ParseUUIDPipe) problemId: string,
    @Headers('x-user-id') userId: string,
    @Headers('x-study-id') studyId: string,
  ): Promise<void> {
    await this.draftService.deleteByProblem(studyId, userId, problemId);
  }

  // ── AI 만족도 API ──────────────────────────────────────

  /**
   * POST /satisfaction/:submissionId — AI 만족도 등록/수정
   */
  @ApiOperation({ summary: 'AI 분석 만족도 등록/수정' })
  @Post('satisfaction/:submissionId')
  async rateSatisfaction(
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
    @Headers('x-user-id') userId: string,
    @Body() dto: CreateAiSatisfactionDto,
  ) {
    const satisfaction = await this.submissionService.rateSatisfaction(submissionId, userId, dto);
    return { data: satisfaction };
  }

  /**
   * GET /satisfaction/:submissionId — 내 AI 만족도 조회
   */
  @ApiOperation({ summary: '내 AI 만족도 조회' })
  @Get('satisfaction/:submissionId')
  async getSatisfaction(
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
    @Headers('x-user-id') userId: string,
  ) {
    const satisfaction = await this.submissionService.getSatisfaction(submissionId, userId);
    return { data: satisfaction };
  }

  /**
   * GET /satisfaction/:submissionId/stats — AI 만족도 통계 (up/down 집계)
   */
  @ApiOperation({ summary: 'AI 만족도 통계 조회' })
  @ApiResponse({ status: 200, description: 'up/down 카운트' })
  @Get('satisfaction/:submissionId/stats')
  async getSatisfactionStats(
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
  ) {
    const stats = await this.submissionService.getSatisfactionStats(submissionId);
    return { data: stats };
  }
}
