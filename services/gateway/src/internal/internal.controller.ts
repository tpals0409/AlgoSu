/**
 * @file Internal API 컨트롤러 — 서비스 간 내부 통신 엔드포인트
 * @domain common
 * @layer controller
 * @related internal-key.guard.ts, oauth.service.ts, study.entity.ts
 */
import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { InternalKeyGuard } from '../common/guards/internal-key.guard';
import { IdentityClientService } from '../identity-client/identity-client.service';

@ApiExcludeController()
@Controller('internal')
@UseGuards(InternalKeyGuard)
export class InternalController {
  constructor(
    private readonly identityClient: IdentityClientService,
  ) {}

  /**
   * GET /internal/users/:user_id/github-status
   * X-Internal-Key 검증 필수
   */
  @Get('users/:user_id/github-status')
  async getGitHubStatus(
    @Param('user_id', ParseUUIDPipe) userId: string,
  ): Promise<{ github_connected: boolean; github_username: string | null }> {
    return this.identityClient.getGitHubStatus(userId) as Promise<{ github_connected: boolean; github_username: string | null }>;
  }

  /**
   * GET /internal/users/:user_id/github-encrypted-token
   * GitHub Worker가 유저의 암호화된 토큰 조회 시 사용 (p0-010)
   */
  @Get('users/:user_id/github-encrypted-token')
  async getEncryptedGitHubToken(
    @Param('user_id', ParseUUIDPipe) userId: string,
  ): Promise<{ github_username: string | null; encrypted_token: string | null }> {
    return this.identityClient.getEncryptedGitHubToken(userId) as Promise<{ github_username: string | null; encrypted_token: string | null }>;
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
    let member: Record<string, unknown> | null = null;
    try {
      member = await this.identityClient.getMember(studyId, userId);
    } catch {
      member = null;
    }

    if (!member) {
      throw new NotFoundException('스터디 멤버가 아닙니다.');
    }

    return { role: String(member['role'] ?? 'MEMBER') };
  }

  /**
   * GET /internal/studies/:studyId
   * GitHub Worker가 스터디의 github_repo 조회 시 사용
   */
  @Get('studies/:studyId')
  async getStudyGithubRepo(
    @Param('studyId', ParseUUIDPipe) studyId: string,
  ): Promise<{ data: { github_repo: string | null } }> {
    let study: Record<string, unknown> | null = null;
    try {
      study = await this.identityClient.findStudyById(studyId);
    } catch {
      study = null;
    }

    if (!study) {
      throw new NotFoundException('스터디를 찾을 수 없습니다.');
    }

    return { data: { github_repo: (study['github_repo'] as string | null) ?? null } };
  }
}
