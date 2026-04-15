/**
 * @file health.controller.ts — 헬스체크 엔드포인트 (/health, /health/ready)
 * @domain problem
 * @layer controller
 * @related app.module.ts
 */
import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Controller()
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get('health')
  check(): { status: string; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('health/ready')
  async readiness(): Promise<{ status: string; timestamp: string }> {
    try {
      // raw query 허용: health check 전용 상수 쿼리, 사용자 입력 없음
      await this.dataSource.query('SELECT 1');
      return { status: 'ok', timestamp: new Date().toISOString() };
    } catch {
      throw new ServiceUnavailableException('Database not ready');
    }
  }
}
