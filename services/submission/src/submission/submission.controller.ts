import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Headers,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { SubmissionService } from './submission.service';
import { DraftService } from '../draft/draft.service';
import { CreateSubmissionDto, UpsertDraftDto } from './dto/create-submission.dto';
import { InternalKeyGuard } from '../common/guards/internal-key.guard';
import { StudyMemberGuard } from '../common/guards/study-member.guard';

/**
 * Submission Controller
 *
 * 모든 엔드포인트는 InternalKeyGuard + StudyMemberGuard로 보호
 * X-User-ID + X-Study-ID 기반 IDOR 방지: 스터디 멤버 본인 데이터만 접근
 */
@Controller()
@UseGuards(InternalKeyGuard, StudyMemberGuard)
export class SubmissionController {
  private readonly logger = new Logger(SubmissionController.name);

  constructor(
    private readonly submissionService: SubmissionService,
    private readonly draftService: DraftService,
  ) {}

  /**
   * POST / — 코드 제출 (Saga 시작)
   */
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
   * GET / — 스터디+사용자 본인 제출 목록
   */
  @Get()
  async findByStudyAndUser(
    @Headers('x-user-id') userId: string,
    @Headers('x-study-id') studyId: string,
  ) {
    const submissions = await this.submissionService.findByStudyAndUser(studyId, userId);
    return { data: submissions };
  }

  /**
   * GET /:id — 제출 단건 조회
   */
  @Get(':id')
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-user-id') userId: string,
    @Headers('x-study-id') studyId: string,
  ) {
    const submission = await this.submissionService.findById(id);

    // IDOR 방지: 본인 데이터 + 동일 스터디만 접근
    if (submission.userId !== userId || submission.studyId !== studyId) {
      return { statusCode: 403, message: '다른 사용자의 제출에 접근할 수 없습니다.' };
    }

    return { data: submission };
  }

  /**
   * GET /problem/:problemId — 문제별 제출 목록 (스터디+본인)
   */
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
  @Delete('drafts/:problemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteDraft(
    @Param('problemId', ParseUUIDPipe) problemId: string,
    @Headers('x-user-id') userId: string,
    @Headers('x-study-id') studyId: string,
  ): Promise<void> {
    await this.draftService.deleteByProblem(studyId, userId, problemId);
  }
}
