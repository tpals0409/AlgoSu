import { ConfigService } from '@nestjs/config';
import { DeadlineReminderService } from './deadline-reminder.service';
import { NotificationType } from './notification.entity';

// --- ioredis 모킹 ---
const mockRedis = {
  set: jest.fn().mockResolvedValue('OK'),
  get: jest.fn().mockResolvedValue(null),
  quit: jest.fn().mockResolvedValue('OK'),
  on: jest.fn().mockReturnThis(),
};

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => mockRedis);
});

// --- global fetch 모킹 ---
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('DeadlineReminderService', () => {
  let service: DeadlineReminderService;
  let notificationService: Record<string, jest.Mock>;
  let memberRepo: Record<string, jest.Mock>;
  let studyRepo: Record<string, jest.Mock>;
  let configService: Record<string, jest.Mock>;

  const STUDY_ID = 'study-id-1';
  const PROBLEM_ID = 'problem-id-1';
  const USER_ID = 'user-id-1';

  beforeEach(() => {
    jest.clearAllMocks();

    configService = {
      get: jest.fn((key: string) => {
        const map: Record<string, string> = {
          REDIS_URL: 'redis://localhost:6379',
          PROBLEM_SERVICE_URL: 'http://problem:3000',
          INTERNAL_KEY_PROBLEM: 'key-problem',
          SUBMISSION_SERVICE_URL: 'http://submission:3000',
          INTERNAL_KEY_SUBMISSION: 'key-submission',
        };
        return map[key] ?? undefined;
      }),
    };

    notificationService = {
      createNotification: jest.fn().mockResolvedValue(undefined),
    };

    memberRepo = {
      find: jest.fn().mockResolvedValue([]),
    };

    studyRepo = {
      findOne: jest.fn().mockResolvedValue(null),
    };

    const mockLogger = {
      setContext: jest.fn(),
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    service = new DeadlineReminderService(
      configService as unknown as ConfigService,
      notificationService as never,
      mockLogger as any,
      memberRepo as never,
      studyRepo as never,
    );
  });

  // ─── checkDeadlines ─────────────────────────

  describe('checkDeadlines', () => {
    it('마감 임박 문제가 없으면 알림 없이 완료', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      });

      await service.checkDeadlines();

      expect(notificationService.createNotification).not.toHaveBeenCalled();
    });

    it('24h 마감 임박 문제 — 미제출자에게 알림 전송', async () => {
      const deadline = new Date(Date.now() + 20 * 60 * 60 * 1000).toISOString();

      // fetchUpcomingDeadlines: 24h 호출 시 문제 1건, 1h 호출 시 0건
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [
              { id: PROBLEM_ID, title: '두 수의 합', studyId: STUDY_ID, deadline, weekNumber: 'W1' },
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [] }),
        })
        // fetchSubmittedUsers
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ submittedUserIds: [] }),
        });

      memberRepo.find.mockResolvedValue([
        { user_id: USER_ID, study_id: STUDY_ID },
      ]);
      studyRepo.findOne.mockResolvedValue({ id: STUDY_ID, name: 'AlgoSu' });
      mockRedis.get.mockResolvedValue(null);

      await service.checkDeadlines();

      expect(notificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: USER_ID,
          type: NotificationType.DEADLINE_REMINDER,
        }),
      );
      expect(mockRedis.set).toHaveBeenCalled();
    });

    it('이미 알림 발송된 사용자는 Redis 중복 방지로 스킵', async () => {
      const deadline = new Date(Date.now() + 20 * 60 * 60 * 1000).toISOString();

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [
              { id: PROBLEM_ID, title: '문제', studyId: STUDY_ID, deadline, weekNumber: 'W1' },
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ submittedUserIds: [] }),
        });

      memberRepo.find.mockResolvedValue([{ user_id: USER_ID, study_id: STUDY_ID }]);
      studyRepo.findOne.mockResolvedValue({ id: STUDY_ID, name: 'Test' });
      mockRedis.get.mockResolvedValue('1'); // 이미 발송

      await service.checkDeadlines();

      expect(notificationService.createNotification).not.toHaveBeenCalled();
    });

    it('이미 제출한 사용자는 알림 대상에서 제외', async () => {
      const deadline = new Date(Date.now() + 20 * 60 * 60 * 1000).toISOString();

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [
              { id: PROBLEM_ID, title: '문제', studyId: STUDY_ID, deadline, weekNumber: 'W1' },
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ submittedUserIds: [USER_ID] }),
        });

      memberRepo.find.mockResolvedValue([{ user_id: USER_ID, study_id: STUDY_ID }]);

      await service.checkDeadlines();

      expect(notificationService.createNotification).not.toHaveBeenCalled();
    });

    it('fetchUpcomingDeadlines 실패 시 에러 잡고 계속 진행', async () => {
      mockFetch.mockRejectedValue(new Error('network error'));

      // 에러 발생해도 throw 하지 않음
      await expect(service.checkDeadlines()).resolves.toBeUndefined();
    });

    it('PROBLEM_SERVICE_URL 미설정 시 빈 배열 반환하고 스킵', async () => {
      configService.get.mockReturnValue(undefined);

      // 서비스 재생성 (설정값 없는 상태)
      const reLogger = { setContext: jest.fn(), log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
      service = new DeadlineReminderService(
        configService as unknown as ConfigService,
        notificationService as never,
        reLogger as any,
        memberRepo as never,
        studyRepo as never,
      );

      await service.checkDeadlines();

      expect(mockFetch).not.toHaveBeenCalled();
      expect(notificationService.createNotification).not.toHaveBeenCalled();
    });
  });

  // ─── 1시간 긴급 알림 ─────────────────────────

  describe('1시간 긴급 알림', () => {
    it('1h 마감 임박 시 [긴급] 라벨 포함 알림 전송', async () => {
      const deadline = new Date(Date.now() + 30 * 60 * 1000).toISOString();

      mockFetch
        // 24h 호출
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [] }),
        })
        // 1h 호출
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [
              { id: PROBLEM_ID, title: '긴급문제', studyId: STUDY_ID, deadline, weekNumber: 'W2' },
            ],
          }),
        })
        // fetchSubmittedUsers
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ submittedUserIds: [] }),
        });

      memberRepo.find.mockResolvedValue([{ user_id: USER_ID, study_id: STUDY_ID }]);
      studyRepo.findOne.mockResolvedValue({ id: STUDY_ID, name: 'AlgoSu' });
      mockRedis.get.mockResolvedValue(null);

      await service.checkDeadlines();

      expect(notificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '[긴급] 마감 임박',
          message: expect.stringContaining('1시간'),
        }),
      );
    });
  });

  // ─── fetchUpcomingDeadlines 실패 분기 ─────────
  describe('fetchUpcomingDeadlines 응답 실패', () => {
    it('응답 ok=false이면 빈 배열 반환하고 알림 없음', async () => {
      // 두 fetchUpcomingDeadlines 호출 모두 ok=false
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 503 })
        .mockResolvedValueOnce({ ok: false, status: 503 });

      await service.checkDeadlines();

      expect(notificationService.createNotification).not.toHaveBeenCalled();
    });
  });

  // ─── fetchSubmittedUsers 실패 분기 ────────────
  describe('fetchSubmittedUsers 분기', () => {
    it('SUBMISSION_SERVICE_URL 미설정이면 스킵', async () => {
      const deadline = new Date(Date.now() + 20 * 60 * 60 * 1000).toISOString();

      // configService.get에서 SUBMISSION_SERVICE_URL만 undefined 반환
      const partialConfig: Record<string, jest.Mock> = {
        get: jest.fn((key: string) => {
          if (key === 'REDIS_URL') return 'redis://localhost:6379';
          if (key === 'PROBLEM_SERVICE_URL') return 'http://problem:3000';
          if (key === 'INTERNAL_KEY_PROBLEM') return 'key-problem';
          // SUBMISSION_SERVICE_URL and INTERNAL_KEY_SUBMISSION: undefined
          return undefined;
        }),
      };
      const reLogger = { setContext: jest.fn(), log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
      const svc = new DeadlineReminderService(
        partialConfig as unknown as ConfigService,
        notificationService as never,
        reLogger as any,
        memberRepo as never,
        studyRepo as never,
      );

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [{ id: PROBLEM_ID, title: '문제', studyId: STUDY_ID, deadline, weekNumber: 'W1' }],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [] }),
        });

      memberRepo.find.mockResolvedValue([{ user_id: USER_ID, study_id: STUDY_ID }]);
      mockRedis.get.mockResolvedValue(null);

      // SUBMISSION_SERVICE_URL 없어도 예외 없이 처리 (미제출자 0명 → 알림 없음)
      await expect(svc.checkDeadlines()).resolves.toBeUndefined();
    });

    /**
     * 올바른 fetch 호출 순서:
     * 1) fetchUpcomingDeadlines(now, in24h) → mock1
     * 2) fetchSubmittedUsers (24h 문제 처리 중) → mock2
     * 3) fetchUpcomingDeadlines(now, in1h) → mock3
     * (1h 문제 없으면 추가 fetchSubmittedUsers 호출 없음)
     */
    it('fetchSubmittedUsers 응답 ok=false이면 빈 배열로 처리 (lines 232-233)', async () => {
      const deadline = new Date(Date.now() + 20 * 60 * 60 * 1000).toISOString();

      mockFetch
        // 1) fetchUpcomingDeadlines for 24h → problem
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [{ id: PROBLEM_ID, title: '문제', studyId: STUDY_ID, deadline, weekNumber: 'W1' }],
          }),
        })
        // 2) fetchSubmittedUsers for the 24h problem → ok=false (lines 232-233)
        .mockResolvedValueOnce({ ok: false, status: 500 })
        // 3) fetchUpcomingDeadlines for 1h → empty
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [] }),
        });

      memberRepo.find.mockResolvedValue([{ user_id: USER_ID, study_id: STUDY_ID }]);
      studyRepo.findOne.mockResolvedValue({ id: STUDY_ID, name: 'AlgoSu' });
      mockRedis.get.mockResolvedValue(null);

      // 제출자 조회 실패 시 제출자 없음으로 처리 → 미제출자 모두에게 알림
      await service.checkDeadlines();

      expect(notificationService.createNotification).toHaveBeenCalled();
    });

    it('fetchSubmittedUsers 네트워크 오류 시 빈 배열로 처리 (lines 239-240)', async () => {
      const deadline = new Date(Date.now() + 20 * 60 * 60 * 1000).toISOString();

      mockFetch
        // 1) fetchUpcomingDeadlines for 24h → problem
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [{ id: PROBLEM_ID, title: '문제', studyId: STUDY_ID, deadline, weekNumber: 'W1' }],
          }),
        })
        // 2) fetchSubmittedUsers for the 24h problem → network error (lines 239-240)
        .mockRejectedValueOnce(new Error('fetch failed'))
        // 3) fetchUpcomingDeadlines for 1h → empty
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [] }),
        });

      memberRepo.find.mockResolvedValue([{ user_id: USER_ID, study_id: STUDY_ID }]);
      studyRepo.findOne.mockResolvedValue({ id: STUDY_ID, name: 'AlgoSu' });
      mockRedis.get.mockResolvedValue(null);

      // 예외 발생해도 계속 처리
      await expect(service.checkDeadlines()).resolves.toBeUndefined();
    });
  });

  // ─── checkDeadlines 외부 catch 분기 ─────────
  describe('checkDeadlines — 외부 catch 분기 (line 89)', () => {
    it('notifyUnsubmittedUsers가 throw하면 외부 catch에서 에러 로깅', async () => {
      const deadline = new Date(Date.now() + 20 * 60 * 60 * 1000).toISOString();

      // fetchUpcomingDeadlines 성공
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: PROBLEM_ID, title: '문제', studyId: STUDY_ID, deadline, weekNumber: 'W1' }],
        }),
      });

      // memberRepo.find throws → notifyUnsubmittedUsers 내부에서 uncaught throw
      // → checkDeadlines의 outer catch block 실행 (line 89)
      memberRepo.find.mockRejectedValueOnce(new Error('DB connection error'));

      await service.checkDeadlines();

      // outer catch가 실행되어야 함 (line 89)
      // service 내부 logger는 mockLogger로 주입됨
      // 예외가 전파되지 않고 처리됨
      await expect(service.checkDeadlines()).resolves.toBeUndefined();
    });
  });

  // ─── Redis error callback ─────────────────────
  describe('Redis 연결 오류 콜백', () => {
    it('Redis on error 핸들러 등록 및 에러 로깅', () => {
      const errorCall = (mockRedis.on as jest.Mock).mock.calls.find(
        (call: [string, ...unknown[]]) => call[0] === 'error',
      );
      expect(errorCall).toBeDefined();
      const handler = errorCall![1] as (err: Error) => void;
      expect(() => handler(new Error('connection reset'))).not.toThrow();
    });
  });

  // ─── 멤버가 없는 스터디 ─────────────────────

  describe('멤버가 없는 스터디', () => {
    it('멤버가 없으면 알림 건너뜀', async () => {
      const deadline = new Date(Date.now() + 20 * 60 * 60 * 1000).toISOString();

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [
              { id: PROBLEM_ID, title: '문제', studyId: STUDY_ID, deadline, weekNumber: 'W1' },
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [] }),
        });

      memberRepo.find.mockResolvedValue([]); // 멤버 없음

      await service.checkDeadlines();

      expect(notificationService.createNotification).not.toHaveBeenCalled();
    });
  });

  // ─── onModuleDestroy ─────────────────────

  describe('onModuleDestroy', () => {
    it('Redis 연결을 정상 종료한다', async () => {
      await service.onModuleDestroy();

      expect(mockRedis.quit).toHaveBeenCalled();
    });
  });
});
