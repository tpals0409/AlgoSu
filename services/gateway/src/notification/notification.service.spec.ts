import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationService } from './notification.service';
import { Notification, NotificationType } from './notification.entity';

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
  let notificationRepo: Record<string, jest.Mock>;
  let configService: Record<string, jest.Mock>;

  const USER_ID = 'user-id-1';
  const OTHER_USER_ID = 'user-id-2';
  const NOTIFICATION_ID = 'notif-id-1';

  const mockNotification: Notification = {
    id: NOTIFICATION_ID,
    userId: USER_ID,
    studyId: 'study-id-1',
    type: NotificationType.AI_COMPLETED,
    title: 'AI 분석 완료',
    message: '코드 분석이 완료되었습니다.',
    link: '/submissions/123',
    read: false,
    publicId: 'pub-notif-uuid-1',
    createdAt: new Date(),
    generatePublicId: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    configService = {
      get: jest.fn().mockReturnValue('redis://localhost:6379'),
    };

    notificationRepo = {
      create: jest.fn((data: Partial<Notification>) => ({ id: NOTIFICATION_ID, ...data }) as Notification),
      save: jest.fn((notif: Notification) => Promise.resolve(notif)),
      find: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      delete: jest.fn(),
    };

    service = new NotificationService(
      notificationRepo as any,
      configService as unknown as ConfigService,
    );
  });

  // ============================
  // 1. createNotification — 알림 생성 + Redis publish
  // ============================
  describe('createNotification', () => {
    it('정상 생성 — DB 저장 + Redis publish', async () => {
      notificationRepo.save.mockResolvedValue(mockNotification);

      const result = await service.createNotification({
        userId: USER_ID,
        studyId: 'study-id-1',
        type: NotificationType.AI_COMPLETED,
        title: 'AI 분석 완료',
        message: '코드 분석이 완료되었습니다.',
        link: '/submissions/123',
      });

      expect(result.id).toBe(NOTIFICATION_ID);
      expect(notificationRepo.create).toHaveBeenCalledWith({
        userId: USER_ID,
        studyId: 'study-id-1',
        type: NotificationType.AI_COMPLETED,
        title: 'AI 분석 완료',
        message: '코드 분석이 완료되었습니다.',
        link: '/submissions/123',
      });
      expect(notificationRepo.save).toHaveBeenCalled();
      expect(mockRedis.publish).toHaveBeenCalledWith(
        `notification:user:${USER_ID}`,
        expect.any(String),
      );
    });

    it('studyId/link 없이 생성 — null 처리', async () => {
      const noStudyNotif = { ...mockNotification, studyId: null, link: null };
      notificationRepo.save.mockResolvedValue(noStudyNotif);

      await service.createNotification({
        userId: USER_ID,
        type: NotificationType.SUBMISSION_STATUS,
        title: '제출 상태 변경',
        message: '제출이 처리되었습니다.',
      });

      expect(notificationRepo.create).toHaveBeenCalledWith({
        userId: USER_ID,
        studyId: null,
        type: NotificationType.SUBMISSION_STATUS,
        title: '제출 상태 변경',
        message: '제출이 처리되었습니다.',
        link: null,
      });
    });

    it('Redis publish 실패 — 에러 무시, 알림은 정상 반환', async () => {
      notificationRepo.save.mockResolvedValue(mockNotification);
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
  // 2. getMyNotifications — 미읽음 알림 목록 조회
  // ============================
  describe('getMyNotifications', () => {
    it('미읽음 알림 목록 반환 (최대 50개, 최신순)', async () => {
      notificationRepo.find.mockResolvedValue([mockNotification]);

      const result = await service.getMyNotifications(USER_ID);

      expect(result).toHaveLength(1);
      expect(notificationRepo.find).toHaveBeenCalledWith({
        where: { userId: USER_ID, read: false },
        order: { createdAt: 'DESC' },
        take: 50,
      });
    });

    it('알림 없는 경우 — 빈 배열 반환', async () => {
      notificationRepo.find.mockResolvedValue([]);

      const result = await service.getMyNotifications(USER_ID);

      expect(result).toHaveLength(0);
    });
  });

  // ============================
  // 3. markAsRead — 단건 읽음 처리 + IDOR 방지
  // ============================
  describe('markAsRead', () => {
    it('본인 알림 — 정상 읽음 처리', async () => {
      notificationRepo.findOne.mockResolvedValue({ ...mockNotification });

      await service.markAsRead(NOTIFICATION_ID, USER_ID);

      expect(notificationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ read: true }),
      );
    });

    it('존재하지 않는 알림 → NotFoundException', async () => {
      notificationRepo.findOne.mockResolvedValue(null);

      await expect(
        service.markAsRead('nonexistent-id', USER_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('다른 사용자의 알림 → ForbiddenException (IDOR 방지)', async () => {
      notificationRepo.findOne.mockResolvedValue(mockNotification);

      await expect(
        service.markAsRead(NOTIFICATION_ID, OTHER_USER_ID),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.markAsRead(NOTIFICATION_ID, OTHER_USER_ID),
      ).rejects.toThrow('다른 사용자의 알림에 접근할 수 없습니다.');
    });
  });

  // ============================
  // 4. markAllRead — 전체 읽음 처리
  // ============================
  describe('markAllRead', () => {
    it('미읽음 알림 일괄 업데이트 — affected 반환', async () => {
      notificationRepo.update.mockResolvedValue({ affected: 5 });

      const result = await service.markAllRead(USER_ID);

      expect(result).toBe(5);
      expect(notificationRepo.update).toHaveBeenCalledWith(
        { userId: USER_ID, read: false },
        { read: true },
      );
    });

    it('미읽음 알림 없는 경우 — 0 반환', async () => {
      notificationRepo.update.mockResolvedValue({ affected: 0 });

      const result = await service.markAllRead(USER_ID);

      expect(result).toBe(0);
    });

    it('affected undefined 경우 — 0 반환', async () => {
      notificationRepo.update.mockResolvedValue({});

      const result = await service.markAllRead(USER_ID);

      expect(result).toBe(0);
    });
  });

  // ============================
  // 5. getUnreadCount — 미읽음 수 조회
  // ============================
  describe('getUnreadCount', () => {
    it('미읽음 수 반환', async () => {
      notificationRepo.count.mockResolvedValue(3);

      const result = await service.getUnreadCount(USER_ID);

      expect(result).toBe(3);
      expect(notificationRepo.count).toHaveBeenCalledWith({
        where: { userId: USER_ID, read: false },
      });
    });
  });

  // ============================
  // 6. cleanupOldNotifications — 30일 경과 알림 Cron 삭제
  // ============================
  describe('cleanupOldNotifications', () => {
    it('30일 경과 알림 삭제 — delete with LessThan', async () => {
      notificationRepo.delete.mockResolvedValue({ affected: 10 });

      await service.cleanupOldNotifications();

      expect(notificationRepo.delete).toHaveBeenCalledWith({
        createdAt: expect.any(Object), // LessThan(cutoff)
      });
    });

    it('삭제 대상 없는 경우 — 정상 종료', async () => {
      notificationRepo.delete.mockResolvedValue({ affected: 0 });

      await expect(service.cleanupOldNotifications()).resolves.toBeUndefined();
    });
  });
});
