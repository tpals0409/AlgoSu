import { ConfigService } from '@nestjs/config';
import { NotificationService } from './notification.service';
import { NotificationType } from '../common/types/identity.types';
import { IdentityClientService } from '../identity-client/identity-client.service';

// --- ioredis 모듈 모킹 ---
const mockRedis = {
  publish: jest.fn().mockResolvedValue(1),
  on: jest.fn().mockReturnThis(),
};

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => mockRedis);
});

describe('NotificationService', () => {
  let service: NotificationService;
  let identityClient: Record<string, jest.Mock>;
  let configService: Record<string, jest.Mock>;

  const USER_ID = 'user-id-1';
  const NOTIFICATION_ID = 'notif-id-1';

  const mockSavedNotification = {
    id: NOTIFICATION_ID,
    userId: USER_ID,
    studyId: 'study-id-1',
    type: NotificationType.AI_COMPLETED,
    title: 'AI 분석 완료',
    message: '코드 분석이 완료되었습니다.',
    link: '/submissions/123',
    read: false,
    createdAt: new Date().toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    configService = {
      get: jest.fn().mockReturnValue('redis://localhost:6379'),
    };

    identityClient = {
      createNotification: jest.fn().mockResolvedValue(mockSavedNotification),
      findNotificationsByUserId: jest.fn(),
      markAsRead: jest.fn(),
      markAllRead: jest.fn(),
      getUnreadCount: jest.fn(),
      deleteOldNotifications: jest.fn(),
    };

    const mockLogger = {
      setContext: jest.fn(),
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    service = new NotificationService(
      identityClient as unknown as IdentityClientService,
      configService as unknown as ConfigService,
      mockLogger as any,
    );
  });

  // ============================
  // 1. createNotification — 알림 생성 + Redis publish
  // ============================
  describe('createNotification', () => {
    it('정상 생성 — Identity 서비스 호출 + Redis publish', async () => {
      const result = await service.createNotification({
        userId: USER_ID,
        studyId: 'study-id-1',
        type: NotificationType.AI_COMPLETED,
        title: 'AI 분석 완료',
        message: '코드 분석이 완료되었습니다.',
        link: '/submissions/123',
      });

      expect(result.id).toBe(NOTIFICATION_ID);
      expect(identityClient.createNotification).toHaveBeenCalledWith({
        userId: USER_ID,
        studyId: 'study-id-1',
        type: NotificationType.AI_COMPLETED,
        title: 'AI 분석 완료',
        message: '코드 분석이 완료되었습니다.',
        link: '/submissions/123',
      });
      expect(mockRedis.publish).toHaveBeenCalledWith(
        `notification:user:${USER_ID}`,
        expect.any(String),
      );
    });

    it('studyId/link 없이 생성 — null 처리', async () => {
      const noStudyNotif = { ...mockSavedNotification, studyId: null, link: null };
      identityClient.createNotification.mockResolvedValue(noStudyNotif);

      await service.createNotification({
        userId: USER_ID,
        type: NotificationType.SUBMISSION_STATUS,
        title: '제출 상태 변경',
        message: '제출이 처리되었습니다.',
      });

      expect(identityClient.createNotification).toHaveBeenCalledWith({
        userId: USER_ID,
        studyId: null,
        type: NotificationType.SUBMISSION_STATUS,
        title: '제출 상태 변경',
        message: '제출이 처리되었습니다.',
        link: null,
      });
    });

    it('Redis publish 실패 — 에러 무시, 알림은 정상 반환', async () => {
      mockRedis.publish.mockRejectedValue(new Error('Redis connection refused'));

      const result = await service.createNotification({
        userId: USER_ID,
        type: NotificationType.AI_COMPLETED,
        title: 'AI 분석 완료',
        message: '코드 분석이 완료되었습니다.',
      });

      expect(result.id).toBe(NOTIFICATION_ID);
    });
  });

  // ============================
  // 2. getMyNotifications — 알림 목록 조회
  // ============================
  describe('getMyNotifications', () => {
    it('알림 목록 반환', async () => {
      identityClient.findNotificationsByUserId.mockResolvedValue([mockSavedNotification]);

      const result = await service.getMyNotifications(USER_ID);

      expect(result).toHaveLength(1);
      expect(identityClient.findNotificationsByUserId).toHaveBeenCalledWith(USER_ID);
    });

    it('알림 없는 경우 — 빈 배열 반환', async () => {
      identityClient.findNotificationsByUserId.mockResolvedValue([]);

      const result = await service.getMyNotifications(USER_ID);

      expect(result).toHaveLength(0);
    });
  });

  // ============================
  // 3. markAsRead — 단건 읽음 처리
  // ============================
  describe('markAsRead', () => {
    it('Identity 서비스에 읽음 처리 위임', async () => {
      identityClient.markAsRead.mockResolvedValue({});

      await service.markAsRead(NOTIFICATION_ID, USER_ID);

      expect(identityClient.markAsRead).toHaveBeenCalledWith(NOTIFICATION_ID, USER_ID);
    });
  });

  // ============================
  // 4. markAllRead — 전체 읽음 처리
  // ============================
  describe('markAllRead', () => {
    it('미읽음 알림 일괄 업데이트 — affected 반환', async () => {
      identityClient.markAllRead.mockResolvedValue({ affected: 5 });

      const result = await service.markAllRead(USER_ID);

      expect(result).toBe(5);
      expect(identityClient.markAllRead).toHaveBeenCalledWith(USER_ID);
    });

    it('미읽음 알림 없는 경우 — 0 반환', async () => {
      identityClient.markAllRead.mockResolvedValue({ affected: 0 });

      const result = await service.markAllRead(USER_ID);

      expect(result).toBe(0);
    });

    it('affected undefined 경우 — 0 반환', async () => {
      identityClient.markAllRead.mockResolvedValue({});

      const result = await service.markAllRead(USER_ID);

      expect(result).toBe(0);
    });
  });

  // ============================
  // 5. getUnreadCount — 미읽음 수 조회
  // ============================
  describe('getUnreadCount', () => {
    it('미읽음 수 반환', async () => {
      identityClient.getUnreadCount.mockResolvedValue({ count: 3 });

      const result = await service.getUnreadCount(USER_ID);

      expect(result).toBe(3);
      expect(identityClient.getUnreadCount).toHaveBeenCalledWith(USER_ID);
    });
  });

  // ============================
  // 6. cleanupOldNotifications — 30일 경과 알림 Cron 삭제
  // ============================
  describe('cleanupOldNotifications', () => {
    it('30일 경과 알림 삭제 — Identity 서비스 호출', async () => {
      identityClient.deleteOldNotifications.mockResolvedValue({ affected: 10 });

      await service.cleanupOldNotifications();

      expect(identityClient.deleteOldNotifications).toHaveBeenCalled();
    });

    it('삭제 대상 없는 경우 — 정상 종료', async () => {
      identityClient.deleteOldNotifications.mockResolvedValue({ affected: 0 });

      await expect(service.cleanupOldNotifications()).resolves.toBeUndefined();
    });
  });

  // ============================
  // 7. Redis error callback
  // ============================
  describe('Redis error callback', () => {
    it('Redis on error 핸들러가 등록되어 에러를 로깅한다', () => {
      const errorCall = (mockRedis.on as jest.Mock).mock.calls.find(
        (call: [string, ...unknown[]]) => call[0] === 'error',
      );
      expect(errorCall).toBeDefined();
      const handler = errorCall![1] as (err: Error) => void;
      expect(() => handler(new Error('Redis connection refused'))).not.toThrow();
    });
  });
});
