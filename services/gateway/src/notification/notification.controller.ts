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

  /** GET /api/notifications — 내 알림 목록 (최근 50개) */
  @Get()
  async getMyNotifications(@Req() req: Request): Promise<Notification[]> {
    const userId = req.headers['x-user-id'] as string;
    return this.notificationService.getMyNotifications(userId);
  }

  /** GET /api/notifications/unread-count — 미읽음 수 */
  @Get('unread-count')
  async getUnreadCount(@Req() req: Request): Promise<{ count: number }> {
    const userId = req.headers['x-user-id'] as string;
    const count = await this.notificationService.getUnreadCount(userId);
    return { count };
  }

  /** PATCH /api/notifications/:id/read — 읽음 처리 */
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
