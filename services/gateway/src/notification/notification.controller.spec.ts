import { Test, TestingModule } from '@nestjs/testing';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';

describe('NotificationController', () => {
  let controller: NotificationController;
  let notificationService: Record<string, jest.Mock>;

  const USER_ID = 'user-id-1';
  const NOTIFICATION_ID = '550e8400-e29b-41d4-a716-446655440000';

  function createMockReq() {
    return { headers: { 'x-user-id': USER_ID } } as never;
  }

  beforeEach(async () => {
    notificationService = {
      getMyNotifications: jest.fn(),
      getUnreadCount: jest.fn(),
      markAllRead: jest.fn(),
      markAsRead: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationController],
      providers: [{ provide: NotificationService, useValue: notificationService }],
    }).compile();

    controller = module.get<NotificationController>(NotificationController);
  });

  describe('getMyNotifications', () => {
    it('내 알림 목록 반환', async () => {
      const expected = [{ id: NOTIFICATION_ID, message: 'test' }];
      notificationService.getMyNotifications.mockResolvedValue(expected);

      const result = await controller.getMyNotifications(createMockReq());

      expect(notificationService.getMyNotifications).toHaveBeenCalledWith(USER_ID);
      expect(result).toEqual(expected);
    });
  });

  describe('getUnreadCount', () => {
    it('미읽음 수 반환', async () => {
      notificationService.getUnreadCount.mockResolvedValue(5);

      const result = await controller.getUnreadCount(createMockReq());

      expect(notificationService.getUnreadCount).toHaveBeenCalledWith(USER_ID);
      expect(result).toEqual({ count: 5 });
    });
  });

  describe('markAllRead', () => {
    it('전체 읽음 처리', async () => {
      notificationService.markAllRead.mockResolvedValue(3);

      const result = await controller.markAllRead(createMockReq());

      expect(notificationService.markAllRead).toHaveBeenCalledWith(USER_ID);
      expect(result).toEqual({ affected: 3 });
    });
  });

  describe('markAsRead', () => {
    it('단건 읽음 처리', async () => {
      notificationService.markAsRead.mockResolvedValue(undefined);

      const result = await controller.markAsRead(NOTIFICATION_ID, createMockReq());

      expect(notificationService.markAsRead).toHaveBeenCalledWith(NOTIFICATION_ID, USER_ID);
      expect(result).toEqual({ message: '읽음 처리되었습니다.' });
    });
  });
});
