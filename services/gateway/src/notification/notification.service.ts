/**
 * @file 알림 서비스 — 알림 CRUD + 30일 자동 삭제 Cron
 * @domain notification
 * @layer service
 * @related NotificationController, DeadlineReminderService, StudyService
 */

import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository, LessThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import Redis from 'ioredis';
import { Notification, NotificationType } from './notification.entity';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';

@Injectable()
export class NotificationService {
  private readonly redisPublisher: Redis;

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    private readonly configService: ConfigService,
    private readonly logger: StructuredLoggerService,
  ) {
    this.logger.setContext(NotificationService.name);
    const redisUrl = this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');
    this.redisPublisher = new Redis(redisUrl);
    this.redisPublisher.on('error', (err: Error) => {
      this.logger.error(`알림 Redis publisher 오류: ${err.message}`);
    });
  }

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

    // SSE 실시간 알림: 사용자별 Redis 채널에 publish
    const channel = `notification:user:${params.userId}`;
    const payload = JSON.stringify({
      id: saved.id,
      userId: saved.userId,
      type: saved.type,
      title: saved.title,
      message: saved.message,
      link: saved.link,
      read: saved.read,
      createdAt: saved.createdAt,
    });
    this.redisPublisher.publish(channel, payload).catch((err: Error) => {
      this.logger.error(`알림 Redis publish 실패: ${err.message}`);
    });

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
   * @api PATCH /api/notifications/read-all
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
