/**
 * @file ShareLink 컨트롤러 — 내부 API (InternalKeyGuard 보호)
 * @domain share
 * @layer controller
 * @related share-link.service.ts, internal-key.guard.ts
 */
import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ShareLinkService } from './share-link.service';
import { InternalKeyGuard } from '../common/guards/internal-key.guard';
import { CreateShareLinkDto } from './dto/create-share-link.dto';
import { DeactivateShareLinkDto } from './dto/deactivate-share-link.dto';
import { ShareLink } from './share-link.entity';

@Controller('api/share-links')
@UseGuards(InternalKeyGuard)
export class ShareLinkController {
  constructor(private readonly shareLinkService: ShareLinkService) {}

  /** 공유 링크 생성 */
  @Post()
  async create(@Body() dto: CreateShareLinkDto): Promise<ShareLink> {
    return this.shareLinkService.create({
      study_id: dto.study_id,
      created_by: dto.created_by,
      expires_at: dto.expires_at,
    });
  }

  /** 사용자의 활성 공유 링크 목록 조회 */
  @Get('by-user/:userId/study/:studyId')
  async findByUserAndStudy(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('studyId', ParseUUIDPipe) studyId: string,
  ): Promise<ShareLink[]> {
    return this.shareLinkService.findByUserAndStudy(userId, studyId);
  }

  /** 공유 링크 비활성화 */
  @Patch(':id/deactivate')
  async deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DeactivateShareLinkDto,
  ): Promise<{ message: string }> {
    return this.shareLinkService.deactivate(id, dto.userId);
  }

  /** 토큰으로 공유 링크 검증 */
  @Get('by-token/:token')
  async verifyToken(
    @Param('token') token: string,
  ): Promise<ShareLink | null> {
    return this.shareLinkService.verifyToken(token);
  }
}
