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
global.fetch = mockFetch as any;

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
    memberRepo = { find: jest.fn(), count: jest.fn() };
    shareLinkRepo = { findOne: jest.fn() };

    const mockConfigService = {
      get: jest.fn().mockImplementation((key: string, defaultVal: string) => {
        const map: Record<string, string> = {
          SUBMISSION_SERVICE_URL: 'http://submission:3003',
          INTERNAL_KEY_SUBMISSION: 'sk',
        };
        return map[key] ?? defaultVal;
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
      memberRepo.count.mockResolvedValue(3);
      shareLinkRepo.findOne.mockResolvedValue({ token: 'a'.repeat(64) });
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
      memberRepo.count.mockResolvedValue(1);
      shareLinkRepo.findOne.mockResolvedValue(null);
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
      memberRepo.count.mockResolvedValue(2);
      shareLinkRepo.findOne.mockResolvedValue(null);
      mockFetch.mockResolvedValue({ ok: false, status: 500 });

      const result = await controller.getPublicProfile('valid-slug');

      expect(result.data.studies[0].totalSubmissions).toBe(0);
      expect(result.data.studies[0].averageAiScore).toBeNull();
    });

    it('Submission Service fetch 예외 — 0/null 폴백', async () => {
      memberRepo.find.mockResolvedValue([
        { user_id: USER_ID, study_id: STUDY_ID, study: { name: '스터디' } },
      ]);
      memberRepo.count.mockResolvedValue(2);
      shareLinkRepo.findOne.mockResolvedValue(null);
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
      memberRepo.count.mockResolvedValue(1);
      shareLinkRepo.findOne.mockResolvedValue(null);
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
      memberRepo.count.mockResolvedValue(1);
      shareLinkRepo.findOne.mockResolvedValue(null);
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
      memberRepo.count.mockResolvedValue(1);
      shareLinkRepo.findOne.mockResolvedValue(null);
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
      memberRepo.count.mockResolvedValue(1);
      shareLinkRepo.findOne.mockResolvedValue(null);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const result = await controller.getPublicProfile('valid-slug');

      expect(result.data.studies[0].totalSubmissions).toBe(0);
      expect(result.data.studies[0].averageAiScore).toBeNull();
    });
  });
});
