/**
 * @file 스터디 노트 컨트롤러 — 메모 UPSERT + 조회
 * @domain review
 * @layer controller
 * @related StudyNoteService, InternalKeyGuard, StudyMemberGuard
 */
import {
  Controller,
  Get,
  Put,
  Body,
  Query,
  Headers,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { StudyNoteService } from './study-note.service';
import { UpsertStudyNoteDto } from './dto/upsert-study-note.dto';
import { InternalKeyGuard } from '../common/guards/internal-key.guard';
import { StudyMemberGuard } from '../common/guards/study-member.guard';

@Controller('study-notes')
@UseGuards(InternalKeyGuard, StudyMemberGuard)
export class StudyNoteController {
  constructor(private readonly studyNoteService: StudyNoteService) {}

  /**
   * PUT /study-notes — 메모 생성/수정 (upsert)
   * @api PUT /study-notes
   * @guard study-member
   */
  @Put()
  async upsert(
    @Body() dto: UpsertStudyNoteDto,
    @Headers('x-user-id') userId: string,
    @Headers('x-study-id') studyId: string,
  ) {
    const note = await this.studyNoteService.upsert(dto, userId, studyId);
    return { data: note };
  }

  /**
   * GET /study-notes — 메모 조회 (problemId + studyId)
   * @api GET /study-notes
   * @guard study-member
   */
  @Get()
  async find(
    @Query('problemId', ParseUUIDPipe) problemId: string,
    @Headers('x-study-id') studyId: string,
  ) {
    const note = await this.studyNoteService.findByProblemAndStudy(
      problemId,
      studyId,
    );
    return { data: note };
  }
}
