import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PublicProfileController } from './public-profile.controller';
import { IdentityClientService } from '../identity-client/identity-client.service';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';

/* global fetch 모킹 */
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('PublicProfileController', () => {
  let controller: PublicProfileController;
  let identityClient: Record<string, jest.Mock>;

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

    identityClient = {
      findUserBySlug: jest.fn(),
      findStudiesByUserId: jest.fn(),
      getMembers: jest.fn(),
      findShareLinksByUserAndStudy: jest.fn(),
    };

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
        { provide: IdentityClientService, useValue: identityClient },
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
      identityClient.findUserBySlug.mockRejectedValue(new NotFoundException());
      await expect(controller.getPublicProfile('valid-slug')).rejects.toThrow(NotFoundException);
    });

    it('비공개 프로필 — NotFoundException', async () => {
      identityClient.findUserBySlug.mockResolvedValue(null);
      await expect(controller.getPublicProfile('private-user')).rejects.toThrow(NotFoundException);
    });

    it('존재하지 않는 slug — NotFoundException', async () => {
      identityClient.findUserBySlug.mockRejectedValue(new NotFoundException());
      await expect(controller.getPublicProfile('nonexistent1')).rejects.toThrow(NotFoundException);
    });
  });

  /* ───────── 정상 프로필 조회 ───────── */
  describe('getPublicProfile — 정상 응답', () => {
    const mockUser = {
      id: USER_ID,
      name: '테스트유저',
      avatar_url: 'http://avatar',
    };

    beforeEach(() => {
      identityClient.findUserBySlug.mockResolvedValue(mockUser);
    });

    it('참여 스터디 없음 — 빈 studies + 0 통계', async () => {
      identityClient.findStudiesByUserId.mockResolvedValue([]);

      const result = await controller.getPublicProfile('valid-slug');

      expect(result.data.name).toBe('테스트유저');
      expect(result.data.studies).toEqual([]);
      expect(result.data.totalSubmissions).toBe(0);
      expect(result.data.averageAiScore).toBeNull();
    });

    it('스터디 참여 + 공유 링크 있음 + 통계 정상', async () => {
      identityClient.findStudiesByUserId.mockResolvedValue([
        { id: STUDY_ID, name: '알고스터디' },
      ]);
      identityClient.getMembers.mockResolvedValue([
        { user_id: 'u1' }, { user_id: 'u2' }, { user_id: 'u3' },
      ]);
      identityClient.findShareLinksByUserAndStudy.mockResolvedValue([
        { token: 'a'.repeat(64) },
      ]);
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
      identityClient.findStudiesByUserId.mockResolvedValue([
        { id: STUDY_ID, name: '스터디' },
      ]);
      identityClient.getMembers.mockResolvedValue([{ user_id: 'u1' }]);
      identityClient.findShareLinksByUserAndStudy.mockResolvedValue([]);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: { totalSubmissions: 0, averageScore: null } }),
      });

      const result = await controller.getPublicProfile('valid-slug');

      expect(result.data.studies[0].shareLink).toBeNull();
    });

    it('Submission Service 실패 — 0/null 폴백', async () => {
      identityClient.findStudiesByUserId.mockResolvedValue([
        { id: STUDY_ID, name: '스터디' },
      ]);
      identityClient.getMembers.mockResolvedValue([{ user_id: 'u1' }, { user_id: 'u2' }]);
      identityClient.findShareLinksByUserAndStudy.mockResolvedValue([]);
      mockFetch.mockResolvedValue({ ok: false, status: 500 });

      const result = await controller.getPublicProfile('valid-slug');

      expect(result.data.studies[0].totalSubmissions).toBe(0);
      expect(result.data.studies[0].averageAiScore).toBeNull();
    });

    it('Submission Service fetch 예외 — 0/null 폴백', async () => {
      identityClient.findStudiesByUserId.mockResolvedValue([
        { id: STUDY_ID, name: '스터디' },
      ]);
      identityClient.getMembers.mockResolvedValue([{ user_id: 'u1' }, { user_id: 'u2' }]);
      identityClient.findShareLinksByUserAndStudy.mockResolvedValue([]);
      mockFetch.mockRejectedValue(new Error('network error'));

      const result = await controller.getPublicProfile('valid-slug');

      expect(result.data.studies[0].totalSubmissions).toBe(0);
      expect(result.data.studies[0].averageAiScore).toBeNull();
    });

    it('여러 스터디 — averageAiScore 계산 (null 스터디 제외)', async () => {
      identityClient.findStudiesByUserId.mockResolvedValue([
        { id: 'study-1', name: 'S1' },
        { id: 'study-2', name: 'S2' },
        { id: 'study-3', name: 'S3' },
      ]);
      identityClient.getMembers.mockResolvedValue([{ user_id: 'u1' }]);
      identityClient.findShareLinksByUserAndStudy.mockResolvedValue([]);
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
      identityClient.findStudiesByUserId.mockResolvedValue([
        { id: 'study-1', name: 'S1' },
      ]);
      identityClient.getMembers.mockResolvedValue([{ user_id: 'u1' }]);
      identityClient.findShareLinksByUserAndStudy.mockResolvedValue([]);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: { totalSubmissions: 0, averageScore: null } }),
      });

      const result = await controller.getPublicProfile('valid-slug');

      expect(result.data.averageAiScore).toBeNull();
    });

    it('study name 없음 — "알 수 없는 스터디" 폴백', async () => {
      identityClient.findStudiesByUserId.mockResolvedValue([
        { id: STUDY_ID, name: null },
      ]);
      identityClient.getMembers.mockResolvedValue([{ user_id: 'u1' }]);
      identityClient.findShareLinksByUserAndStudy.mockResolvedValue([]);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: { totalSubmissions: 0, averageScore: null } }),
      });

      const result = await controller.getPublicProfile('valid-slug');

      expect(result.data.studies[0].studyName).toBe('알 수 없는 스터디');
    });

    it('Submission Service body.data 누락 — 0/null 폴백', async () => {
      identityClient.findStudiesByUserId.mockResolvedValue([
        { id: STUDY_ID, name: 'S' },
      ]);
      identityClient.getMembers.mockResolvedValue([{ user_id: 'u1' }]);
      identityClient.findShareLinksByUserAndStudy.mockResolvedValue([]);
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
        github_token: 'ghp_secrettoken123',
        oauth_provider: 'google',
        github_username: 'testuser',
      };
      identityClient.findUserBySlug.mockResolvedValue(mockUserWithSensitive);
      identityClient.findStudiesByUserId.mockResolvedValue([]);

      const result = await controller.getPublicProfile('valid-slug');

      // 반환 데이터에 민감 정보가 포함되지 않아야 함
      const responseStr = JSON.stringify(result);
      expect(responseStr).not.toContain('test@example.com');
      expect(responseStr).not.toContain('ghp_secrettoken123');

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
