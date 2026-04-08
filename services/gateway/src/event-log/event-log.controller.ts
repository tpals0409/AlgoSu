/**
 * @file 이벤트 로깅 컨트롤러 — 프론트엔드 이벤트 배치 수신
 * @domain event-log
 * @layer controller
 * @related EventLogService
 */
import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { EventLogService, EventPayload } from './event-log.service';

@ApiTags('Events')
@Controller('api/events')
export class EventLogController {
  constructor(private readonly eventLogService: EventLogService) {}

  @ApiOperation({ summary: '이벤트 배치 수신' })
  @ApiResponse({ status: 204, description: '수신 완료' })
  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  async ingest(@Body() body: { events: EventPayload[] }): Promise<void> {
    const events = (body.events ?? []).slice(0, 50);
    if (events.length > 0) {
      await this.eventLogService.bufferEvents(events);
    }
  }
}
