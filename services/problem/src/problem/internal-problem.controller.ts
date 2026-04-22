/**
 * @file Internal Problem 컨트롤러 — 내부 서비스 전용 문제 조회 API
 * @domain problem
 * @layer controller
 * @related problem.service.ts, InternalKeyGuard, ParseStudyIdPipe, StudyIdHeader
 *
 * GitHub Worker, Submission 등 내부 서비스에서 문제 정보를 조회할 때 사용.
 * StudyMemberGuard를 거치지 않고 InternalKeyGuard만 적용하여
 * 서비스 간 통신 시 403 문제를 방지한다.
 *
 * 보안: x-study-id 헤더를 StudyIdHeader + ParseStudyIdPipe로 필수 UUID 검증 — cross-study 접근 차단
 */
import {
  Controller,
  Get,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ProblemService } from './problem.service';
import { InternalKeyGuard } from '../common/guards/internal-key.guard';
import { ParseStudyIdPipe, StudyIdHeader } from '../common/pipes/parse-study-id.pipe';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';

/**
 * Internal Problem Controller
 *
 * 보안 체계:
 * - InternalKeyGuard만 적용 (X-Internal-Key 검증)
 * - StudyMemberGuard 미적용 — 내부 서비스 전용
 * - studyId는 x-study-id 헤더로 수신하여 DB 쿼리 스코핑
 */
@ApiTags('Problems (Internal)')
@Controller('internal')
@UseGuards(InternalKeyGuard)
export class InternalProblemController {
  constructor(
    private readonly problemService: ProblemService,
    private readonly logger: StructuredLoggerService,
  ) {
    this.logger.setContext(InternalProblemController.name);
  }

  /**
   * GET /internal/active-ids/:studyId — 통계 대상 문제 ID 목록 조회
   * ACTIVE + CLOSED 포함, DELETED만 제외 (Gateway stats 집계용)
   */
  @ApiOperation({ summary: '통계 대상 문제 ID 목록 조회 (ACTIVE + CLOSED)' })
  @ApiResponse({ status: 200, description: '문제 ID 배열' })
  @Get('active-ids/:studyId')
  async getActiveProblemIds(
    @Param('studyId', ParseUUIDPipe) studyId: string,
  ) {
    const problems = await this.problemService.findAllByStudy(studyId);
    const ids = problems.map((p) => p.id);
    return { data: ids };
  }

  /**
   * GET /internal/deadline/:id — 마감 시간 조회 (Submission Service 내부 연동용)
   * studyId 컨텍스트 포함 — 캐시 우선 → DB fallback
   * @security ParseStudyIdPipe — x-study-id 필수 UUID 검증
   */
  @ApiOperation({ summary: '문제 마감 시간 조회' })
  @ApiResponse({ status: 200, description: '마감 시간 정보' })
  @ApiResponse({ status: 400, description: 'x-study-id 누락 또는 UUID 형식 불일치' })
  @Get('deadline/:id')
  async getDeadline(
    @Param('id', ParseUUIDPipe) id: string,
    @StudyIdHeader(ParseStudyIdPipe) studyId: string,
  ) {
    const result = await this.problemService.getDeadline(studyId, id);
    return { data: result };
  }

  /**
   * GET /internal/:id — 내부 서비스 전용 문제 단건 조회
   * StudyMemberGuard 없이 InternalKeyGuard만으로 접근 허용
   * @security ParseStudyIdPipe — x-study-id 필수 UUID 검증
   */
  @ApiOperation({ summary: '내부 서비스 전용 문제 단건 조회' })
  @ApiResponse({ status: 200, description: '문제 정보' })
  @ApiResponse({ status: 400, description: 'x-study-id 누락 또는 UUID 형식 불일치' })
  @Get(':id')
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
    @StudyIdHeader(ParseStudyIdPipe) studyId: string,
  ) {
    this.logger.log(`내부 문제 조회: id=${id}, studyId=${studyId}`);
    const problem = await this.problemService.findByIdInternal(studyId, id);
    return { data: problem };
  }
}
