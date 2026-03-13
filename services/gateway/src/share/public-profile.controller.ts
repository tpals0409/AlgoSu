/**
 * @file 퍼블릭 프로필 컨트롤러 — slug 기반 공개 프로필 조회
 * @domain share
 * @layer controller
 * @related share-link.service.ts, user.entity.ts
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
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull, MoreThanOrEqual, Or } from 'typeorm';
import { User } from '../auth/oauth/user.entity';
import { StudyMember } from '../study/study.entity';
import { ShareLink } from './share-link.entity';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';

@ApiTags('Public Profile')
@Controller('api/public/profile')
export class PublicProfileController {
  private readonly submissionServiceUrl: string;
  private readonly submissionServiceKey: string;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(StudyMember)
    private readonly memberRepository: Repository<StudyMember>,
    @InjectRepository(ShareLink)
    private readonly shareLinkRepository: Repository<ShareLink>,
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
    const user = await this.userRepository.findOne({
      where: { profile_slug: slug, is_profile_public: true },
    });
    if (!user) {
      throw new NotFoundException('프로필을 찾을 수 없습니다.');
    }

    /* 참여 스터디 목록 */
    const memberships = await this.memberRepository.find({
      where: { user_id: user.id },
      relations: ['study'],
    });

    /* 스터디별 통계 + 공유 링크 (배치 쿼리 최적화) */
    const studyIds = memberships.map((m) => m.study_id);

    /* 빈 memberships 조기 반환 */
    if (studyIds.length === 0) {
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

    /* 배치 1: 스터디별 멤버 수 — 1회 쿼리 */
    const memberCountRows: { study_id: string; cnt: string }[] =
      await this.memberRepository
        .createQueryBuilder('sm')
        .select('sm.study_id', 'study_id')
        .addSelect('COUNT(*)', 'cnt')
        .where('sm.study_id IN (:...studyIds)', { studyIds })
        .groupBy('sm.study_id')
        .getRawMany();

    const memberCountMap = new Map<string, number>(
      memberCountRows.map((r) => [r.study_id, Number(r.cnt)]),
    );

    /* 배치 2: 유저의 활성 공유 링크 — 1회 쿼리 */
    const shareLinks = await this.shareLinkRepository.find({
      where: {
        study_id: In(studyIds),
        created_by: user.id,
        is_active: true,
        expires_at: Or(IsNull(), MoreThanOrEqual(new Date())),
      },
      order: { created_at: 'DESC' },
    });

    /* study_id → 최신 shareLink (find는 created_at DESC 정렬이므로 첫 매칭이 최신) */
    const shareLinkMap = new Map<string, ShareLink>();
    for (const sl of shareLinks) {
      if (!shareLinkMap.has(sl.study_id)) {
        shareLinkMap.set(sl.study_id, sl);
      }
    }

    /* 배치 3: Submission Service 통계 — Promise.all (외부 서비스) */
    const statsResults = await Promise.all(
      memberships.map((m) => this.fetchUserStudyStats(user.id, m.study_id)),
    );

    const studies = memberships.map((m, i) => {
      const shareLink = shareLinkMap.get(m.study_id);
      return {
        studyName: m.study?.name ?? '알 수 없는 스터디',
        memberCount: memberCountMap.get(m.study_id) ?? 0,
        shareLink: shareLink ? `/shared/${shareLink.token}` : null,
        totalSubmissions: statsResults[i].totalSubmissions,
        averageAiScore: statsResults[i].averageAiScore,
      };
    });

    /* 전체 통계 집계 */
    const totalSubmissions = studies.reduce((sum, s) => sum + s.totalSubmissions, 0);
    const scoresWithValues = studies.filter((s) => s.averageAiScore !== null);
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
        studies,
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
