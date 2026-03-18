import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ShareLinkService } from './share-link.service';
import { IdentityClientService } from '../identity-client/identity-client.service';

jest.mock('crypto', () => ({
  randomBytes: jest.fn().mockReturnValue({
    toString: jest.fn().mockReturnValue('a'.repeat(64)),
  }),
}));

describe('ShareLinkService', () => {
  let service: ShareLinkService;
  let identityClient: Record<string, jest.Mock>;
  const mockLogger = {
    setContext: jest.fn(),
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  const USER_ID = 'user-uuid-001';
  const STUDY_ID = 'study-uuid-001';
  const LINK_ID = 'link-uuid-001';

  beforeEach(() => {
    jest.clearAllMocks();

    identityClient = {
      createShareLink: jest.fn().mockResolvedValue({ id: LINK_ID }),
      findShareLinksByUserAndStudy: jest.fn().mockResolvedValue([]),
      deactivateShareLink: jest.fn().mockResolvedValue({ message: '공유 링크가 비활성화되었습니다.' }),
      verifyShareLinkToken: jest.fn().mockResolvedValue(null),
      findUserById: jest.fn().mockResolvedValue(null),
      updateProfileSettings: jest.fn().mockResolvedValue({}),
    };

    service = new ShareLinkService(
      identityClient as unknown as IdentityClientService,
      mockLogger as any,
    );
  });

  /* ───────── createShareLink ───────── */
  describe('createShareLink', () => {
    it('만료일 없이 공유 링크 생성', async () => {
      const result = await service.createShareLink(STUDY_ID, USER_ID, {});

      expect(identityClient.createShareLink).toHaveBeenCalledWith({
        study_id: STUDY_ID,
        created_by: USER_ID,
        expires_at: undefined,
      });
      expect(result).toBeDefined();
    });

    it('미래 만료일로 공유 링크 생성', async () => {
      const futureDate = new Date(Date.now() + 86400_000).toISOString();
      const result = await service.createShareLink(STUDY_ID, USER_ID, { expiresAt: futureDate });

      expect(identityClient.createShareLink).toHaveBeenCalledWith(
        expect.objectContaining({ expires_at: futureDate }),
      );
      expect(result).toBeDefined();
    });

    it('과거 만료일 — BadRequestException', async () => {
      const pastDate = new Date(Date.now() - 86400_000).toISOString();
      await expect(
        service.createShareLink(STUDY_ID, USER_ID, { expiresAt: pastDate }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  /* ───────── getShareLinks ───────── */
  describe('getShareLinks', () => {
    it('활성 공유 링크 목록 반환', async () => {
      const links = [{ id: LINK_ID, token: 'abc' }];
      identityClient.findShareLinksByUserAndStudy.mockResolvedValue(links);

      const result = await service.getShareLinks(STUDY_ID, USER_ID);

      expect(identityClient.findShareLinksByUserAndStudy).toHaveBeenCalledWith(USER_ID, STUDY_ID);
      expect(result).toEqual(links);
    });
  });

  /* ───────── deactivateShareLink ───────── */
  describe('deactivateShareLink', () => {
    it('생성자 본인이 비활성화 — Identity 서비스에 위임', async () => {
      const result = await service.deactivateShareLink(LINK_ID, STUDY_ID, USER_ID);

      expect(identityClient.deactivateShareLink).toHaveBeenCalledWith(LINK_ID, USER_ID);
      expect(result).toEqual({ message: '공유 링크가 비활성화되었습니다.' });
    });

    it('Identity 서비스에서 NotFoundException 시 전파', async () => {
      identityClient.deactivateShareLink.mockRejectedValue(
        new NotFoundException('공유 링크를 찾을 수 없습니다.'),
      );

      await expect(
        service.deactivateShareLink(LINK_ID, STUDY_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  /* ───────── verifyToken ───────── */
  describe('verifyToken', () => {
    it('Identity API 결과 반환 — null이면 null', async () => {
      identityClient.verifyShareLinkToken.mockResolvedValue(null);
      expect(await service.verifyToken('a'.repeat(64))).toBeNull();
    });

    it('유효한 토큰 — ShareLink 반환', async () => {
      const link = { token: 'a'.repeat(64), is_active: true, expires_at: null };
      identityClient.verifyShareLinkToken.mockResolvedValue(link);
      expect(await service.verifyToken('a'.repeat(64))).toEqual(link);
    });
  });

  /* ───────── getProfileSettings ───────── */
  describe('getProfileSettings', () => {
    it('유저 미존재 — NotFoundException', async () => {
      identityClient.findUserById.mockRejectedValue(
        new NotFoundException('사용자를 찾을 수 없습니다.'),
      );
      await expect(service.getProfileSettings(USER_ID)).rejects.toThrow(NotFoundException);
    });

    it('유저 존재 — 프로필 설정 반환', async () => {
      identityClient.findUserById.mockResolvedValue({
        id: USER_ID,
        profile_slug: 'my-slug',
        is_profile_public: true,
      });

      const result = await service.getProfileSettings(USER_ID);

      expect(result).toEqual({ profileSlug: 'my-slug', isProfilePublic: true });
    });
  });

  /* ───────── updateProfileSettings ───────── */
  describe('updateProfileSettings', () => {
    it('slug 예약어 — BadRequestException (Gateway 레벨 선검증)', async () => {
      await expect(
        service.updateProfileSettings(USER_ID, { profileSlug: 'admin' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('Identity 서비스에 위임하여 slug 업데이트', async () => {
      identityClient.updateProfileSettings.mockResolvedValue({
        profileSlug: 'my-slug',
        isProfilePublic: false,
      });

      const result = await service.updateProfileSettings(USER_ID, { profileSlug: 'my-slug' });

      expect(identityClient.updateProfileSettings).toHaveBeenCalledWith(USER_ID, {
        publicId: 'my-slug',
        is_profile_public: undefined,
      });
      expect(result.profileSlug).toBe('my-slug');
    });

    it('slug 중복 — Identity 서비스에서 ConflictException 전파', async () => {
      identityClient.updateProfileSettings.mockRejectedValue(
        new ConflictException('이미 사용 중인 slug입니다.'),
      );

      await expect(
        service.updateProfileSettings(USER_ID, { profileSlug: 'taken-slug' }),
      ).rejects.toThrow(ConflictException);
    });

    it('공개 토글 업데이트', async () => {
      identityClient.updateProfileSettings.mockResolvedValue({
        profileSlug: 'existing-slug',
        isProfilePublic: true,
      });

      const result = await service.updateProfileSettings(USER_ID, { isProfilePublic: true });

      expect(result.isProfilePublic).toBe(true);
    });

    it('slug + 공개 토글 동시 업데이트', async () => {
      identityClient.updateProfileSettings.mockResolvedValue({
        profileSlug: 'new-slug',
        isProfilePublic: true,
      });

      const result = await service.updateProfileSettings(USER_ID, {
        profileSlug: 'new-slug',
        isProfilePublic: true,
      });

      expect(result.profileSlug).toBe('new-slug');
      expect(result.isProfilePublic).toBe(true);
    });
  });
});
