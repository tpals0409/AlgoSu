/**
 * @file sse.module.ts — Server-Sent Events 모듈
 * @domain gateway
 * @layer module
 * @related sse.controller.ts, notification.module.ts
 */
import { Module } from '@nestjs/common';
import { SseController } from './sse.controller';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [NotificationModule],
  controllers: [SseController],
})
export class SseModule {}
