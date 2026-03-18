/**
 * @file Study 컨트롤러 — Internal API (InternalKeyGuard 보호)
 * @domain identity
 * @layer controller
 * @related study.service.ts, internal-key.guard.ts
 */
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { InternalKeyGuard } from '../common/guards/internal-key.guard';
import { StudyService } from './study.service';
import { CreateStudyDto } from './dto/create-study.dto';
import { UpdateStudyDto } from './dto/update-study.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { ChangeRoleDto } from './dto/change-role.dto';
import { UpdateNicknameDto } from './dto/update-nickname.dto';
import { CreateInviteDto } from './dto/create-invite.dto';

@Controller('api')
@UseGuards(InternalKeyGuard)
export class StudyController {
  constructor(private readonly studyService: StudyService) {}

  // ─── Study CRUD ──────────────────────────────

  /** 스터디 생성 */
  @Post('studies')
  async createStudy(@Body() dto: CreateStudyDto) {
    const study = await this.studyService.createStudy(dto);
    return { data: study };
  }

  /** 스터디 상세 조회 */
  @Get('studies/:id')
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    const study = await this.studyService.findById(id);
    return { data: study };
  }

  /** 사용자 참여 스터디 목록 */
  @Get('studies/by-user/:userId')
  async findByUserId(@Param('userId', ParseUUIDPipe) userId: string) {
    const studies = await this.studyService.findByUserId(userId);
    return { data: studies };
  }

  /** 스터디 수정 */
  @Put('studies/:id')
  async updateStudy(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStudyDto,
  ) {
    const study = await this.studyService.updateStudy(id, dto);
    return { data: study };
  }

  /** 스터디 삭제 */
  @Delete('studies/:id')
  async deleteStudy(@Param('id', ParseUUIDPipe) id: string) {
    await this.studyService.deleteStudy(id);
    return { data: { success: true } };
  }

  // ─── StudyMember 관리 ────────────────────────────

  /** 멤버 추가 */
  @Post('studies/:id/members')
  async addMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddMemberDto,
  ) {
    const member = await this.studyService.addMember(
      id,
      dto.userId,
      dto.nickname,
      dto.role,
    );
    return { data: member };
  }

  /** 전체 멤버 목록 */
  @Get('studies/:id/members')
  async getMembers(@Param('id', ParseUUIDPipe) id: string) {
    const members = await this.studyService.getMembers(id);
    return { data: members };
  }

  /** 멤버 단건 조회 */
  @Get('studies/:id/members/:userId')
  async getMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    const member = await this.studyService.getMember(id, userId);
    return { data: member };
  }

  /** 멤버 제거 */
  @Delete('studies/:id/members/:userId')
  async removeMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    await this.studyService.removeMember(id, userId);
    return { data: { success: true } };
  }

  /** 멤버 역할 변경 */
  @Patch('studies/:id/members/:userId/role')
  async changeRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: ChangeRoleDto,
  ) {
    const member = await this.studyService.changeRole(id, userId, dto.role);
    return { data: member };
  }

  /** 멤버 닉네임 수정 */
  @Patch('studies/:id/members/:userId/nickname')
  async updateNickname(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateNicknameDto,
  ) {
    const member = await this.studyService.updateNickname(id, userId, dto.nickname);
    return { data: member };
  }

  // ─── StudyInvite 관리 ────────────────────────────

  /** 초대 생성 */
  @Post('studies/:id/invites')
  async createInvite(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateInviteDto,
  ) {
    const invite = await this.studyService.createInvite({
      study_id: id,
      created_by: dto.created_by,
      expires_at: new Date(dto.expires_at),
      max_uses: dto.max_uses,
    });
    return { data: invite };
  }

  /** 코드로 초대 조회 */
  @Get('invites/by-code/:code')
  async findInviteByCode(@Param('code') code: string) {
    const invite = await this.studyService.findInviteByCode(code);
    return { data: invite };
  }

  /** 초대 사용 횟수 증가 */
  @Patch('invites/:id/consume')
  async consumeInvite(@Param('id', ParseUUIDPipe) id: string) {
    const invite = await this.studyService.consumeInvite(id);
    return { data: invite };
  }
}
