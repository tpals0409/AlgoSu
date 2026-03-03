/**
 * @file 스터디 컨트롤러 — REST API 엔드포인트
 * @domain study
 * @layer controller
 * @related StudyService, StudyActiveGuard, CreateStudyDto, JoinStudyDto
 */
import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  Req,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Request } from 'express';
import { StudyService } from './study.service';
import { Study, StudyMember } from './study.entity';
import { ChangeRoleDto } from './dto/change-role.dto';
import { CreateStudyDto } from './dto/create-study.dto';
import { JoinStudyDto } from './dto/join-study.dto';
import { UpdateGroundRulesDto } from './dto/update-ground-rules.dto';
import { UpdateNicknameDto } from './dto/update-nickname.dto';
import { UpdateStudyDto } from './dto/update-study.dto';
import { VerifyInviteDto } from './dto/verify-invite.dto';
import { NotifyProblemDto } from './dto/notify-problem.dto';
import { StudyActiveGuard } from '../common/guards/study-active.guard';

@Controller('api/studies')
export class StudyController {
  constructor(private readonly studyService: StudyService) {}

  /**
   * POST /api/studies — 스터디 생성 (생성자 ADMIN 자동, 닉네임 필수)
   * @api POST /studies
   * @guard jwt-auth
   */
  @Post()
  async create(
    @Req() req: Request,
    @Body() dto: CreateStudyDto,
  ): Promise<Study> {
    const userId = req.headers['x-user-id'] as string;
    return this.studyService.createStudy(userId, dto);
  }

  /**
   * GET /api/studies — 내 스터디 목록
   * @api GET /studies
   * @guard jwt-auth
   */
  @Get()
  async findMyStudies(@Req() req: Request): Promise<Study[]> {
    const userId = req.headers['x-user-id'] as string;
    return this.studyService.getMyStudies(userId);
  }

  /**
   * GET /api/studies/:id — 스터디 상세 (groundRules 포함)
   * @api GET /studies/:id
   * @guard jwt-auth, study-member
   */
  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) studyId: string,
    @Req() req: Request,
  ): Promise<Study> {
    const userId = req.headers['x-user-id'] as string;
    return this.studyService.getStudyById(studyId, userId);
  }

  /**
   * PUT /api/studies/:id — 스터디 수정 (ADMIN만)
   * @api PUT /studies/:id
   * @guard jwt-auth, study-admin, closed-study
   */
  @Put(':id')
  @UseGuards(StudyActiveGuard)
  async update(
    @Param('id', ParseUUIDPipe) studyId: string,
    @Req() req: Request,
    @Body() body: UpdateStudyDto,
  ): Promise<Study> {
    const userId = req.headers['x-user-id'] as string;
    return this.studyService.updateStudy(studyId, userId, body);
  }

  /**
   * DELETE /api/studies/:id — 스터디 삭제 (ADMIN만)
   * @api DELETE /studies/:id
   * @guard jwt-auth, study-admin, closed-study
   */
  @Delete(':id')
  @UseGuards(StudyActiveGuard)
  async remove(
    @Param('id', ParseUUIDPipe) studyId: string,
    @Req() req: Request,
  ): Promise<{ message: string }> {
    const userId = req.headers['x-user-id'] as string;
    await this.studyService.deleteStudy(studyId, userId);
    return { message: '스터디가 삭제되었습니다.' };
  }

  /**
   * PATCH /api/studies/:id/ground-rules — 그라운드 룰 수정 (ADMIN만, 500자)
   * @api PATCH /studies/:id/ground-rules
   * @guard jwt-auth, study-admin, closed-study
   */
  @Patch(':id/ground-rules')
  @UseGuards(StudyActiveGuard)
  async updateGroundRules(
    @Param('id', ParseUUIDPipe) studyId: string,
    @Req() req: Request,
    @Body() dto: UpdateGroundRulesDto,
  ): Promise<Study> {
    const userId = req.headers['x-user-id'] as string;
    return this.studyService.updateGroundRules(studyId, userId, dto.groundRules);
  }

  /**
   * POST /api/studies/:id/invite — 초대 코드 발급 (ADMIN만, 5분 유효)
   * @api POST /studies/:id/invite
   * @guard jwt-auth, study-admin, closed-study
   */
  @Post(':id/invite')
  @UseGuards(StudyActiveGuard)
  async createInvite(
    @Param('id', ParseUUIDPipe) studyId: string,
    @Req() req: Request,
  ): Promise<{ code: string; expires_at: Date }> {
    const userId = req.headers['x-user-id'] as string;
    return this.studyService.createInvite(studyId, userId);
  }

  /**
   * POST /api/studies/verify-invite — 초대 코드 유효성 검증
   * @api POST /studies/verify-invite
   * @guard jwt-auth
   */
  @Post('verify-invite')
  async verifyInvite(
    @Req() req: Request,
    @Body() body: VerifyInviteDto,
  ): Promise<{ valid: boolean; studyName: string }> {
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    return this.studyService.verifyInviteCode(body.code, ip);
  }

  /**
   * POST /api/studies/join — 초대 코드로 가입 (닉네임 필수, brute force 방어)
   * @api POST /studies/join
   * @guard jwt-auth, invite-code-lock
   */
  @Post('join')
  async joinStudy(
    @Req() req: Request,
    @Body() dto: JoinStudyDto,
  ): Promise<Study & { role: string }> {
    const userId = req.headers['x-user-id'] as string;
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    return this.studyService.joinByInviteCode(userId, dto.code, dto.nickname, ip);
  }

  /**
   * POST /api/studies/:id/leave — 스터디 탈퇴 (A2: ADMIN 위임 필수)
   * @api POST /studies/:id/leave
   * @guard jwt-auth, study-member
   */
  @Post(':id/leave')
  async leaveStudy(
    @Param('id', ParseUUIDPipe) studyId: string,
    @Req() req: Request,
  ): Promise<{ message: string }> {
    const userId = req.headers['x-user-id'] as string;
    await this.studyService.leaveStudy(studyId, userId);
    return { message: '스터디에서 탈퇴했습니다.' };
  }

  /**
   * POST /api/studies/:id/close — 스터디 종료 (ADMIN만, CLOSED 전환)
   * @api POST /studies/:id/close
   * @guard jwt-auth, study-admin, closed-study
   * @event STUDY_CLOSED (publish)
   */
  @Post(':id/close')
  @UseGuards(StudyActiveGuard)
  async closeStudy(
    @Param('id', ParseUUIDPipe) studyId: string,
    @Req() req: Request,
  ): Promise<{ message: string }> {
    const userId = req.headers['x-user-id'] as string;
    await this.studyService.closeStudy(studyId, userId);
    return { message: '스터디가 종료되었습니다.' };
  }

  /**
   * GET /api/studies/:id/stats — 스터디 통계 (MEMBER 이상)
   * @api GET /studies/:id/stats
   * @guard jwt-auth, study-member
   */
  @Get(':id/stats')
  async getStudyStats(
    @Param('id', ParseUUIDPipe) studyId: string,
    @Query('weekNumber') weekNumber: string | undefined,
    @Req() req: Request,
  ) {
    const userId = req.headers['x-user-id'] as string;
    return this.studyService.getStudyStats(studyId, userId, weekNumber);
  }

  /**
   * GET /api/studies/:id/members — 멤버 목록
   * @api GET /studies/:id/members
   * @guard jwt-auth, study-member
   */
  @Get(':id/members')
  async getMembers(
    @Param('id', ParseUUIDPipe) studyId: string,
    @Req() req: Request,
  ): Promise<StudyMember[]> {
    const userId = req.headers['x-user-id'] as string;
    return this.studyService.getMembers(studyId, userId);
  }

  /**
   * PATCH /api/studies/:id/nickname — 본인 닉네임 변경
   * @api PATCH /studies/:id/nickname
   * @guard jwt-auth, study-member
   */
  @Patch(':id/nickname')
  async updateNickname(
    @Param('id', ParseUUIDPipe) studyId: string,
    @Req() req: Request,
    @Body() dto: UpdateNicknameDto,
  ): Promise<{ nickname: string }> {
    const userId = req.headers['x-user-id'] as string;
    return this.studyService.updateNickname(studyId, userId, dto.nickname);
  }

  /**
   * PATCH /api/studies/:id/members/:userId/role — 역할 변경 (ADMIN만)
   * @api PATCH /studies/:id/members/:userId/role
   * @guard jwt-auth, study-admin, closed-study
   */
  @Patch(':id/members/:userId/role')
  @UseGuards(StudyActiveGuard)
  async changeMemberRole(
    @Param('id', ParseUUIDPipe) studyId: string,
    @Param('userId', ParseUUIDPipe) targetUserId: string,
    @Req() req: Request,
    @Body() dto: ChangeRoleDto,
  ): Promise<{ message: string }> {
    const userId = req.headers['x-user-id'] as string;
    await this.studyService.changeMemberRole(studyId, targetUserId, userId, dto.role);
    return { message: '역할이 변경되었습니다.' };
  }

  /**
   * POST /api/studies/:id/notify-problem — 문제 생성 알림 (ADMIN만)
   * @api POST /studies/:id/notify-problem
   * @guard jwt-auth, study-admin, closed-study
   */
  @Post(':id/notify-problem')
  @UseGuards(StudyActiveGuard)
  async notifyProblemCreated(
    @Param('id', ParseUUIDPipe) studyId: string,
    @Req() req: Request,
    @Body() body: NotifyProblemDto,
  ): Promise<{ message: string }> {
    const userId = req.headers['x-user-id'] as string;
    await this.studyService.notifyProblemCreated(
      studyId,
      userId,
      body.problemTitle,
      body.weekNumber,
      body.problemId,
    );
    return { message: '알림이 전송되었습니다.' };
  }

  /**
   * DELETE /api/studies/:id/members/:user_id — 멤버 추방 (ADMIN만)
   * @api DELETE /studies/:id/members/:user_id
   * @guard jwt-auth, study-admin, closed-study
   */
  @Delete(':id/members/:user_id')
  @UseGuards(StudyActiveGuard)
  async removeMember(
    @Param('id', ParseUUIDPipe) studyId: string,
    @Param('user_id', ParseUUIDPipe) targetUserId: string,
    @Req() req: Request,
  ): Promise<{ message: string }> {
    const userId = req.headers['x-user-id'] as string;
    await this.studyService.removeMember(studyId, targetUserId, userId);
    return { message: '멤버가 추방되었습니다.' };
  }
}
