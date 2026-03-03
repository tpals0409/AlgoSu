/**
 * @file 알림 컨트롤러 — 알림 목록, 읽음 처리, 미읽음 수 조회
 * @domain notification
 * @layer controller
 * @related NotificationService
 */

import {
  Controller,
  Get,
  Patch,
  Param,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Request } from 'express';
import { NotificationService } from './notification.service';
import { Notification } from './notification.entity';

@Controller('api/notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  /**
   * 내 알림 목록 (미읽음, 최근 50개)
   * @api GET /api/notifications
   * @guard jwt-auth
   */
  @Get()
  async getMyNotifications(@Req() req: Request): Promise<Notification[]> {
    const userId = req.headers['x-user-id'] as string;
    return this.notificationService.getMyNotifications(userId);
  }

  /**
   * 미읽음 수 조회 — 프론트 10초 폴링용
   * @api GET /api/notifications/unread-count
   * @guard jwt-auth
   */
  @Get('unread-count')
  async getUnreadCount(@Req() req: Request): Promise<{ count: number }> {
    const userId = req.headers['x-user-id'] as string;
    const count = await this.notificationService.getUnreadCount(userId);
    return { count };
  }

  /**
   * 전체 읽음 처리 — userId 기준 미읽음 알림 일괄 업데이트
   * @api PATCH /api/notifications/read-all
   * @guard jwt-auth
   */
  @Patch('read-all')
  async markAllRead(@Req() req: Request): Promise<{ affected: number }> {
    const userId = req.headers['x-user-id'] as string;
    const affected = await this.notificationService.markAllRead(userId);
    return { affected };
  }

  /**
   * 단건 읽음 처리 — IDOR 방지: 본인 알림만 가능
   * @api PATCH /api/notifications/:id/read
   * @guard jwt-auth
   */
  @Patch(':id/read')
  async markAsRead(
    @Param('id', ParseUUIDPipe) notificationId: string,
    @Req() req: Request,
  ): Promise<{ message: string }> {
    const userId = req.headers['x-user-id'] as string;
    await this.notificationService.markAsRead(notificationId, userId);
    return { message: '읽음 처리되었습니다.' };
  }
}
