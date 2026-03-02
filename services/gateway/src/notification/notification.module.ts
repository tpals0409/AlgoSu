/**
 * @file 알림 모듈 — NotificationService + DeadlineReminderService 등록
 * @domain notification
 * @layer config
 * @related NotificationController, NotificationService, DeadlineReminderService
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { DeadlineReminderService } from './deadline-reminder.service';
import { Notification } from './notification.entity';
import { Study, StudyMember } from '../study/study.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Notification, StudyMember, Study])],
  controllers: [NotificationController],
  providers: [NotificationService, DeadlineReminderService],
  exports: [NotificationService],
})
export class NotificationModule {}
