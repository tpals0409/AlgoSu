/**
 * @file Discord 모듈 — DiscordWebhookService 등록 및 export
 * @domain identity
 * @layer module
 * @related discord-webhook.service.ts
 */
import { Module } from '@nestjs/common';
import { DiscordWebhookService } from './discord-webhook.service';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';

@Module({
  providers: [DiscordWebhookService, StructuredLoggerService],
  exports: [DiscordWebhookService],
})
export class DiscordModule {}
