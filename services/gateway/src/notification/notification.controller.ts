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
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Request } from 'express';
import { NotificationService } from './notification.service';
import type { IdentityNotification as Notification } from '../common/types/identity.types';

@ApiTags('Notification')
@Controller('api/notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  /**
   * 내 알림 목록 (미읽음, 최근 50개)
   * @api GET /api/notifications
   * @guard jwt-auth
   */
  @ApiOperation({ summary: '내 알림 목록 (미읽음, 최근 50개)' })
  @ApiResponse({ status: 200, description: '알림 목록' })
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
  @ApiOperation({ summary: '미읽음 알림 수 조회' })
  @ApiResponse({ status: 200, description: '미읽음 수' })
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
  @ApiOperation({ summary: '전체 읽음 처리' })
  @ApiResponse({ status: 200, description: '처리된 알림 수' })
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
