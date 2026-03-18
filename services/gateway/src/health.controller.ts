import { Controller, Get } from '@nestjs/common';

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
