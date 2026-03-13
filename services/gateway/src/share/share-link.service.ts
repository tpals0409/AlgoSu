/**
 * @file ShareLink 서비스 — 공유 링크 CRUD + 토큰 검증
 * @domain share
 * @layer service
 * @related share-link.controller.ts, share-link.entity.ts
 */
import { randomBytes } from 'crypto';
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, MoreThanOrEqual, Or } from 'typeorm';
import { ShareLink } from './share-link.entity';
import { User } from '../auth/oauth/user.entity';
import { StudyMember, StudyMemberRole } from '../study/study.entity';
import { CreateShareLinkDto } from './dto/create-share-link.dto';
import { UpdateProfileSettingsDto } from './dto/update-profile-settings.dto';
import { SHARE_LINK_TOKEN_REGEX } from './share-link.constants';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';

/** slug 예약어 — Next.js 라우트 + 시스템 경로 */
const RESERVED_SLUGS = [
  'admin', 'api', 'public', 'shared', 'login', 'logout',
  'settings', 'profile', 'studies', 'submissions', 'analysis',
  'auth', 'oauth', 'callback', 'refresh', 'join', 'invite',
  'health', 'metrics', 'sse', 'internal', 'dashboard',
  'app', 'index', 'error', 'not-found', '404', '500',
  'undefined', 'null', 'false', 'true',
];

@Injectable()
export class ShareLinkService {
  constructor(
    @InjectRepository(ShareLink)
    private readonly shareLinkRepository: Repository<ShareLink>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(StudyMember)
    private readonly memberRepository: Repository<StudyMember>,
    private readonly logger: StructuredLoggerService,
  ) {
    this.logger.setContext(ShareLinkService.name);
  }

  /* ───────────────── ShareLink CRUD (W1-2) ───────────────── */

  /** 공유 링크 생성 — 토큰 256bit hex */
  async createShareLink(
    studyId: string,
    userId: string,
    dto: CreateShareLinkDto,
  ): Promise<ShareLink> {
    const token = randomBytes(32).toString('hex');
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;

    if (expiresAt && expiresAt <= new Date()) {
      throw new BadRequestException('만료 일시는 현재 시간 이후여야 합니다.');
    }

    const shareLink = this.shareLinkRepository.create({
      token,
      study_id: studyId,
      created_by: userId,
      expires_at: expiresAt,
      is_active: true,
    });

    const saved = await this.shareLinkRepository.save(shareLink);
    this.logger.log(`공유 링크 생성: studyId=${studyId}, userId=${userId}`);
    return saved;
  }

  /** 본인이 생성한 활성 공유 링크 목록 조회 */
  async getShareLinks(studyId: string, userId: string): Promise<ShareLink[]> {
    return this.shareLinkRepository.find({
      where: {
        study_id: studyId,
        created_by: userId,
        is_active: true,
        expires_at: Or(IsNull(), MoreThanOrEqual(new Date())),
      },
      order: { created_at: 'DESC' },
    });
  }

  /** 공유 링크 비활성화 (soft delete) — 생성자 본인 또는 ADMIN */
  async deactivateShareLink(
    linkId: string,
    studyId: string,
    userId: string,
  ): Promise<{ message: string }> {
    const link = await this.shareLinkRepository.findOne({
      where: { id: linkId, study_id: studyId, is_active: true },
    });

    if (!link) {
      throw new NotFoundException('공유 링크를 찾을 수 없습니다.');
    }

    if (link.created_by !== userId) {
      const member = await this.memberRepository.findOne({
        where: { study_id: studyId, user_id: userId },
      });
      if (!member || member.role !== StudyMemberRole.ADMIN) {
        throw new ForbiddenException('링크 생성자 또는 ADMIN만 비활성화할 수 있습니다.');
      }
    }

    link.is_active = false;
    await this.shareLinkRepository.save(link);
    this.logger.log(`공유 링크 비활성화: linkId=${linkId}, userId=${userId}`);
    return { message: '공유 링크가 비활성화되었습니다.' };
  }

  /** 토큰으로 공유 링크 검증 — 유효하면 ShareLink 반환, 아니면 null */
  async verifyToken(token: string): Promise<ShareLink | null> {
    if (!SHARE_LINK_TOKEN_REGEX.test(token)) {
      return null;
    }

    const link = await this.shareLinkRepository.findOne({
      where: { token, is_active: true },
    });

    if (!link) return null;
    if (link.expires_at && link.expires_at < new Date()) return null;

    return link;
  }

  /* ───────────────── Profile Settings (W1-5) ───────────────── */

  /** 현재 프로필 설정 조회 */
  async getProfileSettings(userId: string): Promise<{
    profileSlug: string | null;
    isProfilePublic: boolean;
  }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('사용자를 찾을 수 없습니다.');

    return {
      profileSlug: user.profile_slug,
      isProfilePublic: user.is_profile_public,
    };
  }

  /** 프로필 설정 업데이트 — slug + 공개 토글 */
  async updateProfileSettings(
    userId: string,
    dto: UpdateProfileSettingsDto,
  ): Promise<{ profileSlug: string | null; isProfilePublic: boolean }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('사용자를 찾을 수 없습니다.');

    /* slug 업데이트 */
    if (dto.profileSlug !== undefined) {
      this.validateSlug(dto.profileSlug);

      const existing = await this.userRepository.findOne({
        where: { profile_slug: dto.profileSlug },
      });
      if (existing && existing.id !== userId) {
        throw new ConflictException(`slug "${dto.profileSlug}"는 이미 사용 중입니다.`);
      }

      user.profile_slug = dto.profileSlug;
    }

    /* 공개 토글 */
    if (dto.isProfilePublic !== undefined) {
      if (dto.isProfilePublic && !user.profile_slug && !dto.profileSlug) {
        throw new BadRequestException(
          '프로필 공개를 위해서는 먼저 프로필 URL(slug)을 설정해야 합니다.',
        );
      }
      user.is_profile_public = dto.isProfilePublic;
    }

    await this.userRepository.save(user);
    this.logger.log(`프로필 설정 업데이트: userId=${userId}`);

    return {
      profileSlug: user.profile_slug,
      isProfilePublic: user.is_profile_public,
    };
  }

  /** slug 유효성 검증 — 예약어 차단 */
  private validateSlug(slug: string): void {
    if (RESERVED_SLUGS.includes(slug.toLowerCase())) {
      throw new BadRequestException(`"${slug}"은(는) 사용할 수 없는 예약어입니다.`);
    }
  }
}
