/**
 * @file 이벤트 로깅 컨트롤러 — 프론트엔드 이벤트 배치 수신
 * @domain event-log
 * @layer controller
 * @related EventLogService
 */
import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { EventLogService } from './event-log.service';
import { IngestEventsDto } from './dto/ingest-events.dto';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Events')
@Controller('api/events')
export class EventLogController {
  constructor(private readonly eventLogService: EventLogService) {}

  /**
   * 비인증 이벤트 배치 수신.
   * @Public(): JwtMiddleware 우회 — 게스트 트래커도 호출 가능해야 함 (Sprint 211 page_view 등).
   * Sprint 239 S-2: IngestEventsDto + ArrayMaxSize(50)으로 검증 — 51건 이상은 400 reject.
   */
  @Public()
  @ApiOperation({ summary: '이벤트 배치 수신' })
  @ApiResponse({ status: 204, description: '수신 완료' })
  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  async ingest(@Body() body: IngestEventsDto): Promise<void> {
    const events = body.events ?? [];
    if (events.length > 0) {
      await this.eventLogService.bufferEvents(events);
    }
  }
}
