import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PublicProfileController } from './public-profile.controller';
import { User } from '../auth/oauth/user.entity';
import { StudyMember } from '../study/study.entity';
import { ShareLink } from './share-link.entity';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';

/* global fetch 모킹 */
const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof global.fetch;

describe('PublicProfileController', () => {
  let controller: PublicProfileController;
  let userRepo: Record<string, jest.Mock>;
  let memberRepo: Record<string, jest.Mock>;
  let shareLinkRepo: Record<string, jest.Mock>;

  const USER_ID = 'user-uuid-001';
  const STUDY_ID = 'study-uuid-001';

  const mockLogger = {
    setContext: jest.fn(),
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    userRepo = { findOne: jest.fn() };
    memberRepo = {
      find: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    shareLinkRepo = { find: jest.fn() };

    const configMap: Record<string, string> = {
      SUBMISSION_SERVICE_URL: 'http://submission:3003',
      INTERNAL_KEY_SUBMISSION: 'sk',
    };
    const mockConfigService = {
      get: jest.fn().mockImplementation((key: string, defaultVal: string) => {
        return configMap[key] ?? defaultVal;
      }),
      getOrThrow: jest.fn().mockImplementation((key: string) => {
        const value = configMap[key];
        if (value === undefined) throw new Error(`Missing config: ${key}`);
        return value;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PublicProfileController],
      providers: [
        { provide: ConfigService, useValue: mockConfigService },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(StudyMember), useValue: memberRepo },
        { provide: getRepositoryToken(ShareLink), useValue: shareLinkRepo },
        { provide: StructuredLoggerService, useValue: mockLogger },
      ],
    }).compile();

    controller = module.get<PublicProfileController>(PublicProfileController);
  });

  /** createQueryBuilder 체인 모킹 헬퍼 */
  function mockMemberCountQuery(rows: { study_id: string; cnt: string }[]) {
    const qb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue(rows),
    };
    memberRepo.createQueryBuilder.mockReturnValue(qb);
    return qb;
  }

  /* ───────── slug 형식 검증 ───────── */
  describe('getPublicProfile — slug 검증', () => {
    it('너무 짧은 slug — NotFoundException', async () => {
      await expect(controller.getPublicProfile('ab')).rejects.toThrow(NotFoundException);
    });

    it('대문자 포함 slug — NotFoundException', async () => {
      await expect(controller.getPublicProfile('AbcDef')).rejects.toThrow(NotFoundException);
    });

    it('하이픈으로 시작 — NotFoundException', async () => {
      await expect(controller.getPublicProfile('-invalid-slug')).rejects.toThrow(NotFoundException);
    });

    it('하이픈으로 끝 — NotFoundException', async () => {
      await expect(controller.getPublicProfile('invalid-slug-')).rejects.toThrow(NotFoundException);
    });

    it('특수문자 포함 — NotFoundException', async () => {
      await expect(controller.getPublicProfile('invalid_slug!')).rejects.toThrow(NotFoundException);
    });
  });

  /* ───────── 유저 미존재/비공개 ───────── */
  describe('getPublicProfile — 유저 조회', () => {
    it('공개 유저 없음 — NotFoundException', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(controller.getPublicProfile('valid-slug')).rejects.toThrow(NotFoundException);
    });

    it('비공개 프로필(is_profile_public=false) — NotFoundException', async () => {
      // is_profile_public: true 조건으로 조회하므로 비공개 유저는 null 반환
      userRepo.findOne.mockResolvedValue(null);
      await expect(controller.getPublicProfile('private-user')).rejects.toThrow(NotFoundException);
      expect(userRepo.findOne).toHaveBeenCalledWith({
        where: { profile_slug: 'private-user', is_profile_public: true },
      });
    });

    it('존재하지 않는 slug — NotFoundException', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(controller.getPublicProfile('nonexistent1')).rejects.toThrow(NotFoundException);
    });
  });

  /* ───────── 정상 프로필 조회 ───────── */
  describe('getPublicProfile — 정상 응답', () => {
    const mockUser = {
      id: USER_ID,
      name: '테스트유저',
      avatar_url: 'http://avatar',
      profile_slug: 'valid-slug',
      is_profile_public: true,
    };

    beforeEach(() => {
      userRepo.findOne.mockResolvedValue(mockUser);
    });

    it('참여 스터디 없음 — 빈 studies + 0 통계', async () => {
      memberRepo.find.mockResolvedValue([]);

      const result = await controller.getPublicProfile('valid-slug');

      expect(result.data.name).toBe('테스트유저');
      expect(result.data.studies).toEqual([]);
      expect(result.data.totalSubmissions).toBe(0);
      expect(result.data.averageAiScore).toBeNull();
    });

    it('스터디 참여 + 공유 링크 있음 + 통계 정상', async () => {
      memberRepo.find.mockResolvedValue([
        { user_id: USER_ID, study_id: STUDY_ID, study: { name: '알고스터디' } },
      ]);
      mockMemberCountQuery([{ study_id: STUDY_ID, cnt: '3' }]);
      shareLinkRepo.find.mockResolvedValue([{ study_id: STUDY_ID, token: 'a'.repeat(64) }]);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { totalSubmissions: 10, averageScore: 85 },
          }),
      });

      const result = await controller.getPublicProfile('valid-slug');

      expect(result.data.studies).toHaveLength(1);
      expect(result.data.studies[0].studyName).toBe('알고스터디');
      expect(result.data.studies[0].memberCount).toBe(3);
      expect(result.data.studies[0].shareLink).toBe(`/shared/${'a'.repeat(64)}`);
      expect(result.data.studies[0].totalSubmissions).toBe(10);
      expect(result.data.studies[0].averageAiScore).toBe(85);
      expect(result.data.totalSubmissions).toBe(10);
      expect(result.data.averageAiScore).toBe(85);
    });

    it('공유 링크 없음 — shareLink null', async () => {
      memberRepo.find.mockResolvedValue([
        { user_id: USER_ID, study_id: STUDY_ID, study: { name: '스터디' } },
      ]);
      mockMemberCountQuery([{ study_id: STUDY_ID, cnt: '1' }]);
      shareLinkRepo.find.mockResolvedValue([]);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: { totalSubmissions: 0, averageScore: null } }),
      });

      const result = await controller.getPublicProfile('valid-slug');

      expect(result.data.studies[0].shareLink).toBeNull();
    });

    it('Submission Service 실패 — 0/null 폴백', async () => {
      memberRepo.find.mockResolvedValue([
        { user_id: USER_ID, study_id: STUDY_ID, study: { name: '스터디' } },
      ]);
      mockMemberCountQuery([{ study_id: STUDY_ID, cnt: '2' }]);
      shareLinkRepo.find.mockResolvedValue([]);
      mockFetch.mockResolvedValue({ ok: false, status: 500 });

      const result = await controller.getPublicProfile('valid-slug');

      expect(result.data.studies[0].totalSubmissions).toBe(0);
      expect(result.data.studies[0].averageAiScore).toBeNull();
    });

    it('Submission Service fetch 예외 — 0/null 폴백', async () => {
      memberRepo.find.mockResolvedValue([
        { user_id: USER_ID, study_id: STUDY_ID, study: { name: '스터디' } },
      ]);
      mockMemberCountQuery([{ study_id: STUDY_ID, cnt: '2' }]);
      shareLinkRepo.find.mockResolvedValue([]);
      mockFetch.mockRejectedValue(new Error('network error'));

      const result = await controller.getPublicProfile('valid-slug');

      expect(result.data.studies[0].totalSubmissions).toBe(0);
      expect(result.data.studies[0].averageAiScore).toBeNull();
    });

    it('여러 스터디 — averageAiScore 계산 (null 스터디 제외)', async () => {
      memberRepo.find.mockResolvedValue([
        { user_id: USER_ID, study_id: 'study-1', study: { name: 'S1' } },
        { user_id: USER_ID, study_id: 'study-2', study: { name: 'S2' } },
        { user_id: USER_ID, study_id: 'study-3', study: { name: 'S3' } },
      ]);
      mockMemberCountQuery([
        { study_id: 'study-1', cnt: '1' },
        { study_id: 'study-2', cnt: '1' },
        { study_id: 'study-3', cnt: '1' },
      ]);
      shareLinkRepo.find.mockResolvedValue([]);
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: { totalSubmissions: 5, averageScore: 80 } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: { totalSubmissions: 3, averageScore: null } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: { totalSubmissions: 2, averageScore: 90 } }),
        });

      const result = await controller.getPublicProfile('valid-slug');

      expect(result.data.totalSubmissions).toBe(10);
      // (80 + 90) / 2 = 85.0
      expect(result.data.averageAiScore).toBe(85);
    });

    it('모든 스터디 averageAiScore null — 전체 평균 null', async () => {
      memberRepo.find.mockResolvedValue([
        { user_id: USER_ID, study_id: 'study-1', study: { name: 'S1' } },
      ]);
      mockMemberCountQuery([{ study_id: 'study-1', cnt: '1' }]);
      shareLinkRepo.find.mockResolvedValue([]);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: { totalSubmissions: 0, averageScore: null } }),
      });

      const result = await controller.getPublicProfile('valid-slug');

      expect(result.data.averageAiScore).toBeNull();
    });

    it('study 관계 없음 — "알 수 없는 스터디" 폴백', async () => {
      memberRepo.find.mockResolvedValue([
        { user_id: USER_ID, study_id: STUDY_ID, study: null },
      ]);
      mockMemberCountQuery([{ study_id: STUDY_ID, cnt: '1' }]);
      shareLinkRepo.find.mockResolvedValue([]);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: { totalSubmissions: 0, averageScore: null } }),
      });

      const result = await controller.getPublicProfile('valid-slug');

      expect(result.data.studies[0].studyName).toBe('알 수 없는 스터디');
    });

    it('Submission Service body.data 누락 — 0/null 폴백', async () => {
      memberRepo.find.mockResolvedValue([
        { user_id: USER_ID, study_id: STUDY_ID, study: { name: 'S' } },
      ]);
      mockMemberCountQuery([{ study_id: STUDY_ID, cnt: '1' }]);
      shareLinkRepo.find.mockResolvedValue([]);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const result = await controller.getPublicProfile('valid-slug');

      expect(result.data.studies[0].totalSubmissions).toBe(0);
      expect(result.data.studies[0].averageAiScore).toBeNull();
    });
  });

  /* ───────── 보안: 민감 정보 미반환 ───────── */
  describe('보안 — 민감 정보 미반환', () => {
    it('응답에 email, github_token, oauth_provider 등 민감 필드 미포함', async () => {
      const mockUserWithSensitive = {
        id: USER_ID,
        name: '테스트유저',
        email: 'test@example.com',
        avatar_url: 'http://avatar',
        profile_slug: 'valid-slug',
        is_profile_public: true,
        github_token: 'ghp_secrettoken123',
        oauth_provider: 'google',
        github_username: 'testuser',
      };
      userRepo.findOne.mockResolvedValue(mockUserWithSensitive);
      memberRepo.find.mockResolvedValue([]);

      const result = await controller.getPublicProfile('valid-slug');

      // 반환 데이터에 민감 정보가 포함되지 않아야 함
      const responseStr = JSON.stringify(result);
      expect(responseStr).not.toContain('test@example.com');
      expect(responseStr).not.toContain('ghp_secrettoken123');
      expect(responseStr).not.toContain('oauth_provider');
      expect(responseStr).not.toContain('github_token');

      // 허용된 필드만 존재 확인
      expect(result.data.name).toBe('테스트유저');
      expect(result.data.avatarUrl).toBe('http://avatar');
      expect(result.data).not.toHaveProperty('email');
      expect(result.data).not.toHaveProperty('github_token');
      expect(result.data).not.toHaveProperty('oauth_provider');
      expect(result.data).not.toHaveProperty('github_username');
    });
  });
});
