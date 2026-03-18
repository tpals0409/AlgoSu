/**
 * @file ShareLink 서비스 — 공유 링크 CRUD + 토큰 검증
 * @domain share
 * @layer service
 * @related share-link.controller.ts, identity-client.service.ts
 */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { CreateShareLinkDto } from './dto/create-share-link.dto';
import { UpdateProfileSettingsDto } from './dto/update-profile-settings.dto';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';
import { IdentityClientService } from '../identity-client/identity-client.service';

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
    private readonly identityClient: IdentityClientService,
    private readonly logger: StructuredLoggerService,
  ) {
    this.logger.setContext(ShareLinkService.name);
  }

  /* ───────────────── ShareLink CRUD (W1-2) ───────────────── */

  /** 공유 링크 생성 — Identity 서비스 위임 */
  async createShareLink(
    studyId: string,
    userId: string,
    dto: CreateShareLinkDto,
  ): Promise<Record<string, unknown>> {
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;

    if (expiresAt && expiresAt <= new Date()) {
      throw new BadRequestException('만료 일시는 현재 시간 이후여야 합니다.');
    }

    const saved = await this.identityClient.createShareLink({
      study_id: studyId,
      created_by: userId,
      expires_at: dto.expiresAt,
    });

    this.logger.log(`공유 링크 생성: studyId=${studyId}, userId=${userId}`);
    return saved;
  }

  /** 본인이 생성한 활성 공유 링크 목록 조회 */
  async getShareLinks(studyId: string, userId: string): Promise<Record<string, unknown>[]> {
    return this.identityClient.findShareLinksByUserAndStudy(userId, studyId);
  }

  /** 공유 링크 비활성화 (soft delete) — Identity 서비스 위임 */
  async deactivateShareLink(
    linkId: string,
    _studyId: string,
    userId: string,
  ): Promise<{ message: string }> {
    const result = await this.identityClient.deactivateShareLink(linkId, userId);
    this.logger.log(`공유 링크 비활성화: linkId=${linkId}, userId=${userId}`);
    return result as { message: string };
  }

  /** 토큰으로 공유 링크 검증 — 유효하면 ShareLink 반환, 아니면 null */
  async verifyToken(token: string): Promise<Record<string, unknown> | null> {
    return this.identityClient.verifyShareLinkToken(token);
  }

  /* ───────────────── Profile Settings (W1-5) ───────────────── */

  /** 현재 프로필 설정 조회 */
  async getProfileSettings(userId: string): Promise<{
    profileSlug: string | null;
    isProfilePublic: boolean;
  }> {
    const user = await this.identityClient.findUserById(userId);
    if (!user) throw new NotFoundException('사용자를 찾을 수 없습니다.');

    return {
      profileSlug: (user as Record<string, unknown>).profile_slug as string | null,
      isProfilePublic: (user as Record<string, unknown>).is_profile_public as boolean,
    };
  }

  /** 프로필 설정 업데이트 — slug + 공개 토글 */
  async updateProfileSettings(
    userId: string,
    dto: UpdateProfileSettingsDto,
  ): Promise<{ profileSlug: string | null; isProfilePublic: boolean }> {
    /* slug 예약어 검증 (Gateway 레벨 선검증) */
    if (dto.profileSlug !== undefined) {
      this.validateSlug(dto.profileSlug);
    }

    /* Identity 서비스에 위임 — slug 중복/공개 조건 검증 포함 */
    const result = await this.identityClient.updateProfileSettings(userId, {
      publicId: dto.profileSlug,
      is_profile_public: dto.isProfilePublic,
    });

    this.logger.log(`프로필 설정 업데이트: userId=${userId}`);

    return {
      profileSlug: (result as Record<string, unknown>).profileSlug as string | null,
      isProfilePublic: (result as Record<string, unknown>).isProfilePublic as boolean,
    };
  }

  /** slug 유효성 검증 — 예약어 차단 */
  private validateSlug(slug: string): void {
    if (RESERVED_SLUGS.includes(slug.toLowerCase())) {
      throw new BadRequestException(`"${slug}"은(는) 사용할 수 없는 예약어입니다.`);
    }
  }
}
