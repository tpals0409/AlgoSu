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
  ParseUUIDPipe,
} from '@nestjs/common';
import { Request } from 'express';
import { StudyService } from './study.service';
import { Study, StudyMember } from './study.entity';
import { ChangeRoleDto } from './dto/change-role.dto';

@Controller('api/studies')
export class StudyController {
  constructor(private readonly studyService: StudyService) {}

  /** POST /api/studies — 스터디 생성 (생성자 → ADMIN 자동) */
  @Post()
  async create(
    @Req() req: Request,
    @Body() body: { name: string; description?: string },
  ): Promise<Study> {
    const userId = req.headers['x-user-id'] as string;
    return this.studyService.createStudy(userId, body);
  }

  /** GET /api/studies — 내 스터디 목록 */
  @Get()
  async findMyStudies(@Req() req: Request): Promise<Study[]> {
    const userId = req.headers['x-user-id'] as string;
    return this.studyService.getMyStudies(userId);
  }

  /** GET /api/studies/:id — 스터디 상세 */
  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) studyId: string,
    @Req() req: Request,
  ): Promise<Study> {
    const userId = req.headers['x-user-id'] as string;
    return this.studyService.getStudyById(studyId, userId);
  }

  /** PUT /api/studies/:id — 스터디 수정 (ADMIN만) */
  @Put(':id')
  async update(
    @Param('id', ParseUUIDPipe) studyId: string,
    @Req() req: Request,
    @Body() body: { name?: string; description?: string },
  ): Promise<Study> {
    const userId = req.headers['x-user-id'] as string;
    return this.studyService.updateStudy(studyId, userId, body);
  }

  /** DELETE /api/studies/:id — 스터디 삭제 (ADMIN만) */
  @Delete(':id')
  async remove(
    @Param('id', ParseUUIDPipe) studyId: string,
    @Req() req: Request,
  ): Promise<{ message: string }> {
    const userId = req.headers['x-user-id'] as string;
    await this.studyService.deleteStudy(studyId, userId);
    return { message: '스터디가 삭제되었습니다.' };
  }

  /** POST /api/studies/:id/invite — 초대 코드 발급 (ADMIN만) */
  @Post(':id/invite')
  async createInvite(
    @Param('id', ParseUUIDPipe) studyId: string,
    @Req() req: Request,
  ): Promise<{ code: string; expires_at: Date }> {
    const userId = req.headers['x-user-id'] as string;
    return this.studyService.createInvite(studyId, userId);
  }

  /** POST /api/studies/join — 초대 코드로 가입 */
  @Post('join')
  async joinStudy(
    @Req() req: Request,
    @Body() body: { code: string },
  ): Promise<Study & { role: string }> {
    const userId = req.headers['x-user-id'] as string;
    return this.studyService.joinByInviteCode(userId, body.code);
  }

  /** GET /api/studies/:id/stats — 스터디 통계 (MEMBER 이상) */
  @Get(':id/stats')
  async getStudyStats(
    @Param('id', ParseUUIDPipe) studyId: string,
    @Req() req: Request,
  ) {
    const userId = req.headers['x-user-id'] as string;
    return this.studyService.getStudyStats(studyId, userId);
  }

  /** GET /api/studies/:id/members — 멤버 목록 */
  @Get(':id/members')
  async getMembers(
    @Param('id', ParseUUIDPipe) studyId: string,
    @Req() req: Request,
  ): Promise<StudyMember[]> {
    const userId = req.headers['x-user-id'] as string;
    return this.studyService.getMembers(studyId, userId);
  }

  /** PATCH /api/studies/:id/members/:userId/role — 역할 변경 (ADMIN만) */
  @Patch(':id/members/:userId/role')
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

  /** POST /api/studies/:id/notify-problem — 문제 생성 알림 (ADMIN만) */
  @Post(':id/notify-problem')
  async notifyProblemCreated(
    @Param('id', ParseUUIDPipe) studyId: string,
    @Req() req: Request,
    @Body() body: { problemId: string; problemTitle: string; weekNumber: string },
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

  /** DELETE /api/studies/:id/members/:user_id — 멤버 추방 (ADMIN만) */
  @Delete(':id/members/:user_id')
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
