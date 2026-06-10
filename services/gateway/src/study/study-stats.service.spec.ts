import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StudyStatsService } from './study-stats.service';
import { IdentityClientService } from '../identity-client/identity-client.service';

describe('StudyStatsService', () => {
  let service: StudyStatsService;
  let configService: Record<string, jest.Mock>;
  let identityClient: Record<string, jest.Mock>;

  const USER_ID = 'user-id-admin';
  const STUDY_ID = 'study-id-1';

  const mockAdminMemberData = {
    id: 'member-id-1',
    study_id: STUDY_ID,
    user_id: USER_ID,
    role: 'ADMIN',
    nickname: 'Admin',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    configService = {
      get: jest.fn().mockReturnValue('redis://localhost:6379'),
      getOrThrow: jest.fn(),
    };

    identityClient = {
      getMembers: jest.fn(),
    };

    const mockLogger = {
      setContext: jest.fn(),
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    service = new StudyStatsService(
      configService as unknown as ConfigService,
      mockLogger as any,
      identityClient as unknown as IdentityClientService,
    );
  });

  // ============================
  // getStudyStats
  // ============================
  describe('getStudyStats', () => {
    const mockActiveProblemIdsResponse = {
      ok: true,
      json: () => Promise.resolve({ data: ['p1', 'p2'] }),
    };

    it('통계 API 정상 응답 처리', async () => {
      configService.getOrThrow = jest.fn()
        .mockReturnValueOnce('http://problem:3000')
        .mockReturnValueOnce('internal-key-problem')
        .mockReturnValueOnce('http://submission:3000')
        .mockReturnValueOnce('internal-key-123');

      const mockStatsData = {
        data: {
          totalSubmissions: 10,
          uniqueSubmissions: 8,
          uniqueAnalyzed: 6,
          byWeek: [{ week: 'W1', count: 5 }],
          byWeekPerUser: [],
          byMember: [{ userId: USER_ID, count: 5, doneCount: 3, uniqueProblemCount: 2, uniqueDoneCount: 1 }],
          byMemberWeek: null,
          recentSubmissions: [],
          solvedProblemIds: ['p1'],
          submitterCountByProblem: [{ problemId: 'p1', count: 2, analyzedCount: 1 }],
        },
      };

      const originalFetch = global.fetch;
      global.fetch = jest.fn()
        .mockResolvedValueOnce(mockActiveProblemIdsResponse)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockStatsData),
        }) as any;

      identityClient.getMembers.mockResolvedValue([mockAdminMemberData]);

      const result = await service.getStudyStats(STUDY_ID, USER_ID);

      expect(result.totalSubmissions).toBe(10);
      expect(result.uniqueSubmissions).toBe(8);
      expect(result.uniqueAnalyzed).toBe(6);
      expect(result.byMember).toHaveLength(1);
      expect(result.byMember[0].isMember).toBe(true);

      global.fetch = originalFetch;
    });

    it('통계 API 실패 → NotFoundException', async () => {
      configService.getOrThrow = jest.fn()
        .mockReturnValueOnce('http://problem:3000')
        .mockReturnValueOnce('internal-key-problem')
        .mockReturnValueOnce('http://submission:3000')
        .mockReturnValueOnce('internal-key-123');

      const originalFetch = global.fetch;
      global.fetch = jest.fn()
        .mockResolvedValueOnce(mockActiveProblemIdsResponse)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
        }) as any;

      await expect(service.getStudyStats(STUDY_ID, USER_ID)).rejects.toThrow(
        NotFoundException,
      );

      global.fetch = originalFetch;
    });

    it('byMemberWeek가 배열이면 isMember 매핑 포함', async () => {
      configService.getOrThrow = jest.fn()
        .mockReturnValueOnce('http://problem:3000')
        .mockReturnValueOnce('internal-key-problem')
        .mockReturnValueOnce('http://submission:3000')
        .mockReturnValueOnce('internal-key-123');

      const mockStatsData = {
        data: {
          totalSubmissions: 5,
          byWeek: [],
          byWeekPerUser: [],
          byMember: [{ userId: USER_ID, count: 3, doneCount: 2, uniqueProblemCount: 1, uniqueDoneCount: 1 }],
          byMemberWeek: [{ userId: USER_ID, count: 3 }, { userId: 'unknown-user', count: 1 }],
          recentSubmissions: [],
          solvedProblemIds: null,
          submitterCountByProblem: [],
        },
      };

      const originalFetch = global.fetch;
      global.fetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: ['p1'] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockStatsData),
        }) as any;

      identityClient.getMembers.mockResolvedValue([mockAdminMemberData]);

      const result = await service.getStudyStats(STUDY_ID, USER_ID);

      expect(result.byMemberWeek).not.toBeNull();
      expect(result.byMemberWeek).toHaveLength(2);
      expect(result.byMemberWeek![0].isMember).toBe(true);
      expect(result.byMemberWeek![1].isMember).toBe(false);

      global.fetch = originalFetch;
    });
  });

  // ============================
  // getStudyStats — 추가 분기
  // ============================
  describe('getStudyStats — 추가 분기', () => {
    it('weekNumber 없이 호출 시 weekNumber 파라미터 미포함', async () => {
      configService.getOrThrow = jest.fn()
        .mockReturnValueOnce('http://problem:3000')
        .mockReturnValueOnce('internal-key-problem')
        .mockReturnValueOnce('http://submission:3000')
        .mockReturnValueOnce('internal-key-123');

      const mockStatsData = {
        data: {
          totalSubmissions: 0,
          uniqueSubmissions: undefined,
          uniqueAnalyzed: undefined,
          byWeek: [],
          byWeekPerUser: [],
          byMember: [],
          byMemberWeek: null,
          recentSubmissions: [],
          solvedProblemIds: null,
          submitterCountByProblem: undefined,
        },
      };

      const originalFetch = global.fetch;
      global.fetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: ['p1'] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockStatsData),
        }) as any;

      identityClient.getMembers.mockResolvedValue([]);

      const result = await service.getStudyStats(STUDY_ID, USER_ID);

      expect(result.uniqueSubmissions).toBe(0);
      expect(result.uniqueAnalyzed).toBe(0);
      expect(result.solvedProblemIds).toEqual([]);
      expect(result.submitterCountByProblem).toEqual([]);

      global.fetch = originalFetch;
    });

    it('fetchActiveProblemIds 실패 시 activeProblemIds 없이 요청', async () => {
      configService.getOrThrow = jest.fn()
        .mockReturnValueOnce('http://problem:3000')
        .mockReturnValueOnce('internal-key-problem')
        .mockReturnValueOnce('http://submission:3000')
        .mockReturnValueOnce('internal-key-123');

      const mockStatsData = {
        data: {
          totalSubmissions: 0,
          byWeek: [],
          byWeekPerUser: [],
          byMember: [],
          byMemberWeek: null,
          recentSubmissions: [],
          solvedProblemIds: null,
          submitterCountByProblem: [],
        },
      };

      const originalFetch = global.fetch;
      global.fetch = jest.fn()
        .mockResolvedValueOnce({ ok: false, status: 500 }) // fetchActiveProblemIds 실패
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockStatsData),
        }) as any;

      identityClient.getMembers.mockResolvedValue([]);

      const result = await service.getStudyStats(STUDY_ID, USER_ID);

      expect(result.totalSubmissions).toBe(0);

      global.fetch = originalFetch;
    });

    it('fetchActiveProblemIds에서 fetch 자체가 throw 시 undefined 반환', async () => {
      configService.getOrThrow = jest.fn()
        .mockReturnValueOnce('http://problem:3000')
        .mockReturnValueOnce('internal-key-problem')
        .mockReturnValueOnce('http://submission:3000')
        .mockReturnValueOnce('internal-key-123');

      const mockStatsData = {
        data: {
          totalSubmissions: 0,
          byWeek: [],
          byWeekPerUser: [],
          byMember: [],
          byMemberWeek: null,
          recentSubmissions: [],
          solvedProblemIds: null,
          submitterCountByProblem: [],
        },
      };

      const originalFetch = global.fetch;
      global.fetch = jest.fn()
        .mockRejectedValueOnce(new Error('network error')) // fetchActiveProblemIds throw
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockStatsData),
        }) as any;

      identityClient.getMembers.mockResolvedValue([]);

      const result = await service.getStudyStats(STUDY_ID, USER_ID);

      expect(result.totalSubmissions).toBe(0);

      global.fetch = originalFetch;
    });

    it('byMember에 memberMap에 없는 userId 포함 시 nickname null 반환', async () => {
      configService.getOrThrow = jest.fn()
        .mockReturnValueOnce('http://problem:3000')
        .mockReturnValueOnce('internal-key-problem')
        .mockReturnValueOnce('http://submission:3000')
        .mockReturnValueOnce('internal-key-123');

      const mockStatsData = {
        data: {
          totalSubmissions: 2,
          uniqueSubmissions: 1,
          uniqueAnalyzed: 1,
          byWeek: [],
          byWeekPerUser: [],
          byMember: [
            { userId: 'unknown-user', count: 1, doneCount: 0, uniqueProblemCount: 1, uniqueDoneCount: 0 },
          ],
          byMemberWeek: null,
          recentSubmissions: [
            { userId: 'unknown-user', title: 'test' },
          ],
          solvedProblemIds: [],
          submitterCountByProblem: [],
        },
      };

      const originalFetch = global.fetch;
      global.fetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: ['p1'] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockStatsData),
        }) as any;

      identityClient.getMembers.mockResolvedValue([mockAdminMemberData]);

      const result = await service.getStudyStats(STUDY_ID, USER_ID);

      expect(result.byMember[0].nickname).toBeNull();
      expect(result.byMember[0].isMember).toBe(false);
      expect(result.recentSubmissions[0]).toHaveProperty('nickname', null);

      global.fetch = originalFetch;
    });

    it('weekNumber 포함 호출 시 쿼리스트링에 포함', async () => {
      configService.getOrThrow = jest.fn()
        .mockReturnValueOnce('http://problem:3000')
        .mockReturnValueOnce('internal-key-problem')
        .mockReturnValueOnce('http://submission:3000')
        .mockReturnValueOnce('internal-key-123');

      const mockStatsData = {
        data: {
          totalSubmissions: 5,
          uniqueSubmissions: 3,
          uniqueAnalyzed: 2,
          byWeek: [],
          byWeekPerUser: [],
          byMember: [],
          byMemberWeek: [{ userId: USER_ID, count: 2 }],
          recentSubmissions: [{ userId: USER_ID, title: 'test' }],
          solvedProblemIds: ['p1'],
          submitterCountByProblem: [{ problemId: 'p1', count: 1, analyzedCount: 0 }],
        },
      };

      const originalFetch = global.fetch;
      global.fetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: ['p1'] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockStatsData),
        }) as any;

      identityClient.getMembers.mockResolvedValue([mockAdminMemberData]);

      const result = await service.getStudyStats(STUDY_ID, USER_ID, 'W3');

      // weekNumber가 qs에 포함되었는지 확인
      const fetchCalls = (global.fetch as jest.Mock).mock.calls;
      expect(fetchCalls[1][0]).toContain('weekNumber=W3');
      expect(result.recentSubmissions[0]).toHaveProperty('nickname');

      global.fetch = originalFetch;
    });
  });
});
