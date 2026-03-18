/**
 * @file 알림 모듈 — NotificationService + DeadlineReminderService 등록
 * @domain notification
 * @layer config
 * @related NotificationController, NotificationService, DeadlineReminderService
 */

import { Module } from '@nestjs/common';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { DeadlineReminderService } from './deadline-reminder.service';

@Module({
  controllers: [NotificationController],
  providers: [NotificationService, DeadlineReminderService],
  exports: [NotificationService],
})
export class NotificationModule {}
