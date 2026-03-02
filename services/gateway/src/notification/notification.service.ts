import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Notification, NotificationType } from './notification.entity';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
  ) {}

  async createNotification(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    link?: string,
  ): Promise<Notification> {
    const notification = this.notificationRepo.create({
      userId,
      type,
      title,
      message,
      link: link ?? null,
    });
    const saved = await this.notificationRepo.save(notification);
    this.logger.log(`알림 생성: userId=${userId}, type=${type}`);
    return saved;
  }

  async getMyNotifications(userId: string): Promise<Notification[]> {
    return this.notificationRepo.find({
      where: { userId, read: false },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async markAsRead(notificationId: string, userId: string): Promise<void> {
    const notification = await this.notificationRepo.findOne({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundException('알림을 찾을 수 없습니다.');
    }

    // IDOR 방지: 본인 알림만 읽음 처리
    if (notification.userId !== userId) {
      throw new ForbiddenException('다른 사용자의 알림에 접근할 수 없습니다.');
    }

    notification.read = true;
    await this.notificationRepo.save(notification);
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationRepo.count({
      where: { userId, read: false },
    });
  }

  /** 30일 경과 알림 자동 삭제 — 매일 새벽 3시 실행 */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupOldNotifications(): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    const { affected } = await this.notificationRepo.delete({
      createdAt: LessThan(cutoff),
    });

    if (affected && affected > 0) {
      this.logger.log(`오래된 알림 ${affected}건 삭제 (30일 경과)`);
    }
  }
}
