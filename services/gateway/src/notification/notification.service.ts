/**
 * @file 알림 서비스 — 알림 CRUD + 30일 자동 삭제 Cron
 * @domain notification
 * @layer service
 * @related NotificationController, DeadlineReminderService, StudyService
 */

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

  // ─── HELPERS ──────────────────────────────

  /**
   * 알림 생성 공용 헬퍼
   * @domain notification
   * @param params - 알림 생성 파라미터
   * @returns 생성된 알림 엔티티
   */
  async createNotification(params: {
    userId: string;
    studyId?: string;
    type: NotificationType;
    title: string;
    message: string;
    link?: string;
  }): Promise<Notification> {
    const notification = this.notificationRepo.create({
      userId: params.userId,
      studyId: params.studyId ?? null,
      type: params.type,
      title: params.title,
      message: params.message,
      link: params.link ?? null,
    });
    const saved = await this.notificationRepo.save(notification);
    this.logger.log(
      `알림 생성: userId=${params.userId}, type=${params.type}, studyId=${params.studyId ?? 'N/A'}`,
    );
    return saved;
  }

  // ─── HANDLERS ─────────────────────────────

  /**
   * 내 알림 목록 조회 (미읽음 우선, 최근 50개)
   * @domain notification
   * @api GET /api/notifications
   * @guard jwt-auth
   * @param userId - 현재 사용자 ID
   */
  async getMyNotifications(userId: string): Promise<Notification[]> {
    return this.notificationRepo.find({
      where: { userId, read: false },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  /**
   * 단건 읽음 처리 — IDOR 방지: 본인 알림만 가능
   * @domain notification
   * @api PATCH /api/notifications/:id/read
   * @guard jwt-auth
   * @param notificationId - 알림 UUID
   * @param userId - 현재 사용자 ID
   */
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

  /**
   * 전체 읽음 처리 — userId 기준 미읽음 알림 일괄 업데이트
   * @domain notification
   * @api POST /api/notifications/read-all
   * @guard jwt-auth
   * @param userId - 현재 사용자 ID
   * @returns 처리된 알림 건수
   */
  async markAllRead(userId: string): Promise<number> {
    const result = await this.notificationRepo.update(
      { userId, read: false },
      { read: true },
    );
    const affected = result.affected ?? 0;
    if (affected > 0) {
      this.logger.log(`전체 읽음 처리: userId=${userId}, ${affected}건`);
    }
    return affected;
  }

  /**
   * 미읽음 수 조회 — 프론트 10초 폴링용
   * @domain notification
   * @api GET /api/notifications/unread-count
   * @guard jwt-auth
   * @param userId - 현재 사용자 ID
   */
  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationRepo.count({
      where: { userId, read: false },
    });
  }

  // ─── CRON ─────────────────────────────────

  /**
   * 30일 경과 알림 자동 삭제 — 매일 새벽 3시 실행
   * @domain notification
   */
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
