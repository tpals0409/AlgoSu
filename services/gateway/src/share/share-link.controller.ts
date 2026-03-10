/**
 * @file ShareLink 컨트롤러 — 공유 링크 CRUD + 프로필 설정
 * @domain share
 * @layer controller
 * @related share-link.service.ts, share-link.entity.ts
 */
import {
  Controller,
  Get,
  Post,
  Delete,
  Put,
  Body,
  Param,
  Req,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Request } from 'express';
import { ShareLinkService } from './share-link.service';
import { CreateShareLinkDto } from './dto/create-share-link.dto';
import { UpdateProfileSettingsDto } from './dto/update-profile-settings.dto';
import { StudyMemberGuard } from '../common/guards/study-member.guard';

@ApiTags('ShareLink')
@Controller('api')
export class ShareLinkController {
  constructor(private readonly shareLinkService: ShareLinkService) {}

  /* ───────────────── ShareLink CRUD (W1-2) ───────────────── */

  @ApiOperation({ summary: '공유 링크 생성' })
  @ApiResponse({ status: 201, description: '공유 링크 생성 완료' })
  @Post('studies/:studyId/share-links')
  @UseGuards(StudyMemberGuard)
  async createShareLink(
    @Param('studyId', ParseUUIDPipe) studyId: string,
    @Body() dto: CreateShareLinkDto,
    @Req() req: Request,
  ) {
    const userId = req.headers['x-user-id'] as string;
    return this.shareLinkService.createShareLink(studyId, userId, dto);
  }

  @ApiOperation({ summary: '스터디별 공유 링크 목록 조회' })
  @ApiResponse({ status: 200, description: '활성 공유 링크 목록' })
  @Get('studies/:studyId/share-links')
  @UseGuards(StudyMemberGuard)
  async getShareLinks(
    @Param('studyId', ParseUUIDPipe) studyId: string,
  ) {
    return this.shareLinkService.getShareLinks(studyId);
  }

  @ApiOperation({ summary: '공유 링크 비활성화' })
  @ApiResponse({ status: 200, description: '비활성화 완료' })
  @Delete('studies/:studyId/share-links/:linkId')
  @UseGuards(StudyMemberGuard)
  async deactivateShareLink(
    @Param('studyId', ParseUUIDPipe) studyId: string,
    @Param('linkId', ParseUUIDPipe) linkId: string,
    @Req() req: Request,
  ) {
    const userId = req.headers['x-user-id'] as string;
    return this.shareLinkService.deactivateShareLink(linkId, studyId, userId);
  }

  /* ───────────────── Profile Settings (W1-5) ───────────────── */

  @ApiOperation({ summary: '프로필 설정 조회' })
  @ApiResponse({ status: 200, description: '프로필 설정 반환' })
  @Get('users/me/settings')
  async getProfileSettings(@Req() req: Request) {
    const userId = req.headers['x-user-id'] as string;
    return this.shareLinkService.getProfileSettings(userId);
  }

  @ApiOperation({ summary: '프로필 설정 업데이트 (slug + 공개 토글)' })
  @ApiResponse({ status: 200, description: '업데이트 완료' })
  @ApiResponse({ status: 400, description: '유효하지 않은 slug 또는 공개 조건 미충족' })
  @ApiResponse({ status: 409, description: 'slug 중복' })
  @Put('users/me/settings/profile')
  async updateProfileSettings(
    @Req() req: Request,
    @Body() dto: UpdateProfileSettingsDto,
  ) {
    const userId = req.headers['x-user-id'] as string;
    return this.shareLinkService.updateProfileSettings(userId, dto);
  }
}
