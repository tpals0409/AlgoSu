/**
 * @file 알림 서비스 — 순수 CRUD (SSE/Redis Pub/Sub은 Gateway 유지)
 * @domain identity
 * @layer service
 * @related notification.controller.ts, notification.entity.ts
 */
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Notification, NotificationType } from './notification.entity';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    private readonly logger: StructuredLoggerService,
  ) {
    this.logger.setContext(NotificationService.name);
  }

  /**
   * 알림 생성
   * @param data - 알림 생성 파라미터
   * @returns 생성된 알림 엔티티
   */
  async create(data: {
    userId: string;
    studyId?: string;
    type: NotificationType;
    title: string;
    message: string;
    link?: string;
  }): Promise<Notification> {
    const notification = this.notificationRepo.create({
      userId: data.userId,
      studyId: data.studyId ?? null,
      type: data.type,
      title: data.title,
      message: data.message,
      link: data.link ?? null,
    });
    const saved = await this.notificationRepo.save(notification);
    this.logger.log(
      `알림 생성: userId=${data.userId}, type=${data.type}, studyId=${data.studyId ?? 'N/A'}`,
    );
    return saved;
  }

  /**
   * 미읽음 알림 목록 조회 (최근 50개, 최신순)
   * @param userId - 대상 사용자 ID
   */
  async findByUserId(userId: string): Promise<Notification[]> {
    return this.notificationRepo.find({
      where: { userId, read: false },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  /**
   * 미읽음 알림 수 조회
   * @param userId - 대상 사용자 ID
   */
  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationRepo.count({
      where: { userId, read: false },
    });
  }

  /**
   * 단건 읽음 처리 — IDOR 방지: userId 검증
   * @param id - 알림 UUID
   * @param userId - 요청 사용자 ID
   */
  async markAsRead(id: string, userId: string): Promise<void> {
    const notification = await this.notificationRepo.findOne({
      where: { id },
    });

    if (!notification) {
      throw new NotFoundException('알림을 찾을 수 없습니다.');
    }

    if (notification.userId !== userId) {
      throw new ForbiddenException('다른 사용자의 알림에 접근할 수 없습니다.');
    }

    notification.read = true;
    await this.notificationRepo.save(notification);
  }

  /**
   * 전체 읽음 처리 — userId 기준 미읽음 알림 일괄 업데이트
   * @param userId - 대상 사용자 ID
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
   * 30일 이상 경과 알림 삭제
   * @returns 삭제된 알림 건수
   */
  async deleteOld(): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    const { affected } = await this.notificationRepo.delete({
      createdAt: LessThan(cutoff),
    });
    const count = affected ?? 0;
    if (count > 0) {
      this.logger.log(`오래된 알림 ${count}건 삭제 (30일 경과)`);
    }
    return count;
  }

  /**
   * 사용자 알림 전체 삭제 (회원탈퇴 시)
   * @param userId - 대상 사용자 ID
   * @returns 삭제된 알림 건수
   */
  async deleteByUserId(userId: string): Promise<number> {
    const { affected } = await this.notificationRepo.delete({ userId });
    const count = affected ?? 0;
    if (count > 0) {
      this.logger.log(`사용자 알림 전체 삭제: userId=${userId}, ${count}건`);
    }
    return count;
  }
}
