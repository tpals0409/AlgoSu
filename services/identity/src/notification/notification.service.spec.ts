import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { Notification, NotificationType } from './notification.entity';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';

// ─── Mock 헬퍼 ───────────────────────────────────────
const mockNotification = (overrides: Partial<Notification> = {}): Notification =>
  ({
    id: 'noti-1',
    userId: 'user-1',
    studyId: null,
    type: NotificationType.AI_COMPLETED,
    title: 'AI 분석 완료',
    message: '코드 분석이 완료되었습니다.',
    link: null,
    read: false,
    publicId: 'pub-noti-1',
    createdAt: new Date(),
    generatePublicId: jest.fn(),
    ...overrides,
  }) as Notification;

describe('NotificationService', () => {
  let service: NotificationService;
  let notiRepo: jest.Mocked<Repository<Notification>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: getRepositoryToken(Notification),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            count: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: StructuredLoggerService,
          useValue: { setContext: jest.fn(), log: jest.fn(), warn: jest.fn(), error: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(NotificationService);
    notiRepo = module.get(getRepositoryToken(Notification));
  });

  afterEach(() => jest.clearAllMocks());

  // ─── create ────────────────────────────────────────
  describe('create', () => {
    it('알림을 정상 생성한다', async () => {
      const noti = mockNotification();
      notiRepo.create.mockReturnValue(noti);
      notiRepo.save.mockResolvedValue(noti);

      const result = await service.create({
        userId: 'user-1',
        type: NotificationType.AI_COMPLETED,
        title: 'AI 분석 완료',
        message: '코드 분석이 완료되었습니다.',
      });

      expect(result).toBe(noti);
      expect(notiRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          type: NotificationType.AI_COMPLETED,
        }),
      );
    });
  });

  // ─── findByUserId ──────────────────────────────────
  describe('findByUserId', () => {
    it('미읽음 알림을 최근 50개 제한으로 반환한다', async () => {
      const notifications = [mockNotification(), mockNotification({ id: 'noti-2' })];
      notiRepo.find.mockResolvedValue(notifications);

      const result = await service.findByUserId('user-1');

      expect(result).toEqual(notifications);
      expect(notiRepo.find).toHaveBeenCalledWith({
        where: { userId: 'user-1', read: false },
        order: { createdAt: 'DESC' },
        take: 50,
      });
    });
  });

  // ─── markAsRead ────────────────────────────────────
  describe('markAsRead', () => {
    it('본인 알림을 읽음 처리한다', async () => {
      const noti = mockNotification();
      notiRepo.findOne.mockResolvedValue(noti);
      notiRepo.save.mockResolvedValue({ ...noti, read: true } as Notification);

      await service.markAsRead('noti-1', 'user-1');

      expect(notiRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ read: true }),
      );
    });

    it('다른 유저의 알림 접근 시 ForbiddenException (IDOR 방지)', async () => {
      const noti = mockNotification({ userId: 'user-1' });
      notiRepo.findOne.mockResolvedValue(noti);

      await expect(service.markAsRead('noti-1', 'user-2')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('알림 미존재 시 NotFoundException', async () => {
      notiRepo.findOne.mockResolvedValue(null);

      await expect(service.markAsRead('x', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── markAllRead ───────────────────────────────────
  describe('markAllRead', () => {
    it('미읽음 알림을 일괄 읽음 처리하고 건수를 반환한다', async () => {
      notiRepo.update.mockResolvedValue({ affected: 5, raw: [], generatedMaps: [] });

      const result = await service.markAllRead('user-1');

      expect(result).toBe(5);
      expect(notiRepo.update).toHaveBeenCalledWith(
        { userId: 'user-1', read: false },
        { read: true },
      );
    });

    it('미읽음 알림이 없으면 0을 반환한다', async () => {
      notiRepo.update.mockResolvedValue({ affected: 0, raw: [], generatedMaps: [] });

      const result = await service.markAllRead('user-1');

      expect(result).toBe(0);
    });
  });

  // ─── deleteOld ─────────────────────────────────────
  describe('deleteOld', () => {
    it('30일 이전 알림을 삭제한다', async () => {
      notiRepo.delete.mockResolvedValue({ affected: 10, raw: [] });

      const result = await service.deleteOld();

      expect(result).toBe(10);
      expect(notiRepo.delete).toHaveBeenCalledWith({
        createdAt: expect.objectContaining({}),
      });
    });

    it('삭제 대상이 없으면 0을 반환한다', async () => {
      notiRepo.delete.mockResolvedValue({ affected: 0, raw: [] });

      const result = await service.deleteOld();

      expect(result).toBe(0);
    });
  });
});
