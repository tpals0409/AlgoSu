import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { NotificationType } from './notification.entity';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';

const mockNotification = {
  id: 'noti-1',
  userId: 'user-1',
  type: NotificationType.AI_COMPLETED,
  title: 'AI 분석 완료',
  message: '코드 분석이 완료되었습니다.',
  read: false,
};

describe('NotificationController', () => {
  let controller: NotificationController;
  let service: Record<string, jest.Mock>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationController],
      providers: [
        {
          provide: ConfigService,
          useValue: { getOrThrow: jest.fn().mockReturnValue('test-key') },
        },
        {
          provide: StructuredLoggerService,
          useValue: { setContext: jest.fn(), log: jest.fn(), warn: jest.fn(), error: jest.fn() },
        },
        {
          provide: NotificationService,
          useValue: {
            create: jest.fn(),
            findByUserId: jest.fn(),
            getUnreadCount: jest.fn(),
            markAsRead: jest.fn(),
            markAllRead: jest.fn(),
            deleteOld: jest.fn(),
            deleteByUserId: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(NotificationController);
    service = module.get(NotificationService) as unknown as Record<string, jest.Mock>;
  });

  afterEach(() => jest.clearAllMocks());

  // ─── create ─────────────────────────────────────
  describe('POST /api/notifications', () => {
    it('알림을 생성하고 결과를 반환한다', async () => {
      service.create.mockResolvedValue(mockNotification);
      const dto = {
        userId: 'user-1',
        type: NotificationType.AI_COMPLETED,
        title: 'AI 분석 완료',
        message: '코드 분석이 완료되었습니다.',
      };

      const result = await controller.create(dto as any);

      expect(result).toBe(mockNotification);
      expect(service.create).toHaveBeenCalledWith(dto);
    });
  });

  // ─── findByUserId ───────────────────────────────
  describe('GET /api/notifications/by-user/:userId', () => {
    it('미읽음 알림 목록을 반환한다', async () => {
      const notifications = [mockNotification];
      service.findByUserId.mockResolvedValue(notifications);

      const result = await controller.findByUserId('user-1');

      expect(result).toBe(notifications);
      expect(service.findByUserId).toHaveBeenCalledWith('user-1');
    });
  });

  // ─── getUnreadCount ─────────────────────────────
  describe('GET /api/notifications/by-user/:userId/unread-count', () => {
    it('미읽음 알림 수를 count로 감싸 반환한다', async () => {
      service.getUnreadCount.mockResolvedValue(5);

      const result = await controller.getUnreadCount('user-1');

      expect(result).toEqual({ count: 5 });
      expect(service.getUnreadCount).toHaveBeenCalledWith('user-1');
    });
  });

  // ─── markAsRead ─────────────────────────────────
  describe('PATCH /api/notifications/:id/read', () => {
    it('단건 읽음 처리 후 success를 반환한다', async () => {
      service.markAsRead.mockResolvedValue(undefined);
      const dto = { userId: 'user-1' };

      const result = await controller.markAsRead('noti-1', dto as any);

      expect(result).toEqual({ success: true });
      expect(service.markAsRead).toHaveBeenCalledWith('noti-1', 'user-1');
    });
  });

  // ─── markAllRead ────────────────────────────────
  describe('PATCH /api/notifications/by-user/:userId/read-all', () => {
    it('전체 읽음 처리 후 affected 건수를 반환한다', async () => {
      service.markAllRead.mockResolvedValue(3);

      const result = await controller.markAllRead('user-1');

      expect(result).toEqual({ affected: 3 });
      expect(service.markAllRead).toHaveBeenCalledWith('user-1');
    });
  });

  // ─── deleteOld ──────────────────────────────────
  describe('DELETE /api/notifications/old', () => {
    it('30일 이전 알림을 삭제하고 affected를 반환한다', async () => {
      service.deleteOld.mockResolvedValue(10);

      const result = await controller.deleteOld();

      expect(result).toEqual({ affected: 10 });
      expect(service.deleteOld).toHaveBeenCalled();
    });
  });

  // ─── deleteByUserId ─────────────────────────────
  describe('DELETE /api/notifications/by-user/:userId', () => {
    it('사용자 알림 전체 삭제 후 affected를 반환한다', async () => {
      service.deleteByUserId.mockResolvedValue(7);

      const result = await controller.deleteByUserId('user-1');

      expect(result).toEqual({ affected: 7 });
      expect(service.deleteByUserId).toHaveBeenCalledWith('user-1');
    });
  });
});
