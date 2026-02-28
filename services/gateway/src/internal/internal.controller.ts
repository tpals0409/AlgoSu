import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { InternalKeyGuard } from '../common/guards/internal-key.guard';
import { OAuthService } from '../auth/oauth/oauth.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StudyMember } from '../study/study.entity';

@Controller('internal')
@UseGuards(InternalKeyGuard)
export class InternalController {
  constructor(
    private readonly oauthService: OAuthService,
    @InjectRepository(StudyMember)
    private readonly memberRepository: Repository<StudyMember>,
  ) {}

  /**
   * GET /internal/users/:user_id/github-status
   * X-Internal-Key 검증 필수
   */
  @Get('users/:user_id/github-status')
  async getGitHubStatus(
    @Param('user_id', ParseUUIDPipe) userId: string,
  ): Promise<{ github_connected: boolean; github_username: string | null }> {
    return this.oauthService.getGitHubStatus(userId);
  }

  /**
   * GET /internal/studies/:study_id/members/:user_id
   * 스터디 멤버십 조회 — 하위 서비스 StudyMemberGuard에서 호출
   * 멤버면 { role: 'ADMIN' | 'MEMBER' } 반환, 비멤버면 404
   */
  @Get('studies/:study_id/members/:user_id')
  async checkMembership(
    @Param('study_id', ParseUUIDPipe) studyId: string,
    @Param('user_id', ParseUUIDPipe) userId: string,
  ): Promise<{ role: string }> {
    const member = await this.memberRepository.findOne({
      where: { study_id: studyId, user_id: userId },
    });

    if (!member) {
      throw new NotFoundException('스터디 멤버가 아닙니다.');
    }

    return { role: member.role };
  }
}
