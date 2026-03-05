import { Module } from '@nestjs/common';
import { SseController } from './sse.controller';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [NotificationModule],
  controllers: [SseController],
})
export class SseModule {}
