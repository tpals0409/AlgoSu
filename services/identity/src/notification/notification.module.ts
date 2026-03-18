/**
 * @file 알림 모듈 — TypeORM + Service + Controller 등록
 * @domain identity
 * @layer module
 * @related notification.entity.ts, notification.service.ts, notification.controller.ts
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './notification.entity';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';

@Module({
  imports: [TypeOrmModule.forFeature([Notification])],
  controllers: [NotificationController],
  providers: [NotificationService, StructuredLoggerService],
  exports: [NotificationService],
})
export class NotificationModule {}
