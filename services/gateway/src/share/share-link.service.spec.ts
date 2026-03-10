import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ShareLinkService } from './share-link.service';
import { StudyMemberRole } from '../study/study.entity';

jest.mock('crypto', () => ({
  randomBytes: jest.fn().mockReturnValue({
    toString: jest.fn().mockReturnValue('a'.repeat(64)),
  }),
}));

describe('ShareLinkService', () => {
  let service: ShareLinkService;
  let shareLinkRepo: Record<string, jest.Mock>;
  let userRepo: Record<string, jest.Mock>;
  let memberRepo: Record<string, jest.Mock>;
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

    shareLinkRepo = {
      create: jest.fn().mockImplementation((data) => data),
      save: jest.fn().mockImplementation((entity) => Promise.resolve({ id: LINK_ID, ...entity })),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
    };

    userRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    };

    memberRepo = {
      findOne: jest.fn().mockResolvedValue(null),
    };

    service = new ShareLinkService(
      shareLinkRepo as any,
      userRepo as any,
      memberRepo as any,
      mockLogger as any,
    );
  });

  /* ───────── createShareLink ───────── */
  describe('createShareLink', () => {
    it('만료일 없이 공유 링크 생성', async () => {
      const result = await service.createShareLink(STUDY_ID, USER_ID, {});

      expect(shareLinkRepo.create).toHaveBeenCalledWith({
        token: 'a'.repeat(64),
        study_id: STUDY_ID,
        created_by: USER_ID,
        expires_at: null,
        is_active: true,
      });
      expect(shareLinkRepo.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('미래 만료일로 공유 링크 생성', async () => {
      const futureDate = new Date(Date.now() + 86400_000).toISOString();
      const result = await service.createShareLink(STUDY_ID, USER_ID, { expiresAt: futureDate });

      expect(shareLinkRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ expires_at: expect.any(Date) }),
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
      shareLinkRepo.find.mockResolvedValue(links);

      const result = await service.getShareLinks(STUDY_ID);

      expect(shareLinkRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ study_id: STUDY_ID, is_active: true }),
          order: { created_at: 'DESC' },
        }),
      );
      expect(result).toEqual(links);
    });
  });

  /* ───────── deactivateShareLink ───────── */
  describe('deactivateShareLink', () => {
    it('링크 미존재 — NotFoundException', async () => {
      shareLinkRepo.findOne.mockResolvedValue(null);

      await expect(
        service.deactivateShareLink(LINK_ID, STUDY_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('생성자 본인이 비활성화', async () => {
      shareLinkRepo.findOne.mockResolvedValue({
        id: LINK_ID,
        created_by: USER_ID,
        is_active: true,
      });

      const result = await service.deactivateShareLink(LINK_ID, STUDY_ID, USER_ID);

      expect(shareLinkRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ is_active: false }),
      );
      expect(result).toEqual({ message: '공유 링크가 비활성화되었습니다.' });
    });

    it('ADMIN이 다른 사용자 링크 비활성화', async () => {
      const OTHER_USER = 'other-user-id';
      shareLinkRepo.findOne.mockResolvedValue({
        id: LINK_ID,
        created_by: OTHER_USER,
        is_active: true,
      });
      memberRepo.findOne.mockResolvedValue({ role: StudyMemberRole.ADMIN });

      const result = await service.deactivateShareLink(LINK_ID, STUDY_ID, USER_ID);

      expect(result).toEqual({ message: '공유 링크가 비활성화되었습니다.' });
    });

    it('비생성자 MEMBER — ForbiddenException', async () => {
      const OTHER_USER = 'other-user-id';
      shareLinkRepo.findOne.mockResolvedValue({
        id: LINK_ID,
        created_by: OTHER_USER,
        is_active: true,
      });
      memberRepo.findOne.mockResolvedValue({ role: StudyMemberRole.MEMBER });

      await expect(
        service.deactivateShareLink(LINK_ID, STUDY_ID, USER_ID),
      ).rejects.toThrow(ForbiddenException);
    });

    it('비생성자 + 멤버 아님 — ForbiddenException', async () => {
      shareLinkRepo.findOne.mockResolvedValue({
        id: LINK_ID,
        created_by: 'other-user-id',
        is_active: true,
      });
      memberRepo.findOne.mockResolvedValue(null);

      await expect(
        service.deactivateShareLink(LINK_ID, STUDY_ID, USER_ID),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  /* ───────── verifyToken ───────── */
  describe('verifyToken', () => {
    it('유효하지 않은 형식 — null 반환', async () => {
      expect(await service.verifyToken('short')).toBeNull();
      expect(await service.verifyToken('z'.repeat(64))).toBeNull(); // non-hex
      expect(await service.verifyToken('')).toBeNull();
    });

    it('DB에 존재하지 않는 토큰 — null', async () => {
      shareLinkRepo.findOne.mockResolvedValue(null);
      expect(await service.verifyToken('a'.repeat(64))).toBeNull();
    });

    it('만료된 토큰 — null', async () => {
      shareLinkRepo.findOne.mockResolvedValue({
        token: 'a'.repeat(64),
        is_active: true,
        expires_at: new Date(Date.now() - 1000),
      });
      expect(await service.verifyToken('a'.repeat(64))).toBeNull();
    });

    it('유효한 토큰 (만료 없음) — ShareLink 반환', async () => {
      const link = { token: 'a'.repeat(64), is_active: true, expires_at: null };
      shareLinkRepo.findOne.mockResolvedValue(link);
      expect(await service.verifyToken('a'.repeat(64))).toEqual(link);
    });

    it('유효한 토큰 (만료 전) — ShareLink 반환', async () => {
      const link = {
        token: 'a'.repeat(64),
        is_active: true,
        expires_at: new Date(Date.now() + 86400_000),
      };
      shareLinkRepo.findOne.mockResolvedValue(link);
      expect(await service.verifyToken('a'.repeat(64))).toEqual(link);
    });
  });

  /* ───────── getProfileSettings ───────── */
  describe('getProfileSettings', () => {
    it('유저 미존재 — NotFoundException', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.getProfileSettings(USER_ID)).rejects.toThrow(NotFoundException);
    });

    it('유저 존재 — 프로필 설정 반환', async () => {
      userRepo.findOne.mockResolvedValue({
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
    it('유저 미존재 — NotFoundException', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(
        service.updateProfileSettings(USER_ID, { profileSlug: 'test-slug' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('slug 예약어 — BadRequestException', async () => {
      userRepo.findOne.mockResolvedValue({
        id: USER_ID,
        profile_slug: null,
        is_profile_public: false,
      });

      await expect(
        service.updateProfileSettings(USER_ID, { profileSlug: 'admin' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('slug 중복 (다른 유저) — ConflictException', async () => {
      userRepo.findOne
        .mockResolvedValueOnce({ id: USER_ID, profile_slug: null, is_profile_public: false })
        .mockResolvedValueOnce({ id: 'other-user', profile_slug: 'taken-slug' });

      await expect(
        service.updateProfileSettings(USER_ID, { profileSlug: 'taken-slug' }),
      ).rejects.toThrow(ConflictException);
    });

    it('slug 중복이지만 본인 — 성공', async () => {
      const user = { id: USER_ID, profile_slug: 'my-slug', is_profile_public: false };
      userRepo.findOne
        .mockResolvedValueOnce(user)
        .mockResolvedValueOnce(user);

      const result = await service.updateProfileSettings(USER_ID, { profileSlug: 'my-slug' });

      expect(result.profileSlug).toBe('my-slug');
    });

    it('공개 토글 true + slug 없음 — BadRequestException', async () => {
      userRepo.findOne.mockResolvedValue({
        id: USER_ID,
        profile_slug: null,
        is_profile_public: false,
      });

      await expect(
        service.updateProfileSettings(USER_ID, { isProfilePublic: true }),
      ).rejects.toThrow(BadRequestException);
    });

    it('공개 토글 true + 기존 slug 있음 — 성공', async () => {
      userRepo.findOne.mockResolvedValue({
        id: USER_ID,
        profile_slug: 'existing-slug',
        is_profile_public: false,
      });

      const result = await service.updateProfileSettings(USER_ID, { isProfilePublic: true });

      expect(result.isProfilePublic).toBe(true);
    });

    it('slug + 공개 토글 동시 업데이트', async () => {
      const user = { id: USER_ID, profile_slug: null, is_profile_public: false };
      userRepo.findOne
        .mockResolvedValueOnce(user)
        .mockResolvedValueOnce(null); // slug not taken

      const result = await service.updateProfileSettings(USER_ID, {
        profileSlug: 'new-slug',
        isProfilePublic: true,
      });

      expect(result.profileSlug).toBe('new-slug');
      expect(result.isProfilePublic).toBe(true);
    });

    it('공개 토글 false — slug 없어도 성공', async () => {
      userRepo.findOne.mockResolvedValue({
        id: USER_ID,
        profile_slug: null,
        is_profile_public: true,
      });

      const result = await service.updateProfileSettings(USER_ID, { isProfilePublic: false });

      expect(result.isProfilePublic).toBe(false);
    });

    it('빈 DTO — 변경 없이 현재 값 반환', async () => {
      userRepo.findOne.mockResolvedValue({
        id: USER_ID,
        profile_slug: 'existing',
        is_profile_public: true,
      });

      const result = await service.updateProfileSettings(USER_ID, {});

      expect(result).toEqual({ profileSlug: 'existing', isProfilePublic: true });
    });
  });
});
