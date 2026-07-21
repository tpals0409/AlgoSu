/**
 * @file Problem 컨트롤러 — 문제 CRUD API
 * @domain problem
 * @layer controller
 * @related problem.service.ts, InternalKeyGuard, StudyMemberGuard
 */
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  Headers,
  UseGuards,
  ParseUUIDPipe,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ProblemService } from './problem.service';
import { CreateProblemDto, UpdateProblemDto } from './dto/create-problem.dto';
import { FindByTagsQueryDto } from './dto/query-problem.dto';
import { RecommendQueryDto } from './dto/recommend-query.dto';
import { InternalKeyGuard } from '../common/guards/internal-key.guard';
import { StudyMemberGuard } from '../common/guards/study-member.guard';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';

/**
 * Problem Controller
 *
 * 보안 체계:
 * 1. InternalKeyGuard — X-Internal-Key 검증 (모든 엔드포인트)
 * 2. StudyMemberGuard — 스터디 멤버십 검증, request.studyRole 설정
 * 3. 쓰기 엔드포인트 내부 — studyRole === 'ADMIN' 확인
 *
 * cross-study 접근: 모든 DB 쿼리에 studyId 조건 필수 (서비스 레이어에서 보장)
 */
@ApiTags('Problems')
@Controller()
@UseGuards(InternalKeyGuard, StudyMemberGuard)
export class ProblemController {
  constructor(
    private readonly problemService: ProblemService,
    private readonly logger: StructuredLoggerService,
  ) {
    this.logger.setContext(ProblemController.name);
  }

  /**
   * POST / — 문제 생성 (ADMIN 전용)
   */
  @ApiOperation({ summary: '문제 생성 (ADMIN 전용)' })
  @ApiResponse({ status: 201, description: '생성된 문제 정보' })
  @ApiResponse({ status: 403, description: 'ADMIN 권한 필요' })
  @Post()
  async create(
    @Body() dto: CreateProblemDto,
    @Headers('x-user-id') userId: string,
    @Headers('x-study-id') studyId: string,
    @Request() req: { studyRole?: string },
  ) {
    if (req.studyRole !== 'ADMIN') {
      this.logger.warn(`권한 없는 문제 생성 시도: userId=${userId}, studyId=${studyId}, role=${req.studyRole}`);
      throw new ForbiddenException('문제 생성은 ADMIN만 가능합니다.');
    }

    const problem = await this.problemService.create(dto, studyId, userId);
    return { data: problem };
  }

  /**
   * GET /week/:weekNumber — 스터디별 주차별 문제 목록
   */
  @ApiOperation({ summary: '주차별 문제 목록 조회' })
  @ApiResponse({ status: 200, description: '문제 목록' })
  @Get('week/:weekNumber')
  async findByWeek(
    @Param('weekNumber') weekNumber: string,
    @Headers('x-study-id') studyId: string,
  ) {
    const problems = await this.problemService.findByWeekAndStudy(studyId, weekNumber);
    return { data: problems };
  }

  /**
   * GET /all — 스터디별 전체 문제 목록 (ACTIVE만)
   */
  @ApiOperation({ summary: '전체 문제 목록 조회 (ACTIVE)' })
  @ApiResponse({ status: 200, description: '문제 목록' })
  @Get('all')
  async findAll(@Headers('x-study-id') studyId: string) {
    const problems = await this.problemService.findAllByStudy(studyId);
    return { data: problems };
  }

  /**
   * GET /active — 스터디별 활성 문제 전체 목록
   */
  @ApiOperation({ summary: '활성 문제 전체 목록 조회' })
  @ApiResponse({ status: 200, description: '활성 문제 목록' })
  @Get('active')
  async findActive(@Headers('x-study-id') studyId: string) {
    const problems = await this.problemService.findActiveByStudy(studyId);
    return { data: problems };
  }

  /**
   * GET /search/tags — 태그 기반 문제 검색 (ACTIVE 상태, studyId 스코핑)
   *
   * 선언 위치: @Get(':id') 앞 필수 — NestJS 선언순 매칭으로 'search' 리터럴이 UUID 파싱 400 방지
   * 쿼리 파라미터: ?tags=DP&tags=그래프&mode=and (반복 파라미터, URL 인코딩)
   */
  @ApiOperation({ summary: '태그 기반 문제 검색 (OR 기본, AND 지원)' })
  @ApiResponse({ status: 200, description: '태그 일치 문제 목록' })
  @ApiResponse({ status: 400, description: 'studyId 누락 또는 tags 비어있음' })
  @Get('search/tags')
  async searchByTags(
    @Query() query: FindByTagsQueryDto,
    @Headers('x-study-id') studyId: string,
  ) {
    const problems = await this.problemService.findByTags(studyId, query.tags, query.mode);
    return { data: problems };
  }

  /**
   * GET /recommendations — 추천 문제 조회 (P2 하이브리드, 읽기 전용)
   *
   * 선언 위치: @Get(':id') 앞 필수 — NestJS 선언순 매칭으로 'recommendations' 리터럴이
   *   UUID 파싱 400을 방지('search/tags' 선례 준수).
   * 가드: InternalKeyGuard + StudyMemberGuard — 멤버면 누구나 조회 가능(ADMIN 불필요).
   * 응답: cross-study 읽기 → 외부 식별 메타만 투영(description 등 누출 금지).
   */
  @ApiOperation({ summary: '추천 문제 조회 (cross-study 하이브리드)' })
  @ApiResponse({ status: 200, description: '추천 문제 목록' })
  @ApiResponse({ status: 400, description: 'studyId 누락' })
  @Get('recommendations')
  async recommend(
    @Query() query: RecommendQueryDto,
    @Headers('x-study-id') studyId: string,
  ) {
    const limit = query.limit ?? 8;
    const exclude = query.exclude ?? [];
    const data = await this.problemService.recommendForStudy(studyId, exclude, limit);
    return { data };
  }

  /**
   * GET /:id — 문제 단건 조회 (studyId 스코핑)
   */
  @ApiOperation({ summary: '문제 단건 조회' })
  @ApiResponse({ status: 200, description: '문제 정보' })
  @ApiResponse({ status: 404, description: '문제 없음' })
  @Get(':id')
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-study-id') studyId: string,
  ) {
    const problem = await this.problemService.findById(studyId, id);
    return { data: problem };
  }

  /**
   * DELETE /:id — 문제 삭제 soft delete (ADMIN 전용)
   */
  @ApiOperation({ summary: '문제 삭제 (ADMIN 전용)' })
  @ApiResponse({ status: 204, description: '삭제 완료' })
  @ApiResponse({ status: 403, description: 'ADMIN 권한 필요' })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-user-id') userId: string,
    @Headers('x-study-id') studyId: string,
    @Request() req: { studyRole?: string },
  ) {
    if (req.studyRole !== 'ADMIN') {
      this.logger.warn(`권한 없는 문제 삭제 시도: userId=${userId}, studyId=${studyId}, role=${req.studyRole}`);
      throw new ForbiddenException('문제 삭제는 ADMIN만 가능합니다.');
    }

    await this.problemService.delete(studyId, id);
  }

  /**
   * PATCH /:id — 문제 수정 (ADMIN 전용)
   */
  @ApiOperation({ summary: '문제 수정 (ADMIN 전용)' })
  @ApiResponse({ status: 200, description: '수정된 문제 정보' })
  @ApiResponse({ status: 403, description: 'ADMIN 권한 필요' })
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProblemDto,
    @Headers('x-user-id') userId: string,
    @Headers('x-study-id') studyId: string,
    @Request() req: { studyRole?: string },
  ) {
    if (req.studyRole !== 'ADMIN') {
      this.logger.warn(`권한 없는 문제 수정 시도: userId=${userId}, studyId=${studyId}, role=${req.studyRole}`);
      throw new ForbiddenException('문제 수정은 ADMIN만 가능합니다.');
    }

    const problem = await this.problemService.update(studyId, id, dto);
    return { data: problem };
  }
}
