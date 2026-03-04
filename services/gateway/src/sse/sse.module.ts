import { Module } from '@nestjs/common';
import { SseController } from './sse.controller';
import { NotificationModule } from '../notification/notification.module';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';

@Module({
  imports: [NotificationModule],
  controllers: [SseController],
  providers: [StructuredLoggerService],
})
export class SseModule {}
