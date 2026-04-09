/**
 * @file 알림 서비스 — 알림 CRUD + 30일 자동 삭제 Cron
 * @domain notification
 * @layer service
 * @related NotificationController, DeadlineReminderService, StudyService
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import Redis from 'ioredis';
import type { IdentityNotification as Notification } from '../common/types/identity.types';
import { NotificationType } from '../common/types/identity.types';
import { IdentityClientService } from '../identity-client/identity-client.service';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';

@Injectable()
export class NotificationService {
  private readonly redisPublisher: Redis;

  constructor(
    private readonly identityClient: IdentityClientService,
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
  }): Promise<Record<string, unknown>> {
    const saved = await this.identityClient.createNotification({
      userId: params.userId,
      studyId: params.studyId ?? null,
      type: params.type,
      title: params.title,
      message: params.message,
      link: params.link ?? null,
    });
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
    const results = await this.identityClient.findNotificationsByUserId(userId);
    return results as unknown as Notification[];
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
    await this.identityClient.markAsRead(notificationId, userId);
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
    const result = await this.identityClient.markAllRead(userId);
    const affected = result.affected ?? 0;
    if (affected > 0) {
      this.logger.log(`전체 읽음 처리: userId=${userId}, ${affected}건`);
    }
    return affected;
  }

  /**
   * 미읽음 수 조회 — 프론트 60초 폴링용
   * @domain notification
   * @api GET /api/notifications/unread-count
   * @guard jwt-auth
   * @param userId - 현재 사용자 ID
   */
  async getUnreadCount(userId: string): Promise<number> {
    const result = await this.identityClient.getUnreadCount(userId);
    return result.count;
  }

  // ─── CRON ─────────────────────────────────

  /**
   * 30일 경과 알림 자동 삭제 — 매일 새벽 3시 실행
   * @domain notification
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupOldNotifications(): Promise<void> {
    const result = await this.identityClient.deleteOldNotifications();
    const affected = result.affected ?? 0;

    if (affected > 0) {
      this.logger.log(`오래된 알림 ${affected}건 삭제 (30일 경과)`);
    }
  }
}
