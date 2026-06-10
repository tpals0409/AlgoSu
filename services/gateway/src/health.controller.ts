/**
 * @file health.controller.ts — 헬스체크 엔드포인트 (/health, /health/ready)
 * @domain gateway
 * @layer controller
 * @related app.module.ts, public-routes.ts
 */
import { Controller, Get } from '@nestjs/common';
import { Public } from './common/decorators/public.decorator';

@Public()
@Controller()
export class HealthController {
  @Get('health')
  check(): { status: string; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('health/ready')
  readiness(): { status: string; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
