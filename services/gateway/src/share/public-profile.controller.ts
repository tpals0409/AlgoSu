/**
 * @file 퍼블릭 프로필 컨트롤러 — slug 기반 공개 프로필 조회
 * @domain share
 * @layer controller
 * @related share-link.service.ts, identity-client.service.ts
 *
 * 보안: JWT 미들웨어 제외, 인증 불필요
 * 비공개 프로필: 404 (정보 누출 방지)
 * 민감 정보(email, github_token) 미반환
 */
import {
  Controller,
  Get,
  Param,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { IdentityClientService } from '../identity-client/identity-client.service';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';

@ApiTags('Public Profile')
@Controller('api/public/profile')
export class PublicProfileController {
  private readonly submissionServiceUrl: string;
  private readonly submissionServiceKey: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly identityClient: IdentityClientService,
    private readonly logger: StructuredLoggerService,
  ) {
    this.logger.setContext(PublicProfileController.name);
    this.submissionServiceUrl = this.configService.get<string>('SUBMISSION_SERVICE_URL', 'http://localhost:3003');
    this.submissionServiceKey = this.configService.getOrThrow<string>('INTERNAL_KEY_SUBMISSION');
  }

  @ApiOperation({ summary: '퍼블릭 프로필 조회 (slug 기반)' })
  @ApiResponse({ status: 200, description: '프로필 데이터' })
  @ApiResponse({ status: 404, description: '비공개 또는 미존재' })
  @Get(':slug')
  async getPublicProfile(@Param('slug') slug: string) {
    /* slug 형식 검증 */
    if (!/^[a-z0-9][a-z0-9-]{1,18}[a-z0-9]$/.test(slug)) {
      throw new NotFoundException('프로필을 찾을 수 없습니다.');
    }

    /* 유저 조회 — 비공개/미존재 모두 404 */
    let user: Record<string, unknown>;
    try {
      user = await this.identityClient.findUserBySlug(slug);
    } catch {
      throw new NotFoundException('프로필을 찾을 수 없습니다.');
    }
    if (!user) {
      throw new NotFoundException('프로필을 찾을 수 없습니다.');
    }

    const userId = user.id as string;

    /* 참여 스터디 목록 — Identity 서비스에서 조회 */
    let studies: Record<string, unknown>[];
    try {
      studies = await this.identityClient.findStudiesByUserId(userId);
    } catch {
      studies = [];
    }

    /* 빈 스터디 조기 반환 */
    if (studies.length === 0) {
      return {
        data: {
          name: user.name,
          avatarUrl: user.avatar_url,
          studies: [],
          totalSubmissions: 0,
          averageAiScore: null,
        },
      };
    }

    /* 스터디별 멤버 수 + 공유 링크 (병렬 조회) */
    const studyResults = await Promise.all(
      studies.map(async (study) => {
        const studyId = study.id as string;
        const [members, shareLinks, stats] = await Promise.all([
          this.identityClient.getMembers(studyId).catch(() => []),
          this.identityClient.findShareLinksByUserAndStudy(userId, studyId).catch(() => []),
          this.fetchUserStudyStats(userId, studyId),
        ]);

        const latestShareLink = (shareLinks as Record<string, unknown>[]).length > 0
          ? shareLinks[0] as Record<string, unknown>
          : null;

        return {
          studyName: (study.name as string) ?? '알 수 없는 스터디',
          memberCount: (members as Record<string, unknown>[]).length,
          shareLink: latestShareLink ? `/shared/${latestShareLink.token as string}` : null,
          totalSubmissions: stats.totalSubmissions,
          averageAiScore: stats.averageAiScore,
        };
      }),
    );

    /* 전체 통계 집계 */
    const totalSubmissions = studyResults.reduce((sum, s) => sum + s.totalSubmissions, 0);
    const scoresWithValues = studyResults.filter((s) => s.averageAiScore !== null);
    const averageAiScore =
      scoresWithValues.length > 0
        ? Math.round(
            (scoresWithValues.reduce((sum, s) => sum + (s.averageAiScore ?? 0), 0) /
              scoresWithValues.length) *
              10,
          ) / 10
        : null;

    return {
      data: {
        name: user.name,
        avatarUrl: user.avatar_url,
        studies: studyResults,
        totalSubmissions,
        averageAiScore,
      },
    };
  }

  /** Submission Service에서 유저별 스터디 통계 조회 */
  private async fetchUserStudyStats(
    userId: string,
    studyId: string,
  ): Promise<{ totalSubmissions: number; averageAiScore: number | null }> {
    try {
      const response = await fetch(
        `${this.submissionServiceUrl}/internal/stats/${studyId}?userId=${encodeURIComponent(userId)}`,
        {
          method: 'GET',
          headers: {
            'X-Internal-Key': this.submissionServiceKey,
            'Content-Type': 'application/json',
          },
        },
      );

      if (!response.ok) {
        return { totalSubmissions: 0, averageAiScore: null };
      }

      const body = (await response.json()) as {
        data: { totalSubmissions: number; averageScore: number | null };
      };
      return {
        totalSubmissions: body.data?.totalSubmissions ?? 0,
        averageAiScore: body.data?.averageScore ?? null,
      };
    } catch {
      this.logger.warn(`Submission Service 통계 조회 실패: studyId=${studyId}`);
      return { totalSubmissions: 0, averageAiScore: null };
    }
  }
}
