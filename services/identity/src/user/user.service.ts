/**
 * @file User 서비스 — OAuth 사용자 CRUD + GitHub 연동 + 프로필 설정
 * @domain identity
 * @layer service
 * @related user.entity.ts, user.controller.ts, token-encryption.service.ts
 */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import * as crypto from 'crypto';
import { User, OAuthProvider } from './user.entity';
import { UpsertUserDto } from './dto/upsert-user.dto';
import { UpdateProfileSettingsDto } from './dto/update-profile-settings.dto';
import { TokenEncryptionService } from './token-encryption.service';
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
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly tokenEncryptionService: TokenEncryptionService,
    private readonly logger: StructuredLoggerService,
  ) {
    this.logger.setContext(UserService.name);
  }

  /** ID로 사용자 조회 (deleted_at IS NULL) */
  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id, deleted_at: IsNull() },
    });
  }

  /**
   * 이메일로 사용자 조회 — deleted_at 필터링 제외 (의도적)
   * @warning 일반 조회에 부적합. upsertUser 내부에서만 사용 — 탈퇴 계정 복구 전용
   * @see upsertUser
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  /**
   * OAuth 로그인 시 생성/조회 — 1계정1OAuth 정책
   * 탈퇴 계정(deleted_at) 복구 로직 포함
   */
  async upsertUser(dto: UpsertUserDto): Promise<User> {
    const existing = await this.userRepository.findOne({
      where: { email: dto.email },
    });

    this.validateOneAccountOneOAuth(existing, dto.oauth_provider);

    if (existing?.deleted_at) {
      return this.restoreDeletedUser(existing, dto);
    }

    return this.atomicUpsert(dto);
  }

  /** 프로필 업데이트 (name, avatar_url) */
  async updateUser(
    id: string,
    data: Partial<{ name: string; avatar_url: string }>,
  ): Promise<User> {
    const user = await this.findByIdOrThrow(id);
    Object.assign(user, data);
    return this.userRepository.save(user);
  }

  /** 소프트 삭제 + study_members, notifications 관계 정리 */
  async softDeleteUser(id: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user || user.deleted_at) return; // 멱등성

    const anonymizedEmail = `deleted_${crypto.randomUUID()}@withdrawn.local`;
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.query(
        `UPDATE users SET deleted_at = $1, email = $2, name = $3, avatar_url = $4, github_connected = $5, github_user_id = $6, github_username = $7, github_token = $8 WHERE id = $9`,
        [new Date(), anonymizedEmail, '탈퇴한 사용자', null, false, null, null, null, id],
      );
      await queryRunner.query(`DELETE FROM study_members WHERE user_id = $1`, [id]);
      await queryRunner.query(`DELETE FROM notifications WHERE user_id = $1`, [id]);
      await queryRunner.commitTransaction();
      this.logger.log(`사용자 소프트 삭제 완료: userId=${id}`);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /** GitHub 연동/해제 */
  async updateGitHub(
    id: string,
    data: { connected: boolean; user_id?: string | null; username?: string | null; token?: string | null } | null,
  ): Promise<void> {
    await this.findByIdOrThrow(id);

    if (!data || !data.connected) {
      await this.userRepository.update(id, {
        github_connected: false,
        github_user_id: null,
        github_username: null,
        github_token: null,
      });
      return;
    }

    // P0 보안: 토큰은 DB 저장 전 AES-256-GCM 암호화 필수 (audit-20260422-p0-009)
    // 복호화는 github-worker TokenManager.decryptUserToken()에서만 수행
    const encryptedToken = data.token
      ? this.tokenEncryptionService.encrypt(data.token)
      : null;

    await this.userRepository.update(id, {
      github_connected: true,
      github_user_id: data.user_id ?? null,
      github_username: data.username ?? null,
      github_token: encryptedToken,
    });
  }

  /** GitHub 연동 상태 조회 */
  async getGitHubStatus(
    id: string,
  ): Promise<{ github_connected: boolean; github_username: string | null }> {
    const user = await this.findByIdOrThrow(id);
    return {
      github_connected: user.github_connected,
      github_username: user.github_username,
    };
  }

  /** GitHub 토큰 정보 조회 (암호화된 상태 그대로 반환) */
  async getGitHubTokenInfo(
    id: string,
  ): Promise<{ github_username: string | null; github_token: string | null }> {
    const user = await this.findByIdOrThrow(id);
    return {
      github_username: user.github_username,
      github_token: user.github_token,
    };
  }

  /** slug 기반 공개 프로필 조회 (is_profile_public=true) */
  async findBySlug(slug: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { profile_slug: slug, is_profile_public: true, deleted_at: IsNull() },
    });
  }

  /** 프로필 설정 업데이트 — slug + 공개 토글 */
  async updateProfileSettings(
    id: string,
    dto: UpdateProfileSettingsDto,
  ): Promise<{ profileSlug: string | null; isProfilePublic: boolean }> {
    const user = await this.findByIdOrThrow(id);

    if (dto.profileSlug !== undefined) {
      await this.validateAndSetSlug(user, dto.profileSlug);
    }

    if (dto.isProfilePublic !== undefined) {
      this.validatePublicToggle(user, dto);
      user.is_profile_public = dto.isProfilePublic;
    }

    await this.userRepository.save(user);
    this.logger.log(`프로필 설정 업데이트: userId=${id}`);

    return {
      profileSlug: user.profile_slug,
      isProfilePublic: user.is_profile_public,
    };
  }

  // ─── Private Helpers ───

  /** ID로 조회 — 없으면 NotFoundException */
  private async findByIdOrThrow(id: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id, deleted_at: IsNull() },
    });
    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }
    return user;
  }

  /** 1계정1OAuth 정책 검증 */
  private validateOneAccountOneOAuth(
    existing: User | null,
    provider: OAuthProvider,
  ): void {
    if (!existing || existing.oauth_provider === provider) return;

    const providerLabel: Record<string, string> = {
      google: 'Google', naver: 'Naver', kakao: 'Kakao',
    };
    throw new BadRequestException(
      `이 이메일은 이미 ${providerLabel[existing.oauth_provider] ?? existing.oauth_provider}(으)로 가입되어 있습니다. 기존 계정으로 로그인해주세요.`,
    );
  }

  /** 탈퇴 유저 계정 복구 */
  private async restoreDeletedUser(
    existing: User,
    dto: UpsertUserDto,
  ): Promise<User> {
    await this.userRepository.update(existing.id, {
      deleted_at: null,
      name: dto.name ?? null,
      avatar_url: 'preset:default',
      github_connected: false,
    });
    this.logger.log(`탈퇴 계정 복구: userId=${existing.id}`);
    return this.userRepository.findOne({ where: { id: existing.id } }) as Promise<User>;
  }

  /** ON CONFLICT 원자적 upsert */
  private async atomicUpsert(dto: UpsertUserDto): Promise<User> {
    await this.userRepository
      .createQueryBuilder()
      .insert()
      .into(User)
      .values({
        email: dto.email,
        name: dto.name ?? null,
        avatar_url: 'preset:default',
        oauth_provider: dto.oauth_provider,
        github_connected: false,
        publicId: crypto.randomUUID(),
      })
      .orUpdate(['name'], ['email'])
      .execute();

    return this.userRepository.findOne({ where: { email: dto.email } }) as Promise<User>;
  }

  /** slug 유효성 검증 + 중복 확인 + 설정 */
  private async validateAndSetSlug(user: User, slug: string): Promise<void> {
    if (RESERVED_SLUGS.includes(slug.toLowerCase())) {
      throw new BadRequestException(`"${slug}"은(는) 사용할 수 없는 예약어입니다.`);
    }

    const existing = await this.userRepository.findOne({
      where: { profile_slug: slug },
    });
    if (existing && existing.id !== user.id) {
      throw new ConflictException(`slug "${slug}"는 이미 사용 중입니다.`);
    }

    user.profile_slug = slug;
  }

  /** 공개 토글 검증 — slug 없이 공개 불가 */
  private validatePublicToggle(
    user: User,
    dto: UpdateProfileSettingsDto,
  ): void {
    if (dto.isProfilePublic && !user.profile_slug && !dto.profileSlug) {
      throw new BadRequestException(
        '프로필 공개를 위해서는 먼저 프로필 URL(slug)을 설정해야 합니다.',
      );
    }
  }
}
